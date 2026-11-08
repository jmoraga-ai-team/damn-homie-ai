// Run: npm test   (bundles with esbuild, runs in node, no network)
import { readFileSync } from "node:fs";
import { merge, parse, print, tidy } from "../src/card";
import { scrub } from "../src/secrets";
import { addLine, dailyTidy, loadSavePoint, openProject, readFile, saveSavePoint, writeProject } from "../src/tools";

let fails = 0;
const ok = (cond: any, name: string) => {
	console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
	if (!cond) fails++;
};

// In-memory stand-in for the Drive class (same methods the tools use).
class FakeDrive {
	files = new Map<string, { id: string; name: string; text: string; modifiedTime: string; webViewLink: string }>();
	folderId = "";
	n = 0;
	clock = "2026-11-07T12:00:00Z";
	async findFolder() { return this.folderId; }
	async ensureFolder() { const made = !this.folderId; this.folderId ||= "folder1"; return { id: this.folderId, made }; }
	async list() { return [...this.files.values()]; }
	async find(name: string) { return this.files.get(name) || null; }
	async read(id: string) { return [...this.files.values()].find((f) => f.id === id)!.text; }
	async readByName(name: string) { const f = this.files.get(name); return f ? { doc: f, text: f.text } : null; }
	pickedFiles: { id: string; name: string; mimeType: string; modifiedTime: string; text: string }[] = [];
	async picked() { return this.pickedFiles; }
	async readPicked(f: { id: string }) { return this.pickedFiles.find((x) => x.id === f.id)!.text; }
	async write(name: string, text: string) {
		await this.ensureFolder();
		const old = this.files.get(name);
		const f = { id: old?.id || `id${++this.n}`, name, text, modifiedTime: this.clock, webViewLink: `https://docs.google.com/document/d/x${this.n}` };
		this.files.set(name, f);
		return f;
	}
}

const V0_CARD = readFileSync(new URL("./v0-card.txt", import.meta.url), "utf8");

