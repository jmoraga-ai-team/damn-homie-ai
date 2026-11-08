// Secrets set with `wrangler secret put` (never in files).
interface Env {
	GOOGLE_CLIENT_ID: string;
	GOOGLE_CLIENT_SECRET: string;
	COOKIE_ENCRYPTION_KEY: string;
	GOOGLE_PICKER_KEY: string; // browser key for /pick, limited to the Picker API + our two sites
}
