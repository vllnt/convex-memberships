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
import { join, posix } from "node:path";
import process from "node:process";

// Checks the npm tarball itself, not the working tree: the docs a coding agent
// reads from node_modules must be inside and version-matched, nothing
// contributor-only may ride along, and the shipped `/test` helper must compile
// in a consumer project.

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

/**
 * Install the unpacked tarball into a scratch node_modules, reusing this repo's
 * installed peers (no network), and type-check a consumer under both module modes.
 * @param {string} temporary @param {string} tarball
 */
function checkConsumerTypes(temporary, tarball) {
  const root = process.cwd();
  const modules = join(temporary, "node_modules");
  mkdirSync(join(modules, "@vllnt"), { recursive: true });
  execFileSync("tar", ["-xzf", tarball, "-C", temporary]);
  renameSync(
    join(temporary, "package"),
    join(modules, "@vllnt", "convex-memberships"),
  );
  for (const dependency of ["convex", "convex-test", "vite"]) {
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
  writeFileSync(join(temporary, "consumer.ts"), CONSUMER);
  const tsc = join(root, "node_modules", ".bin", "tsc");
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
    try {
      checkConsumerTypes(temporary, pack.filename);
      console.log(
        `OK    tarball contents: ${packed.size} files, docs present, no contributor files, /test compiles`,
      );
    } catch {
      console.error(
        "FAIL the packed @vllnt/convex-memberships/test does not compile in a consumer project (tsc output above)",
      );
      process.exitCode = 1;
    }
  }
} finally {
  rmSync(temporary, { force: true, recursive: true });
}
