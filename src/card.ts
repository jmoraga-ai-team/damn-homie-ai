// Save Point card: parse, merge by item timestamp, tidy, print.
// Same text format as the v0 skill (MEMORY.md), so old cards keep loading.

export type Item = { text: string; stamp: string; t: number };
export type Card = {
	saved: string;
	tidied: string;
	version: string;
	leftOff: Item | null;
	level: Item | null;
	lists: Record<string, Item[]>; // upper-case section name -> items
	order: string[]; // section order as first seen
};

export const LIST_ORDER = ["QUESTS", "PARKING LOT", "SOMEDAY", "MY RULES", "DECISIONS", "WINS", "DONE"];
const FLOW = ["QUESTS", "PARKING LOT", "SOMEDAY", "DONE"]; // an item lives in only one of these
const HEAD = "=== DAMN HOMIE SAVE POINT ===";
const END = "=== END ===";
const STAMP = /\s*\[(\d{4}-\d{2}-\d{2})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM)?)?\]\s*$/i;

export function stampValue(s: string): number {
	const m = s.match(/(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM)?)?/i);
	if (!m) return 0;
	let h = m[4] ? Number(m[4]) : 0;
	const ap = (m[6] || "").toUpperCase();
	if (ap === "PM" && h < 12) h += 12;
	if (ap === "AM" && h === 12) h = 0;
	return Date.UTC(+m[1], +m[2] - 1, +m[3], h, m[5] ? +m[5] : 0);
}

export function item(raw: string): Item {
	const text = raw.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, "").trim();
	const m = text.match(STAMP);
	if (!m) return { text, stamp: "", t: 0 };
	const stamp = text.slice(m.index!).trim().replace(/^\[|\]$/g, "");
	return { text: text.slice(0, m.index).trim(), stamp, t: stampValue(stamp) };
}

// Same thing = same key. Quests and ideas match by the name before the first ":".
export function key(section: string, it: Item): string {
	let s = it.text.toLowerCase();
	if (FLOW.includes(section)) s = s.split(":")[0];
	return s.replace(/[^a-z0-9]+/g, " ").trim();
}

export function emptyCard(): Card {
	return { saved: "", tidied: "", version: "", leftOff: null, level: null, lists: {}, order: [] };
}

export function parse(text: string): Card {
	const c = emptyCard();
	let cur = "";
	for (const line0 of text.replace(/\r/g, "").replace(/^﻿/, "").split("\n")) {
		const line = line0.trim();
		if (!line || line === HEAD || line === END || /^\+\d+ older/i.test(line)) continue;
		const h = line.match(/^([A-Z][A-Z ]{1,20}):\s*(.*)$/);
		if (h && !/^\d/.test(line)) {
			const name = h[1].trim();
			const rest = h[2];
			if (name === "SAVED") { c.saved = rest; cur = ""; continue; }
			if (name === "TIDIED") { c.tidied = rest; cur = ""; continue; }
			if (name === "VERSION") { c.version = rest; cur = ""; continue; }
			if (name === "LEFT OFF") { c.leftOff = item(rest); cur = ""; continue; }
			if (name === "LEVEL") { c.level = item(rest); cur = ""; continue; }
			cur = name;
			if (!c.lists[cur]) { c.lists[cur] = []; c.order.push(cur); }
			// "WINS: (real wins ...)" is a hint, not an item
			if (rest && !/^\(.*\)$/.test(rest)) c.lists[cur].push(item(rest));
			continue;
		}
		// v0 cards write "Saved:" / "Tidied:" in mixed case
		const mc = line.match(/^(Saved|Tidied|Version):\s*(.*)$/i);
		if (mc) {
			const k = mc[1].toLowerCase() as "saved" | "tidied" | "version";
			c[k] = mc[2];
			cur = "";
			continue;
		}
		if (!cur) { cur = "NOTES"; if (!c.lists[cur]) { c.lists[cur] = []; c.order.push(cur); } }
		c.lists[cur].push(item(line));
	}
	return c;
}

const newer = (a: Item | null, b: Item | null) => (!a ? b : !b ? a : b.t >= a.t ? b : a);

