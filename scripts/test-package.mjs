import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { posix } from "node:path";
import process from "node:process";

// Checks the npm tarball itself (`npm pack --dry-run`), not the working tree:
// the docs a coding agent reads from node_modules must be inside, version-matched,
// and nothing contributor-only may ride along.

/** Files every install must contain, besides the targets of `exports`. */
const REQUIRED = [
  "package.json",
  "README.md",
  "LICENSE",
  "CHANGELOG.md",
  "llms.txt",
  "docs/API.md",
];
/** Top-level files allowed in the tarball; everything else must live in dist/ or src/. */
const ROOT_FILES = new Set(REQUIRED);

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

const metadata = JSON.parse(readFileSync("package.json", "utf8"));
const exportTargets = [
  ...collectExportTargets(metadata.exports, new Set()),
].filter((target) => target !== "package.json");

const output = execFileSync(
  "npm",
  ["pack", "--dry-run", "--json", "--ignore-scripts"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
);
const packed = new Set(JSON.parse(output)[0].files.map((file) => file.path));

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
  if (!inSource && !ROOT_FILES.has(path)) {
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

// Every relative link in the packed llms.txt must land on a packed file, so the
// index never points an agent at a file that is not installed.
if (packed.has("llms.txt")) {
  const index = readFileSync("llms.txt", "utf8");
  for (const [, target] of index.matchAll(/\]\(([^)]+)\)/g)) {
    if (/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(target)) continue;
    const path = posix.normalize(posix.join(".", target.split("#")[0]));
    if (!packed.has(path))
      failures.push(`llms.txt links to ${target}, which is not in the tarball`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}
console.log(
  `OK    tarball contents: ${packed.size} files, docs present, no contributor files`,
);
