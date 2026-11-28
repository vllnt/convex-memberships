import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, posix } from "node:path";
import process from "node:process";

import {
  checkDocumentation,
  convexHost,
  writeHost,
} from "./check-documentation.mjs";

// Checks the npm tarball itself, not the working tree: the docs a coding agent
// reads from node_modules must be inside and version-matched, nothing
// contributor-only may ride along, the shipped `/test` helper must compile in a
// consumer project, and the installed docs must meet the shared docs contract
// (README examples type-check against the package and the Testing example runs).

/** Files every install must contain, besides the targets of `exports`. */
const REQUIRED = [
  "package.json",
  "README.md",
  "LICENSE",
  "CHANGELOG.md",
  "llms.txt",
  "docs/API.md",
];
/** Top-level paths allowed in the tarball besides dist/ and src/. */
const isAllowedRoot = (path) =>
  REQUIRED.includes(path) || /^docs\/[^/]+\.md$/.test(path);

/** @param {unknown} value @param {Set<string>} found */
function collectExportTargets(value, found) {
  if (typeof value === "string") {
    found.add(posix.normalize(value));
  } else if (typeof value === "object" && value !== null) {
    for (const nested of Object.values(value))
      collectExportTargets(nested, found);
  }
  return found;
}

/** @param {Set<string>} packed */
function checkContents(packed) {
  const metadata = JSON.parse(readFileSync("package.json", "utf8"));
  const exportTargets = [
    ...collectExportTargets(metadata.exports, new Set()),
  ].filter((target) => target !== "package.json");
  /** @type {string[]} */
  const failures = [];

  for (const path of [...REQUIRED, ...exportTargets]) {
    if (!packed.has(path)) {
      failures.push(
        `missing from tarball: ${path} (list it in "files" in package.json${path.startsWith("dist/") ? ", and run pnpm build first" : ""})`,
      );
    }
  }

  for (const path of packed) {
    const inSource = path.startsWith("dist/") || path.startsWith("src/");
    if (!inSource && !isAllowedRoot(path)) {
      failures.push(
        `unexpected in tarball: ${path} (contributor-only; drop it from "files")`,
      );
    }
    if (/(^|\/)(AGENTS|CLAUDE)\.md$/i.test(path)) {
      failures.push(`contributor instructions in tarball: ${path}`);
    }
    if (
      /(^|\/)__tests__\//.test(path) ||
      /\.(test|spec)\./.test(posix.basename(path))
    ) {
      failures.push(`test or spec file in tarball: ${path}`);
    }
  }

  // Every relative link in the packed llms.txt must land on a packed file, so
  // the index never points an agent at a file that is not installed.
  if (packed.has("llms.txt")) {
    const index = readFileSync("llms.txt", "utf8");
    for (const [, target] of index.matchAll(/\]\(([^)]+)\)/g)) {
      if (/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(target)) continue;
      const path = posix.normalize(posix.join(".", target.split("#")[0]));
      if (!packed.has(path))
        failures.push(
          `llms.txt links to ${target}, which is not in the tarball`,
        );
    }
  }
  return failures;
}

// The README's `register(t)` example, against a host schema with its own tables.
const CONSUMER = `/// <reference types="vite/client" />
import { register } from "@vllnt/convex-memberships/test";
import { convexTest } from "convex-test";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
const schema = defineSchema({ users: defineTable({ name: v.string() }) });
register(convexTest(schema, import.meta.glob("./**/*.ts")));
register(convexTest(schema, {}), "custom");
`;

const root = process.cwd();
const bin = (name) => join(root, "node_modules", ".bin", name);
/** Consumer-side packages, linked from this repo's install (no network). */
const CONSUMER_DEPENDENCIES = [
  "convex",
  "convex-test",
  "vite",
  "vitest",
  "@edge-runtime/vm",
  "react",
  "@types/react",
];

/**
 * Install the unpacked tarball into a scratch node_modules, reusing this repo's
 * installed peers, and return the installed package directory.
 * @param {string} temporary @param {string} tarball
 */
function installConsumer(temporary, tarball) {
  const modules = join(temporary, "node_modules");
  const installed = join(modules, "@vllnt", "convex-memberships");
  mkdirSync(dirname(installed), { recursive: true });
  execFileSync("tar", ["-xzf", tarball, "-C", temporary]);
  renameSync(join(temporary, "package"), installed);
  for (const dependency of CONSUMER_DEPENDENCIES) {
    mkdirSync(dirname(join(modules, dependency)), { recursive: true });
    symlinkSync(
      realpathSync(join(root, "node_modules", dependency)),
      join(modules, dependency),
      "dir",
    );
  }
  writeFileSync(
    join(temporary, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );
  return installed;
}

/**
 * Type-check a `/test` consumer under both module modes.
 * @param {string} temporary
 */
function checkConsumerTypes(temporary) {
  writeFileSync(join(temporary, "consumer.ts"), CONSUMER);
  const tsc = bin("tsc");
  for (const [module, resolution] of [
    ["ESNext", "Bundler"],
    ["NodeNext", "NodeNext"],
  ]) {
    execFileSync(
      tsc,
      [
        "--noEmit",
        "--strict",
        "--skipLibCheck",
        "--target",
        "ES2022",
        "--module",
        module,
        "--moduleResolution",
        resolution,
        "consumer.ts",
      ],
      { cwd: temporary, stdio: "inherit" },
    );
  }
}

/**
 * Docs contract on the installed package, then the README examples compiled in
 * a stub Convex host and the README Testing example run under Vitest.
 * @param {string} temporary @param {string} installed
 */
function checkDocs(temporary, installed) {
  const examples = checkDocumentation(installed, temporary);
  const hostFiles = writeHost(
    temporary,
    convexHost(installed, examples),
    examples,
  );
  execFileSync(
    bin("tsc"),
    [
      "--noEmit",
      "--strict",
      "--skipLibCheck",
      "--target",
      "ES2022",
      "--module",
      "ESNext",
      "--moduleResolution",
      "Bundler",
      "--jsx",
      "react-jsx",
      "--types",
      "vite/client",
      ...hostFiles,
    ],
    { cwd: temporary, stdio: "inherit" },
  );
  execFileSync(bin("vitest"), ["run"], { cwd: temporary, stdio: "inherit" });
}

/** @param {string} label @param {() => void} check */
function step(label, check) {
  try {
    check();
    console.log(`OK    ${label}`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`FAIL ${label}: ${reason}`);
    process.exitCode = 1;
  }
}

const temporary = mkdtempSync(join(tmpdir(), "memberships-package-"));
try {
  // `filename` is the absolute path of the packed .tgz.
  const pack = JSON.parse(
    execFileSync("pnpm", ["pack", "--json", "--pack-destination", temporary], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    }),
  );
  const packed = new Set(pack.files.map((file) => file.path));
  const failures = checkContents(packed);
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(
      `OK    tarball contents: ${packed.size} files, docs present, no contributor files`,
    );
    const installed = installConsumer(temporary, pack.filename);
    step("the packed @vllnt/convex-memberships/test compiles in a consumer project", () =>
      checkConsumerTypes(temporary),
    );
    step("docs contract, README examples type-check and the Testing example runs", () =>
      checkDocs(temporary, installed),
    );
  }
} finally {
  rmSync(temporary, { force: true, recursive: true });
}
