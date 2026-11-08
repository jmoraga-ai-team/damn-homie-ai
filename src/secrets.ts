// Safety Homie, server side: nothing that looks like a key, password, card or ID number
// ever reaches the person's Drive, even if the AI forgets the rule.
const PATTERNS: RegExp[] = [
	/\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{16,}/g, // OpenAI / Anthropic keys
	/\bxai-[A-Za-z0-9]{20,}/g, // xAI
	/\bAIza[0-9A-Za-z_-]{30,}/g, // Google API key
	/\bAKIA[0-9A-Z]{16}\b/g, // AWS
	/\bgh[pousr]_[A-Za-z0-9]{30,}/g, // GitHub
	/\bxox[abpr]-[A-Za-z0-9-]{10,}/g, // Slack
	/\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}/g, // Stripe
	/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWT tokens
	/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
	/\b\d{3}-\d{2}-\d{4}\b/g, // US SSN
	/\b(?:password|passwd|pwd|passcode|pin)\s*(?:is|=|:)\s*\S+/gi,
];

function luhn(d: string) {
	let s = 0;
	for (let i = 0; i < d.length; i++) {
		let n = +d[d.length - 1 - i];
		if (i % 2) { n *= 2; if (n > 9) n -= 9; }
		s += n;
	}
	return s % 10 === 0;
}

export function scrub(text: string): { text: string; hits: number } {
	let hits = 0;
	let out = text;
	for (const p of PATTERNS) out = out.replace(p, () => { hits++; return "[secret removed]"; });
	// Card numbers: 13-19 digits (spaces/dashes ok) that pass the Luhn check.
	out = out.replace(/\b(?:\d[ -]?){12,18}\d\b/g, (m) => {
		const d = m.replace(/\D/g, "");
		if (d.length >= 13 && d.length <= 19 && luhn(d)) { hits++; return "[card number removed]"; }
		return m;
	});
	return { text: out, hits };
}
