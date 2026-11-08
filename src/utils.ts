// Sign-in data kept per user. It lives only inside the OAuth library's store in KV,
// encrypted with a key that only the user's own token can unlock. No name, no email, no content.
export type Props = {
	g: string; // Google access token (drive.file only)
	r?: string; // Google refresh token, so they stay signed in
	ttl?: number; // seconds the Google token lives
};

export const GOOGLE_SCOPE = "openid https://www.googleapis.com/auth/drive.file";

export function getUpstreamAuthorizeUrl(o: { upstreamUrl: string; clientId: string; scope: string; redirectUri: string; state?: string }) {
	const u = new URL(o.upstreamUrl);
	u.searchParams.set("client_id", o.clientId);
	u.searchParams.set("redirect_uri", o.redirectUri);
	u.searchParams.set("scope", o.scope);
	u.searchParams.set("response_type", "code");
	u.searchParams.set("access_type", "offline"); // gives a refresh token
	u.searchParams.set("prompt", "consent");
	u.searchParams.set("include_granted_scopes", "false");
	if (o.state) u.searchParams.set("state", o.state);
	return u.href;
}

type GoogleToken = { access_token: string; refresh_token?: string; expires_in?: number; id_token?: string; scope?: string };

async function tokenCall(body: Record<string, string>): Promise<GoogleToken | null> {
	const r = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams(body).toString(),
	});
	if (!r.ok) {
		console.log("google token error", r.status);
		return null;
	}
	return (await r.json()) as GoogleToken;
}

export function exchangeCode(env: Env, code: string, redirectUri: string) {
	return tokenCall({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, code, grant_type: "authorization_code", redirect_uri: redirectUri });
}

export async function refreshGoogle(env: Env, refreshToken: string): Promise<{ token: string; ttl: number } | null> {
	const t = await tokenCall({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: refreshToken, grant_type: "refresh_token" });
	return t?.access_token ? { token: t.access_token, ttl: Math.max(60, (t.expires_in || 3600) - 120) } : null;
}

// Stable user id without storing who they are: a hash of Google's account id.
export async function userIdFrom(idToken: string): Promise<string> {
	const payload = JSON.parse(atob(idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
	const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`damnhomie:${payload.sub}`));
	return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
