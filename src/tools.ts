// The memory hands: each tool reads/writes the person's own Drive folder "Damn Homie".
// Same folder and doc names as the v0 skill.
import { RULES, VERSION, WHATS_NEW } from "./brain";
import { emptyCard, item, key, lines, merge, parse, print, stampValue, tidy, type Card, type Item } from "./card";
import type { Drive } from "./drive";
import { scrub } from "./secrets";

const LONG = 3000; // chars: "about a page"
const LIST_DOCS: Record<string, string> = { "MY RULES": "My Rules", DECISIONS: "Decisions", WINS: "Wins" };
const CAP = 5;

const START_HERE = `Damn Homie AI: Start Here

This folder is your memory. Damn Homie AI reads and writes it for you.

1. Uses Damn Homie AI. Answers: big, plain, numbered, one step at a time, numbered yes/no picks.
2. Their stuff lives in Google Drive folder "Damn Homie" (no Drive: they paste a Save Point card).
3. Start of chat: open the Save Point doc first, then My Rules. Open a project doc only when it comes up.
4. First chat of the day: daily tidy, then pick up where they left off.
5. Their top rules: see My Rules.

Docs here:
- Save Point: where you left off (rewritten each save)
- My Rules: every rule you gave the AI
- Decisions: what you decided, newest on top
- Wins: real wins and skill level-ups, newest on top
- Project: <name>: one per quest, opens with a short Summary
- Project: <name> details: deep notes for a quest
- Archive: old stuff moved out so the main docs stay short

Safe to delete this folder any time: that deletes your memory. The app keeps no copy.`;

function itemsFromDoc(text: string): Item[] {
	return text
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => /^[-*•]|\[\d{4}-\d{2}-\d{2}/.test(l))
		.map(item)
		.filter((i) => i.text);
}

function unionNewestFirst(sec: string, a: Item[], b: Item[]): Item[] {
	const m = new Map<string, Item>();
	for (const it of [...a, ...b]) {
		const k = key(sec, it);
		const old = m.get(k);
		if (k && (!old || it.t >= old.t)) m.set(k, it);
	}
	return [...m.values()].sort((x, y) => y.t - x.t);
}

async function prependArchive(d: Drive, title: string, items: Item[]) {
	if (!items.length) return;
	const old = (await d.readByName("Archive"))?.text.replace(/^Archive\n*/, "") || "";
	await d.write("Archive", `Archive\n\n${title}\n${lines(items)}\n\n${old}`.trimEnd());
}

const dateOf = (s: string) => (s.match(/\d{4}-\d{2}-\d{2}/) || [""])[0];

export async function loadSavePoint(d: Drive, today: string): Promise<string> {
	if (!(await d.findFolder())) {
		return `${RULES}\n\n--- THEIR MEMORY ---\nNo Save Point yet: this is a new person (or they have not connected Drive before). Say hi in one line and ask for a brain dump. The first save makes their "Damn Homie" folder.\nWhat's new (say it once, in one line): ${WHATS_NEW}`;
	}
	const [sp, rules, docs] = await Promise.all([d.readByName("Save Point"), d.readByName("My Rules"), d.list()]);
	const card = sp ? parse(sp.text) : emptyCard();
	const tidyDue = !card.tidied || dateOf(card.tidied) < dateOf(today);
	const projects = docs.filter((x) => x.name.startsWith("Project: ") && !x.name.endsWith(" details")).map((x) => x.name.slice(9));
	const out = [RULES, "", "--- THEIR SAVE POINT ---", sp ? print(card) : "(no Save Point doc yet)"];
	if (rules) out.push("", "--- MY RULES (all) ---", rules.text);
	out.push("", `Project docs: ${projects.length ? projects.join(", ") : "none yet"} (open_project only when that quest comes up)`);
	out.push(`Tidy due: ${tidyDue ? "yes (call daily_tidy first)" : "no"}`);
	if (card.version !== VERSION) out.push(`What's new (say it once, in one line): ${WHATS_NEW}`);
	return out.join("\n");
}

// Save = merge the incoming card into Drive. Returns the Save Code card.
export async function saveSavePoint(d: Drive, cardText: string, remove: string[] = []): Promise<{ text: string; card: Card; scrubbed: number }> {
	const { made } = await d.ensureFolder();
	const sp = await d.readByName("Save Point");
	const base = sp ? parse(sp.text) : emptyCard();
	const clean = scrub(cardText);
	const incoming = parse(clean.text);
	const m = merge(base, incoming, remove);
	m.version = VERSION;
	if (!m.saved) m.saved = incoming.saved;

	// Full lists live in their own docs; the card keeps the newest 5.
	for (const [sec, name] of Object.entries(LIST_DOCS)) {
		const cardItems = m.lists[sec] || [];
		const doc = await d.readByName(name);
		const docItems = doc ? itemsFromDoc(doc.text) : [];
		const dropped = new Set(remove.flatMap((r) => [key(sec, item(r)), key("QUESTS", item(r))]));
		const all = unionNewestFirst(sec, docItems, cardItems).filter((i) => !dropped.has(key(sec, i)));
		const changed = all.length !== docItems.length || all.some((it, i) => it.text !== docItems[i]?.text || it.stamp !== docItems[i]?.stamp);
		if (cardItems.length && (changed || !doc)) await d.write(name, `${name}\n\n${lines(all)}`);
		if (all.length) m.lists[sec] = all.slice(0, CAP);
		if (all.length && !m.order.includes(sec)) m.order.push(sec);
	}
	const done = m.lists["DONE"] || [];
	if (done.length > CAP) {
		await prependArchive(d, `Done (moved ${m.saved})`, done.slice(CAP));
		m.lists["DONE"] = done.slice(0, CAP);
	}
	const text = print(m);
	await d.write("Save Point", text);
	if (made || !(await d.find("Start Here"))) await d.write("Start Here", START_HERE);
	return { text, card: m, scrubbed: clean.hits };
}

