import { existsSync, readFileSync } from "node:fs";

// llms.txt is curated by hand. This validates its links without generating anything:
// a relative link must resolve, and a file that ships in the npm tarball must be linked
// relatively so the link matches the installed version, never as a GitHub `main` URL.
const REPO_BLOB = "https://github.com/vllnt/convex-memberships/blob/main/";
const metadata = JSON.parse(readFileSync("package.json", "utf8"));
const shipped = [
  "package.json",
  "README.md",
  "LICENSE",
  ...metadata.files.filter((file) => !file.startsWith("!")),
];
const isShipped = (path) =>
  shipped.some((entry) => path === entry || path.startsWith(`${entry}/`));

const index = readFileSync("llms.txt", "utf8");
for (const [, target] of index.matchAll(/\]\(([^)]+)\)/g)) {
  if (target.startsWith(REPO_BLOB)) {
    const path = target.slice(REPO_BLOB.length).split("#")[0];
    if (isShipped(path))
      throw new Error(`llms.txt links ${path} on main; link ./${path} instead`);
    continue;
  }
  if (/^(?:https?:\/\/|#)/.test(target)) continue;
  const path = target.split("#")[0];
  if (!existsSync(path)) throw new Error(`Missing llms.txt target: ${path}`);
}
console.log("Validated curated llms.txt");
