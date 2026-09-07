import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Explicit module parsing also catches errors that auto-detection can miss.
const files = [
  ...readdirSync(new URL("../js/", import.meta.url)).filter(name => name.endsWith(".js")).map(name => [`js/${name}`, "module"]),
  ["sw.js", "commonjs"],
  ["config.js", "commonjs"]
];
let failed = false;
for (const [file, type] of files) {
  const result = spawnSync(process.execPath, [`--input-type=${type}`, "--check"], {
    input: readFileSync(new URL(`../${file}`, import.meta.url), "utf8"),
    encoding: "utf8"
  });
  if (result.status !== 0) {
    failed = true;
    console.error(`${file}: ${result.error || result.stderr}`);
  } else {
    console.log(`OK ${file}`);
  }
}
if (failed) process.exitCode = 1;