export async function addLine(d: Drive, sec: "MY RULES" | "DECISIONS" | "WINS", what: string, when: string) {
	const r = await saveSavePoint(d, `${sec}:\n- ${what.trim()} [${when.trim()}]`);
	return r;
}

function summaryOf(text: string): string {
	const body = text.replace(/^Project: .*\n+/, "");
	const parts = body.split(/\n\s*\n/);
	return parts.slice(0, parts[0].trim().toLowerCase() === "summary" ? 2 : 1).join("\n").trim();
}

export async function openProject(d: Drive, name: string, depth: "summary" | "full" | "details"): Promise<string> {
	let doc = await d.readByName(`Project: ${name}`);
	if (!doc) {
		const want = name.toLowerCase();
		const hit = (await d.list()).find((x) => x.name.startsWith("Project: ") && !x.name.endsWith(" details") && x.name.toLowerCase().includes(want));
		if (hit) doc = { doc: hit, text: await d.read(hit.id) };
	}
	if (!doc) return `No project doc called "${name}". Project docs: ${(await d.list()).filter((x) => x.name.startsWith("Project: ")).map((x) => x.name.slice(9)).join(", ") || "none yet"}.`;
	if (depth === "summary") return `${doc.doc.name} (summary; ask for depth "full" only if you need more)\n${summaryOf(doc.text)}`;
	if (depth === "full") return `${doc.doc.name}\n${doc.text}`;
	const det = await d.readByName(`${doc.doc.name} details`);
	return det ? `${det.doc.name}\n${det.text}` : `${doc.doc.name} has no details doc yet.`;
}

export async function writeProject(d: Drive, name: string, summary: string, body?: string, detailsAdd?: string, when = ""): Promise<string> {
	const title = `Project: ${name.replace(/^Project:\s*/i, "").trim()}`;
	const old = await d.readByName(title);
	let oldBody = "";
	if (old) {
		const rest = old.text.replace(/^Project: .*\n+/, "").split(/\n\s*\n/);
		const skip = rest[0]?.trim().toLowerCase() === "summary" ? 2 : 1;
		oldBody = rest.slice(skip).join("\n\n").replace(/\n*More detail: .*$/s, "").trim();
	}
	const details = `${title} details`;
	let hasDetails = !!(await d.find(details));
	if (detailsAdd?.trim()) {
		const oldDet = (await d.readByName(details))?.text.replace(/^Project: .*\n+/, "") || "";
		await d.write(details, `${details}\n\n${when ? `Moved ${when}\n` : ""}${detailsAdd.trim()}\n\n${oldDet}`.trimEnd());
		hasDetails = true;
	}
	const mainBody = (body ?? oldBody).trim();
	const text = [title, "", "Summary", summary.trim(), "", mainBody, hasDetails ? `\nMore detail: doc "${details}"` : ""].join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
	const doc = await d.write(title, text);
	const long = text.length > LONG;
	return `Saved ${title}${hasDetails ? " (+ details doc)" : ""}. ${doc.webViewLink || ""}${long ? `\nIt is long (${text.length} chars, over about a page). Split it now: call write_project again with a short summary, a short body, and the old detail in details_add. Then fix that quest's Save Point line.` : ""}\nNow update this quest's Save Point line from the summary (save_save_point).`;
}

export async function dailyTidy(d: Drive, today: string): Promise<string> {
	if (!(await d.findFolder())) return "Nothing to tidy yet (no Save Point).";
	const sp = await d.readByName("Save Point");
	if (!sp) return "Nothing to tidy yet (no Save Point).";
	const card = parse(sp.text);
	const since = dateOf(card.tidied);
	const counts = tidy(card, dateOf(today));
	const notes: string[] = [];
	// Decisions and Wins over ~30 lines: newest 30 stay, the rest go to the Archive.
	for (const name of ["Decisions", "Wins"]) {
		const doc = await d.readByName(name);
		if (!doc) continue;
		const its = itemsFromDoc(doc.text).sort((a, b) => b.t - a.t);
		if (its.length > 30) {
			await prependArchive(d, `${name} (moved ${dateOf(today)})`, its.slice(30));
			await d.write(name, `${name}\n\n${lines(its.slice(0, 30))}`);
			notes.push(`${its.length - 30} old ${name.toLowerCase()} moved to Archive`);
		}
	}
	const { card: saved } = await saveSavePoint(d, print(card));
	// Long project docs changed since the last tidy: the AI splits them (needs a summary).
	const long: string[] = [];
	for (const x of await d.list()) {
		if (!x.name.startsWith("Project: ") || x.name.endsWith(" details")) continue;
		if (since && x.modifiedTime.slice(0, 10) < since) continue;
		if ((await d.read(x.id)).length > LONG) long.push(x.name.slice(9));
	}
	const parts = [`${counts.done} done`, `${counts.someday} idea${counts.someday === 1 ? "" : "s"} moved to Someday`, ...notes];
	return `Tidied your Save Point: ${parts.join(", ")}.${long.length ? `\nLong project docs to split now (write_project with details_add): ${long.join(", ")}.` : ""}\nTidied: ${saved.tidied}\n\n${print(saved)}`;
}

export { stampValue };
