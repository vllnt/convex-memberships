import { existsSync, readFileSync } from "node:fs";

// llms.txt is curated. Check its local links without generating a source bundle.
const index = readFileSync("llms.txt", "utf8");
for (const [, target] of index.matchAll(/\]\(([^)]+)\)/g)) {
  if (/^(?:https?:\/\/|#)/.test(target)) continue;
  const path = target.split("#")[0];
  if (!existsSync(path)) throw new Error(`Missing llms.txt target: ${path}`);
}
console.log("Validated curated llms.txt");
