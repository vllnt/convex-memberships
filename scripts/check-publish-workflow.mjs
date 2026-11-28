import { readFileSync } from "node:fs";
import process from "node:process";

// Every publish job in publish.yml must run `pnpm test:package` after
// `pnpm build` and before `npm publish`, so no tarball ships unchecked.
// Line-based on purpose: jobs are two-space keys under `jobs:`.

const file = process.argv[2] ?? ".github/workflows/publish.yml";
const lines = readFileSync(file, "utf8").split("\n");

/** @type {Map<string, string[]>} */
const jobs = new Map();
let inJobs = false;
let current = "";
for (const line of lines) {
  if (/^\S/.test(line)) {
    inJobs = line.startsWith("jobs:");
    current = "";
    continue;
  }
  const job = inJobs && /^ {2}([\w-]+):\s*$/.exec(line);
  if (job) {
    current = job[1];
    jobs.set(current, []);
  } else if (current) {
    jobs.get(current)?.push(line);
  }
}

const failures = [];
let publishJobs = 0;
for (const [name, body] of jobs) {
  const at = (pattern) => body.findIndex((line) => pattern.test(line));
  const publish = at(/\bnpm publish\b/);
  if (publish === -1) continue;
  publishJobs++;
  const build = at(/^\s*- run: pnpm build\s*$/);
  const testPackage = at(/^\s*- run: pnpm test:package\s*$/);
  if (build === -1 || testPackage === -1 || !(build < testPackage && testPackage < publish)) {
    failures.push(
      `${file}: job "${name}" publishes without "- run: pnpm test:package" between "- run: pnpm build" and "npm publish" (add it right after "pnpm build")`,
    );
  }
}
if (publishJobs === 0) failures.push(`${file}: no job runs "npm publish"`);

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}
console.log(`OK    publish workflow: ${publishJobs} publish job(s) run pnpm test:package before npm publish`);