// Merge two cards. Nothing gets lost; the same item keeps its newest copy.
// `incoming` wins ties. `remove` = item names to drop on purpose (after asking).
export function merge(base: Card, incoming: Card, remove: string[] = []): Card {
	const out = emptyCard();
	out.saved = [base.saved, incoming.saved].sort((a, b) => stampValue(b) - stampValue(a))[0] || "";
	out.tidied = [base.tidied, incoming.tidied].sort((a, b) => stampValue(b) - stampValue(a))[0] || "";
	out.version = incoming.version || base.version;
	out.leftOff = newer(base.leftOff, incoming.leftOff);
	out.level = newer(base.level, incoming.level);
	const drop = new Set(remove.map((r) => key("QUESTS", item(r))).concat(remove.map((r) => key("X", item(r)))));
	const sections = [...LIST_ORDER, ...incoming.order, ...base.order].filter((s, i, a) => a.indexOf(s) === i);

	// Flow sections: one home per item, newest stamp decides which section it sits in.
	const best = new Map<string, { sec: string; it: Item; inc: boolean; rank: number }>();
	const consider = (c: Card, inc: boolean) => {
		for (const sec of FLOW) {
			(c.lists[sec] || []).forEach((it, rank) => {
				const k = key(sec, it);
				if (!k || drop.has(k)) return;
				const old = best.get(k);
				const better = !old || it.t > old.it.t || (it.t === old.it.t && (inc || (sec === "DONE" && old.sec !== "DONE")));
				if (better) best.set(k, { sec, it, inc, rank });
			});
		}
	};
	consider(base, false);
	consider(incoming, true);
	for (const sec of sections) {
		if (FLOW.includes(sec)) {
			const items = [...best.values()].filter((v) => v.sec === sec);
			// Quests keep the incoming order first; other lists newest first.
			if (sec === "QUESTS") items.sort((a, b) => Number(b.inc) - Number(a.inc) || a.rank - b.rank);
			else items.sort((a, b) => b.it.t - a.it.t);
			if (items.length || base.lists[sec] || incoming.lists[sec]) out.lists[sec] = items.map((v) => v.it);
		} else {
			const m = new Map<string, Item>();
			for (const it of [...(base.lists[sec] || []), ...(incoming.lists[sec] || [])]) {
				const k = key(sec, it);
				if (!k || drop.has(k)) continue;
				const old = m.get(k);
				if (!old || it.t >= old.t) m.set(k, it);
			}
			if (m.size || base.lists[sec] || incoming.lists[sec]) out.lists[sec] = [...m.values()].sort((a, b) => b.t - a.t);
		}
		if (out.lists[sec]) out.order.push(sec);
	}
	return out;
}

const line = (it: Item) => (it.stamp ? `${it.text} [${it.stamp}]` : it.text);

// Print the card. `cap` keeps lists short (newest first); quests are never cut.
export function print(c: Card, cap = 0): string {
	const out = [HEAD];
	if (c.version) out.push(`Version: ${c.version}`);
	out.push(`Saved: ${c.saved}`, `Tidied: ${c.tidied}`);
	if (c.leftOff) out.push(`LEFT OFF: ${line(c.leftOff)}`);
	const sections = [...LIST_ORDER, ...c.order].filter((s, i, a) => a.indexOf(s) === i && c.lists[s]);
	for (const sec of sections) {
		if (sec === "DONE" && c.level) out.push(`LEVEL: ${line(c.level)}`);
		const items = c.lists[sec];
		out.push(sec === "WINS" ? "WINS: (real wins and skills with proof; routine chores go in DONE)" : `${sec}:`);
		const shown = cap && sec !== "QUESTS" ? items.slice(0, cap) : items;
		shown.forEach((it, i) => out.push(sec === "QUESTS" ? `${i + 1}. ${line(it)}` : `- ${line(it)}`));
		if (shown.length < items.length) out.push(`+${items.length - shown.length} older`);
	}
	if (!c.lists["DONE"] && c.level) out.push(`LEVEL: ${line(c.level)}`);
	out.push(END);
	return out.join("\n");
}

export function lines(items: Item[]): string {
	return items.map((it) => `- ${line(it)}`).join("\n");
}

// Daily tidy, the parts a script can do safely. Moves only, never deletes.
export function tidy(c: Card, today: string) {
	const counts = { done: 0, someday: 0 };
	const todayT = stampValue(today);
	const quests = c.lists["QUESTS"] || [];
	const keep: Item[] = [];
	for (const q of quests) {
		const m = q.text.match(/step\s+(\d+)\s*\/\s*(\d+)/i);
		const finished = (m && +m[1] >= +m[2] && +m[2] > 0) || /\b(done|finished|complete)\b\s*$/i.test(q.text);
		if (finished) { (c.lists["DONE"] ||= []).unshift(q); counts.done++; } else keep.push(q);
	}
	if (c.lists["QUESTS"]) c.lists["QUESTS"] = keep;
	const lot = c.lists["PARKING LOT"] || [];
	const stay: Item[] = [];
	for (const it of lot) {
		if (it.t && todayT - it.t > 14 * 864e5) { (c.lists["SOMEDAY"] ||= []).unshift(it); counts.someday++; } else stay.push(it);
	}
	if (c.lists["PARKING LOT"]) c.lists["PARKING LOT"] = stay;
	if (c.lists["DONE"]) c.lists["DONE"].sort((a, b) => b.t - a.t);
	if (c.lists["SOMEDAY"]) c.lists["SOMEDAY"].sort((a, b) => b.t - a.t);
	for (const s of ["DONE", "SOMEDAY"]) if (c.lists[s] && !c.order.includes(s)) c.order.push(s);
	c.tidied = today;
	return counts;
}