(async () => {
	// 1. Old v0 cards load (backward compatible).
	const c = parse(V0_CARD);
	ok(c.saved === "2026-11-07 1:05 PM" && c.tidied === "2026-11-07", "v0 card: Saved/Tidied read");
	ok(c.lists["QUESTS"].length === 2 && c.lists["QUESTS"][0].text.startsWith("Garage sale"), "v0 card: quests read");
	ok(c.lists["WINS"].length === 1 && c.leftOff?.text.startsWith("Garage sale"), "v0 card: wins hint skipped, left off read");
	ok(c.level?.text.startsWith("2 | XP: 130"), "v0 card: level read");
	const again = parse(print(c));
	ok(JSON.stringify(again.lists) === JSON.stringify(c.lists), "print -> parse round trip keeps every item");

	// 2. Merge by item timestamp.
	const drive = parse(`Saved: 2026-11-07 2:00 PM\nTidied: 2026-11-07\nQUESTS:\n1. Garage sale: step 3/4, next: open the doors [2026-11-07 2:00 PM]\n2. Fix bike: step 0/3, next: find the tire size [2026-11-07 12:50 PM]\nPARKING LOT:\n- Sell old bike online [2026-11-07 12:58 PM]\nMY RULES:\n- No emojis [2026-11-07 12:40 PM]`);
	const stale = parse(`Saved: 2026-11-07 1:30 PM\nTidied: 2026-11-07\nQUESTS:\n1. Garage sale: step 2/4, next: tag big items [2026-11-07 1:05 PM]\n2. Paint fence: step 1/2, next: buy paint [2026-11-07 1:30 PM]\nMY RULES:\n- Short answers [2026-11-07 1:20 PM]`);
	const m = merge(drive, stale);
	const q = m.lists["QUESTS"].map((i) => i.text);
	ok(q.some((t) => t.includes("step 3/4")) && !q.some((t) => t.includes("step 2/4")), "merge: newer Drive item beats stale card item");
	ok(q.some((t) => t.startsWith("Paint fence")) && q.some((t) => t.startsWith("Fix bike")), "merge: items in only one copy are kept");
	ok(m.lists["MY RULES"].length === 2 && m.lists["PARKING LOT"].length === 1, "merge: rules unioned, parked idea kept");
	ok(m.saved === "2026-11-07 2:00 PM", "merge: newest Saved kept");
	const finished = parse(`DONE:\n- Garage sale: finished [2026-11-07 3:00 PM]`);
	const m2 = merge(m, finished);
	ok(!m2.lists["QUESTS"].some((i) => i.text.startsWith("Garage sale")) && m2.lists["DONE"][0].text.startsWith("Garage sale"), "merge: quest moved to DONE leaves QUESTS");
	const reopened = merge(m2, parse(`QUESTS:\n1. Garage sale: step 1/2, next: round two [2026-11-08 9:00 AM]`));
	ok(reopened.lists["QUESTS"].some((i) => i.text.includes("round two")) && !(reopened.lists["DONE"] || []).some((i) => i.text.startsWith("Garage sale")), "merge: newer stamp reopens a done quest");
	const removed = merge(m, parse(""), ["Sell old bike online"]);
	ok(!(removed.lists["PARKING LOT"] || []).length, "merge: remove drops an item on purpose");

	// 3. Tidy.
	const t = parse(`Tidied: 2026-11-01\nQUESTS:\n1. Garage sale: step 4/4 [2026-11-07 1:00 PM]\n2. Fix bike: step 1/3, next: pump [2026-10-01 9:00 AM]\nPARKING LOT:\n- Old idea [2026-10-20 9:00 AM]\n- New idea [2026-11-06 9:00 AM]`);
	const counts = tidy(t, "2026-11-08");
	ok(counts.done === 1 && counts.someday === 1, "tidy: 1 done, 1 old idea to Someday");
	ok(t.lists["QUESTS"].length === 1 && t.lists["QUESTS"][0].text.startsWith("Fix bike"), "tidy: old active quest never moves to Someday");
	ok(t.tidied === "2026-11-08", "tidy: Tidied set to today");

	// 4. Tools end to end on a fake Drive.
	const d = new FakeDrive() as any;
	const first = await loadSavePoint(d, "2026-11-07");
	ok(first.includes("new person") && first.includes("DAMN HOMIE AI RULES"), "load: new person gets rules + hi");
	await saveSavePoint(d, V0_CARD);
	ok(["Save Point", "Start Here", "My Rules", "Decisions", "Wins"].every((n) => d.files.has(n)), "save: makes Save Point, Start Here, My Rules, Decisions, Wins");
	const loaded = await loadSavePoint(d, "2026-11-07");
	ok(loaded.includes("Garage sale: step 2/4") && loaded.includes("Tidy due: no"), "load in a new chat: Save Point back, no tidy same day");
	await addLine(d, "MY RULES", "Call me boss", "2026-11-07 2:10 PM");
	ok(d.files.get("My Rules").text.includes("Call me boss") && d.files.get("Save Point").text.includes("Call me boss"), "add_rule: in My Rules doc and on the card");
	await addLine(d, "DECISIONS", "Sale starts 7 AM", "2026-11-07 2:11 PM");
	ok(d.files.get("Decisions").text.split("\n")[2].includes("Sale starts 7 AM"), "log_decision: newest on top");
	ok(d.files.get("Save Point").text.includes("Garage sale: step 2/4"), "add_rule/log_decision keep the quests");

	for (let i = 0; i < 8; i++) await addLine(d, "MY RULES", `Rule ${i}`, `2026-11-07 3:0${i} PM`);
	const rulesOnCard = d.files.get("Save Point").text.split("MY RULES:")[1].split(/\n[A-Z]/)[0].split("\n- ").length - 1;
	ok(rulesOnCard === 5 && d.files.get("My Rules").text.includes("No emojis"), "card keeps 5 newest rules; My Rules doc keeps all");

	// Layers.
	await writeProject(d, "Garage sale", "Goal: sell junk.\nWhere: step 2 of 4.\nNext: tag big items.", "Pricing: drum kit $120.", undefined, "2026-11-07 2:20 PM");
	const sum = await openProject(d, "garage", "summary");
	ok(sum.includes("Next: tag big items") && !sum.includes("drum kit"), "open_project summary: summary only (layer 3 top)");
	ok((await openProject(d, "Garage sale", "full")).includes("drum kit $120"), "open_project full: body");
	const longRes = await writeProject(d, "Garage sale", "Goal: sell junk.", "x".repeat(3500), undefined, "2026-11-07 2:30 PM");
	ok(longRes.includes("It is long"), "write_project: says split when over a page");
	await writeProject(d, "Garage sale", "Goal: sell junk.\nNext: tag big items.", "Short body.", "Old long notes " + "y".repeat(100), "2026-11-07 2:31 PM");
	ok((await openProject(d, "Garage sale", "details")).includes("Old long notes") && d.files.get("Project: Garage sale").text.includes("More detail"), "write_project details_add: details doc + link");

	// Merge a pasted older card into Drive.
	await saveSavePoint(d, `=== DAMN HOMIE SAVE POINT ===\nSaved: 2026-11-07 12:00 PM\nQUESTS:\n1. Garage sale: step 1/4 [2026-11-07 12:00 PM]\n2. Learn Spanish: step 0/5 [2026-11-07 11:00 AM]\n=== END ===`);
	const sp = d.files.get("Save Point").text;
	ok(sp.includes("Garage sale: step 2/4") && sp.includes("Learn Spanish"), "pasted older card: newer Drive kept + extra quest added");

	// Tidy next day.
	d.clock = "2026-11-08T18:00:00Z";
	ok((await loadSavePoint(d, "2026-11-08")).includes("Tidy due: yes"), "load next day: tidy due");
	await saveSavePoint(d, `QUESTS:\n1. Fix bike: step 3/3 [2026-11-08 8:00 AM]\nPARKING LOT:\n- Ancient idea [2026-10-01 9:00 AM]`);
	const tidyOut = await dailyTidy(d, "2026-11-08");
	const sp2 = d.files.get("Save Point").text;
	ok(tidyOut.startsWith("Tidied your Save Point: 1 done, 1 idea moved to Someday"), "daily_tidy: counts line (" + tidyOut.split("\n")[0] + ")");
	ok(sp2.includes("Tidied: 2026-11-08") && sp2.split("SOMEDAY:")[1].includes("Ancient idea"), "daily_tidy: saved with Someday + Tidied date");
	ok((await loadSavePoint(d, "2026-11-08")).includes("Tidy due: no"), "after tidy: not due again today");

	// Safety Homie: secrets never reach Drive.
	const fakeKey = "sk-proj-" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4";
	const r = await saveSavePoint(d, `DECISIONS:
- Use OpenAI key ${fakeKey} for the bot [2026-11-08 10:00 AM]
- Card 4111 1111 1111 1111 for ads [2026-11-08 10:01 AM]
- My password is hunter22 [2026-11-08 10:02 AM]`);
	const all = [...d.files.values()].map((f: any) => f.text).join(" | ");
	ok(!all.includes(fakeKey) && !all.includes("4111 1111") && !all.includes("hunter22"), "secret guard: key, card and password never written to Drive");
	ok(r.scrubbed === 3 && !r.text.includes(fakeKey), "secret guard: counted (" + r.scrubbed + ") and gone from the returned card");
	ok(scrub("call me at 808-555-1234, order 12345").hits === 0, "secret guard: phone and order numbers left alone");

	// 9. read_file: only picked files.
	const pd: any = new FakeDrive();
	const PICK = "https://ai.damnhomie.com/pick";
	ok((await readFile(pd, PICK)).includes(PICK), "read_file: no picked files -> points to the pick page");
	pd.pickedFiles = [
		{ id: "p1", name: "Budget 2026", mimeType: "application/vnd.google-apps.spreadsheet", modifiedTime: "", text: "rent,1200" },
		{ id: "p2", name: "Notes.txt", mimeType: "text/plain", modifiedTime: "", text: "hello" },
	];
	ok((await readFile(pd, PICK)).includes("1. Budget 2026"), "read_file: no name -> lists picked files");
	ok((await readFile(pd, PICK, "budget")).includes("rent,1200"), "read_file: partial name reads the file");
	ok((await readFile(pd, PICK, "Tax return")).startsWith("No picked file"), "read_file: unpicked name -> says not picked");

	console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
	process.exit(fails ? 1 : 0);
})();
