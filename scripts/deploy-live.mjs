// npm run deploy: the ONLY way to deploy live. Refuses unless you are on main, the tree is clean,
// and your commit is exactly origin/main (so it came through a reviewed pull request). Then it tests,
// deploys, and saves the live code hash as the "reviewed deploy" the daily check compares against.
import { sh, bin, live, writeReviewed } from "./lib.mjs";

const stop = (why) => { console.error("NOT DEPLOYED: " + why); process.exit(1); };

if (sh("git", ["rev-parse", "--abbrev-ref", "HEAD"]) !== "main") stop("not on main.");
if (sh("git", ["status", "--porcelain"])) stop("uncommitted changes.");
sh("git", ["fetch", "origin", "main"]);
const head = sh("git", ["rev-parse", "HEAD"]);
if (head !== sh("git", ["rev-parse", "origin/main"])) stop("this commit is not origin/main. Merge through a pull request first.");

bin("esbuild", ["test/test.ts", "--bundle", "--platform=node", "--format=esm", "--outfile=test/.out.mjs", "--log-level=warning"]);
sh(process.execPath, ["test/.out.mjs"]); // throws, so nothing deploys, if any test fails
bin("tsc", ["--noEmit"]);
console.log(bin("wrangler", ["deploy", "--message", "commit " + head]));

const now = live();
if (now.etags.length !== 1) stop("deployed, but live is split across versions. Check it by hand.");
writeReviewed({ commit: head, version: now.versions[0], etag: now.etags[0], at: new Date().toISOString() });
console.log(`DEPLOYED commit ${head.slice(0, 7)} as version ${now.versions[0]} (reviewed hash saved).`);
