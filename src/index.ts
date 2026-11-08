import { env } from "cloudflare:workers";
import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler, getMcpAuthContext } from "agents/mcp/server";
import { z } from "zod";
import { SERVER_INSTRUCTIONS, VERSION } from "./brain";
import { Drive, SignInError } from "./drive";
import { GoogleHandler } from "./google-handler";
import { addLine, dailyTidy, loadSavePoint, openProject, saveSavePoint, writeProject } from "./tools";
import { refreshGoogle, type Props } from "./utils";

const WHEN = z.string().describe('Their local date and time now, like "2026-11-07 1:05 PM"');
const TODAY = z.string().describe('Their local date today, like "2026-11-07"');

function drive() {
	const p = getMcpAuthContext()?.props as Props | undefined;
	if (!p?.g) throw new SignInError("Not signed in. Reconnect Damn Homie AI.");
	return new Drive(p.g);
}

async function run(fn: (d: Drive) => Promise<string>) {
	try {
		const d = drive();
		let text = await fn(d);
		if (d.scrubbed) text += `

Safety Homie: blanked ${d.scrubbed} thing(s) that looked like a key, password, card or ID number before saving. Tell them in one line: "I won't save that."`;
		return { content: [{ type: "text" as const, text }] };
	} catch (e: any) {
		return { content: [{ type: "text" as const, text: `Memory error: ${e.message}. Tell them in one line and print their Save Point card so nothing is lost.` }], isError: true };
	}
}

function createServer() {
	const server = new McpServer({ name: "Damn Homie AI", version: VERSION }, { instructions: SERVER_INSTRUCTIONS });

	server.registerTool(
		"load_save_point",
		{
			title: "Load Save Point",
			description: "Call FIRST in every chat, before answering. Returns the Damn Homie AI rules to follow plus the person's Save Point and My Rules from their Google Drive.",
			inputSchema: z.object({ today: TODAY }),
			annotations: { readOnlyHint: true },
		},
		({ today }) => run((d) => loadSavePoint(d, today)),
	);

	server.registerTool(
		"save_save_point",
		{
			title: "Save",
			description: "Save the full Save Point card to their Drive. The server merges it with what is there (newest stamp per item wins, nothing lost). Also use to merge a pasted card.",
			inputSchema: z.object({
				card: z.string().describe("The full card text, === DAMN HOMIE SAVE POINT === to === END ==="),
				remove: z.array(z.string()).optional().describe("Item names to delete on purpose, only after they said yes"),
			}),
		},
		({ card, remove }) => run(async (d) => `Saved to your Drive.\n\nSave Code (print it only if they ask, or if Drive fails later):\n${(await saveSavePoint(d, card, remove)).text}`),
	);

	server.registerTool(
		"add_rule",
		{
			title: "Add rule",
			description: 'When they correct you or say how they like things. Saves it to My Rules. Then say "Got it, saved to My Rules."',
			inputSchema: z.object({ rule: z.string(), when: WHEN }),
		},
		({ rule, when }) => run(async (d) => { await addLine(d, "MY RULES", rule, when); return "Saved to My Rules."; }),
	);

	server.registerTool(
		"log_decision",
		{
			title: "Log decision",
			description: "When they decide something. Adds one dated line to Decisions (newest on top).",
			inputSchema: z.object({ decision: z.string(), when: WHEN }),
		},
		({ decision, when }) => run(async (d) => { await addLine(d, "DECISIONS", decision, when); return "Logged in Decisions."; }),
	);

	server.registerTool(
		"open_project",
		{
			title: "Open project",
			description: 'Open a quest\'s project doc only when that quest comes up. depth "summary" first; "full" or "details" only if the question needs it.',
			inputSchema: z.object({ name: z.string().describe("Quest name"), depth: z.enum(["summary", "full", "details"]).default("summary") }),
			annotations: { readOnlyHint: true },
		},
		({ name, depth }) => run((d) => openProject(d, name, depth)),
	);

	server.registerTool(
		"write_project",
		{
			title: "Write project",
			description: "Create or update a quest's project doc. Always give a 3-5 line summary (goal, where it stands, next step). Leave body out to keep the old body. details_add moves old detail into the details doc.",
			inputSchema: z.object({
				name: z.string(),
				summary: z.string(),
				body: z.string().optional(),
				details_add: z.string().optional(),
				when: WHEN,
			}),
		},
		({ name, summary, body, details_add, when }) => run((d) => writeProject(d, name, summary, body, details_add, when)),
	);

	server.registerTool(
		"daily_tidy",
		{
			title: "Daily tidy",
			description: "First chat of a new day (load_save_point says Tidy due: yes). Moves finished quests to Done and old parked ideas to Someday, keeps lists short, archives old lines. Never deletes.",
			inputSchema: z.object({ today: TODAY }),
		},
		({ today }) => run((d) => dailyTidy(d, today)),
	);

	return server;
}

const mcpHandler = createMcpHandler(createServer);

export default new OAuthProvider<Env>({
	apiHandler: {
		fetch(request: Request, env: Env, ctx: ExecutionContext) {
			return mcpHandler(request, env, ctx);
		},
	},
	apiRoute: "/mcp",
	authorizeEndpoint: "/authorize",
	clientRegistrationEndpoint: "/register",
	defaultHandler: GoogleHandler as any,
	tokenEndpoint: "/token",
	resourceMetadata: { resource: env.MCP_RESOURCE },
	accessTokenTTL: 3000,
	// Keep the Google token fresh: when the AI refreshes our token, we refresh Google's.
	async tokenExchangeCallback(o) {
		const p = o.props as Props;
		if (o.grantType === "refresh_token" && p?.r) {
			const g = await refreshGoogle(o.env as Env, p.r);
			if (g) return { newProps: { ...p, g: g.token }, accessTokenTTL: g.ttl };
		}
		if (o.grantType === "authorization_code" && p?.ttl) return { accessTokenTTL: p.ttl };
	},
});
