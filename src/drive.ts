// Tiny Google Drive client. Scope drive.file: it only ever sees files this app made.
// Docs are Google Docs; we write plain text and read plain text.

const API = "https://www.googleapis.com/drive/v3";
const UP = "https://www.googleapis.com/upload/drive/v3";
const DOC = "application/vnd.google-apps.document";
const FOLDER = "application/vnd.google-apps.folder";
export const FOLDER_NAME = "Damn Homie";

import { scrub } from "./secrets";

export class SignInError extends Error {}

export type PickedFile = { id: string; name: string; mimeType: string; modifiedTime: string };
const EXPORT: Record<string, string> = { [DOC]: "text/plain", "application/vnd.google-apps.presentation": "text/plain", "application/vnd.google-apps.spreadsheet": "text/csv" };
const TEXTY = /^text\/|json|csv|markdown|xml/;

export type DocInfo = { id: string; name: string; modifiedTime: string; webViewLink: string };

export class Drive {
	folderId = "";
	scrubbed = 0; // secrets blanked before writing
	constructor(private token: string, private f: typeof fetch = (u, i) => fetch(u, i)) {} // wrapped: Workers throws "Illegal invocation" if fetch is called as a method

	private async call(url: string, init: RequestInit = {}) {
		const r = await this.f(url, { ...init, headers: { Authorization: `Bearer ${this.token}`, ...(init.headers || {}) } });
		if (r.status === 401) throw new SignInError("Google sign-in expired. Reconnect Damn Homie AI (Settings > Connectors).");
		if (!r.ok) throw new Error(`Google Drive said ${r.status}: ${(await r.text()).slice(0, 200)}`);
		return r;
	}

	private q(s: string) {
		return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
	}

	async findFolder(): Promise<string> {
		if (this.folderId) return this.folderId;
		const q = `name='${FOLDER_NAME}' and mimeType='${FOLDER}' and trashed=false`;
		const r = await this.call(`${API}/files?q=${encodeURIComponent(q)}&fields=files(id,createdTime)&orderBy=createdTime`);
		const files = ((await r.json()) as any).files as { id: string }[];
		this.folderId = files[0]?.id || "";
		return this.folderId;
	}

	async ensureFolder(): Promise<{ id: string; made: boolean }> {
		if (await this.findFolder()) return { id: this.folderId, made: false };
		const r = await this.call(`${API}/files?fields=id`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER }),
		});
		this.folderId = ((await r.json()) as any).id;
		return { id: this.folderId, made: true };
	}

	async list(): Promise<DocInfo[]> {
		if (!(await this.findFolder())) return [];
		const q = `'${this.folderId}' in parents and trashed=false`;
		const r = await this.call(
			`${API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime,webViewLink)&orderBy=modifiedTime desc&pageSize=200`,
		);
		return ((await r.json()) as any).files;
	}

	// Newest doc with this name wins; extras are merged by the caller if it cares.
	async find(name: string): Promise<DocInfo | null> {
		if (!(await this.findFolder())) return null;
		const q = `name='${this.q(name)}' and '${this.folderId}' in parents and trashed=false`;
		const r = await this.call(`${API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime,webViewLink)&orderBy=modifiedTime desc`);
		return ((await r.json()) as any).files[0] || null;
	}

	async read(id: string): Promise<string> {
		const r = await this.call(`${API}/files/${id}/export?mimeType=text/plain`);
		return (await r.text()).replace(/^﻿/, "").replace(/\r/g, "").trimEnd();
	}

	async readByName(name: string): Promise<{ doc: DocInfo; text: string } | null> {
		const doc = await this.find(name);
		return doc ? { doc, text: await this.read(doc.id) } : null;
	}

	// Files they picked in /pick (outside our folder). drive.file: Google only ever shows us those.
	async picked(): Promise<PickedFile[]> {
		const folder = await this.findFolder();
		const q = `trashed=false and mimeType!='${FOLDER}'` + (folder ? ` and not '${folder}' in parents` : "");
		const r = await this.call(`${API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,modifiedTime)&orderBy=modifiedTime desc&pageSize=50`);
		return ((await r.json()) as any).files;
	}

	// Read a picked file as text. Google Docs/Slides as text, Sheets as CSV, plain text files as-is.
	async readPicked(f: PickedFile): Promise<string> {
		const exp = EXPORT[f.mimeType];
		const url = exp ? `${API}/files/${f.id}/export?mimeType=${encodeURIComponent(exp)}` : TEXTY.test(f.mimeType) ? `${API}/files/${f.id}?alt=media` : "";
		if (!url) throw new Error(`"${f.name}" is a ${f.mimeType} file. Damn Homie AI can read Docs, Sheets, Slides and text files for now`);
		return (await (await this.call(url)).text()).replace(/^\uFEFF/, "").replace(/\r/g, "");
	}

	// Write the whole doc (make it if missing). Returns the doc.
	async write(name: string, text0: string): Promise<DocInfo> {
		const s = scrub(text0);
		this.scrubbed += s.hits;
		const text = s.text;
		const fields = "id,name,modifiedTime,webViewLink";
		const old = await this.find(name);
		if (old) {
			const r = await this.call(`${UP}/files/${old.id}?uploadType=media&fields=${fields}`, {
				method: "PATCH",
				headers: { "Content-Type": "text/plain; charset=UTF-8" },
				body: text,
			});
			return (await r.json()) as DocInfo;
		}
		await this.ensureFolder();
		const boundary = "dh" + Math.random().toString(36).slice(2);
		const body =
			`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
			JSON.stringify({ name, mimeType: DOC, parents: [this.folderId] }) +
			`\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${text}\r\n--${boundary}--`;
		const r = await this.call(`${UP}/files?uploadType=multipart&fields=${fields}`, {
			method: "POST",
			headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
			body,
		});
		return (await r.json()) as DocInfo;
	}
}
