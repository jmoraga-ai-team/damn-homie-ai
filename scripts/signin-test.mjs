// Real sign-in test against a deployed copy, like an AI app would do it.
//   node scripts/signin-test.mjs login [base]   -> prints the sign-in link, waits for the browser to come back, saves tokens to %TEMP%
//   node scripts/signin-test.mjs call <tool> '<json args>' [base]
//   node scripts/signin-test.mjs refresh [base] -> uses the refresh token (runs tokenExchangeCallback -> Google refresh)
//   node scripts/signin-test.mjs forget         -> deletes the saved test tokens
// Tokens never go in the repo: they live in %TEMP%\dh-signin-test.json and `forget` deletes them.
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const [cmd, a1, a2, a3] = process.argv.slice(2);
const base = (cmd === "call" ? a3 : a1) || "https://ai-test.damnhomie.com";
const STORE = path.join(os.tmpdir(), "dh-signin-test.json");
const PORT = 8799, REDIRECT = `http://127.0.0.1:${PORT}/cb`;
const b64u = (b) => Buffer.from(b).toString("base64url");
const load = () => JSON.parse(fs.readFileSync(STORE, "utf8"));
const save = (o) => fs.writeFileSync(STORE, JSON.stringify(o));

async function token(body) {
	const r = await fetch(`${base}/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body) });
	const j = await r.json();
	if (!r.ok) throw new Error(`token ${r.status} ${JSON.stringify(j)}`);
	return j;
}

if (cmd === "login") {
	const reg = await (await fetch(`${base}/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_name: "Damn Homie sign-in test", redirect_uris: [REDIRECT], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }) })).json();
	const verifier = b64u(crypto.randomBytes(32));
	const challenge = b64u(crypto.createHash("sha256").update(verifier).digest());
	const state = b64u(crypto.randomBytes(12));
	const u = new URL(`${base}/authorize`);
	Object.entries({ response_type: "code", client_id: reg.client_id, redirect_uri: REDIRECT, code_challenge: challenge, code_challenge_method: "S256", state, scope: "", resource: `${base}/mcp` }).forEach(([k, v]) => u.searchParams.set(k, v));
	console.log("OPEN:", u.href);
	const srv = http.createServer(async (req, res) => {
		const q = new URL(req.url, REDIRECT).searchParams;
		if (!req.url.startsWith("/cb")) return res.end();
		if (q.get("state") !== state) { res.end("bad state"); console.log("BAD STATE"); process.exit(1); }
		try {
			const t = await token({ grant_type: "authorization_code", code: q.get("code"), redirect_uri: REDIRECT, client_id: reg.client_id, code_verifier: verifier, resource: `${base}/mcp` });
			save({ base, client_id: reg.client_id, access: t.access_token, refresh: t.refresh_token, at: Date.now(), expires_in: t.expires_in });
			res.end("Signed in. You can close this tab.");
			console.log("SIGNED IN. expires_in", t.expires_in, "refresh token:", t.refresh_token ? "yes" : "no");
		} catch (e) { res.end("token failed"); console.log("TOKEN FAIL", e.message); }
		srv.close(); setTimeout(() => process.exit(0), 200);
	}).listen(PORT, "127.0.0.1");
	setTimeout(() => { console.log("TIMEOUT"); process.exit(2); }, 8 * 60 * 1000);
} else if (cmd === "refresh") {
	const s = load();
	const t = await token({ grant_type: "refresh_token", refresh_token: s.refresh, client_id: s.client_id, resource: `${s.base}/mcp` });
	save({ ...s, access: t.access_token, refresh: t.refresh_token || s.refresh, at: Date.now(), expires_in: t.expires_in });
	console.log("REFRESHED. new access token:", t.access_token !== s.access ? "yes" : "same", "expires_in", t.expires_in);
} else if (cmd === "call") {
	const s = load();
	const H = { Authorization: `Bearer ${s.access}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
	const rpc = async (body, sid) => {
		const r = await fetch(`${s.base}/mcp`, { method: "POST", headers: { ...H, ...(sid ? { "mcp-session-id": sid } : {}) }, body: JSON.stringify(body) });
		const txt = await r.text();
		const line = txt.split("\n").find((l) => l.startsWith("data:"));
		return { status: r.status, sid: r.headers.get("mcp-session-id"), json: line ? JSON.parse(line.slice(5)) : txt ? JSON.parse(txt) : null };
	};
	const init = await rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "signin-test", version: "1" } } });
	if (init.status !== 200) { console.log("INIT", init.status, JSON.stringify(init.json)); process.exit(1); }
	if (a1 === "list") { const l = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" }, init.sid); console.log(l.json.result.tools.map((t) => t.name).join(", ")); process.exit(0); }
	const out = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: a1, arguments: JSON.parse(a2 || "{}") } }, init.sid);
	const res = out.json?.result;
	console.log(res?.isError ? "TOOL ERROR" : "OK", "\n" + (res?.content || []).map((c) => c.text).join("\n") || JSON.stringify(out.json));
} else if (cmd === "forget") {
	fs.rmSync(STORE, { force: true }); console.log("forgot test tokens");
} else console.log("usage: login | call <tool> <json> | refresh | forget");
