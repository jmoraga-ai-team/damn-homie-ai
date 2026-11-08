// npm run check:live: does the live worker run the code we reviewed? No AI.
// Prints MATCH (exit 0) or MISMATCH <reason> (exit 1). Run it daily.
import { live, readReviewed } from "./lib.mjs";

const r = readReviewed();
if (!r) { console.log("MISMATCH no reviewed deploy saved yet (deploy with npm run deploy)"); process.exit(1); }
const now = live();
const bad = now.etags.filter((e) => e !== r.etag);
if (bad.length) {
	console.log(`MISMATCH live code hash ${bad[0].slice(0, 12)} is not the reviewed ${r.etag.slice(0, 12)} (commit ${r.commit.slice(0, 7)}). Live versions: ${now.versions.join(", ")}`);
	process.exit(1);
}
console.log(`MATCH live version ${now.versions.join(", ")} = reviewed commit ${r.commit.slice(0, 7)}`);
