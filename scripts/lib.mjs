// Shared helpers for deploy-live and check-live. No AI. Talks only to git and wrangler.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const sh = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

// Run a local package's CLI with node directly: no shell, so arguments are never re-parsed.
const BIN = { wrangler: "wrangler/bin/wrangler.js", tsc: "typescript/bin/tsc", esbuild: "esbuild/bin/esbuild" };
export const bin = (name, args) => sh(process.execPath, [fileURLToPath(new URL("../node_modules/" + BIN[name], import.meta.url)), ...args]);
export const wrangler = (...args) => JSON.parse(bin("wrangler", [...args, "--json"]));

// The live worker right now: the newest deployment, its versions, and each version's code hash (etag).
// The etag changes only when the code changes (a secret change makes a new version with the same etag).
export function live() {
	const d = wrangler("deployments", "list").at(-1);
	const versions = d.versions.map((v) => v.version_id);
	const etags = versions.map((id) => wrangler("versions", "view", id).resources.script.etag);
	return { deployment: d.id, created: d.created_on, versions, etags };
}

export const REVIEWED = new URL("../.reviewed-deploy.json", import.meta.url);
export const readReviewed = () => (existsSync(REVIEWED) ? JSON.parse(readFileSync(REVIEWED, "utf8")) : null);
export const writeReviewed = (r) => writeFileSync(REVIEWED, JSON.stringify(r, null, 2) + "\n");
