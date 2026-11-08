# Damn Homie AI

Brain dump in, game plan out, and it remembers you next time.

Damn Homie AI is a remote MCP connector. Add it to Claude, ChatGPT or Grok and the AI gets a memory that lives in
**your own Google Drive**, not on our servers. One link: `https://ai.damnhomie.com/mcp`

## What it does

- **Save Point:** your quests, next steps and wins, loaded at the start of every chat.
- **My Rules:** how you like answers (short, numbered, one step at a time).
- **Projects:** a one-page summary plus a details doc for each big thing.
- **Daily tidy:** finished items move to Archive so the list stays short.
- **Safety Homie:** it won't save keys, passwords, card numbers or ID numbers, and it asks before anything risky.

Tools: `load_save_point`, `save_save_point`, `add_rule`, `log_decision`, `open_project`, `write_project`, `daily_tidy`.

## What is stored, and what is not

| Where | What |
|---|---|
| **Your Google Drive** | A `Damn Homie` folder with your Save Point, My Rules, Decisions, Wins, Archive and project docs. Everything you say worth keeping lives here, and you can read, edit or delete it any time. |
| **Our server (Cloudflare KV)** | Only the sign-in grant: your Google access and refresh token, encrypted by the OAuth library with a key tied to your own token. Your user id is a one-way hash of Google's account id. |
| **Never stored by us** | Your name, email, chats, Save Point or any file contents. |

Google permission is `drive.file` only: the connector can see **only the files it made** (or files you pick for it).
It cannot see the rest of your Drive. Sign-in is refused if you untick the Drive box.

To disconnect: remove the connector in your AI app, then remove "Damn Homie AI" at
https://myaccount.google.com/connections. Your Drive files stay yours.

## Self-host it (about 15 minutes)

You need: a free Cloudflare account, a domain on Cloudflare, Node 20+, and a Google Cloud OAuth app.

1. `git clone https://github.com/jmoraga-ai-team/damn-homie-ai && cd damn-homie-ai && npm ci`
2. In `wrangler.jsonc`, change `account_id`, the `routes` domain, `MCP_RESOURCE`, and make your own KV namespace:
   `npx wrangler kv namespace create OAUTH_KV` (put its id in `kv_namespaces`).
3. Google Cloud console: make an OAuth client (Web). Redirect URI: `https://<your-domain>/callback`.
   Scopes: `openid` and `https://www.googleapis.com/auth/drive.file`. Turn on the Google Drive API.
4. Secrets (never in files):
   ```
   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   npx wrangler secret put COOKIE_ENCRYPTION_KEY   # any long random string, e.g. openssl rand -hex 32
   ```
5. `npm test && npx tsc --noEmit`, then `npx wrangler deploy`.
6. Add `https://<your-domain>/mcp` as a custom connector in your AI app.

## Changing it

1. Edit `src/brain.ts` (the rules every AI follows) or the tools. Bump `VERSION`, write one `WHATS_NEW` line, add it to `CHANGELOG.md`.
2. `npm test` and `npx tsc --noEmit`.
3. Test copy first: `npm run deploy:test` (ai-test.damnhomie.com).
4. Open a pull request. It needs a review before it can merge to `main`.
5. Live: `npm run deploy`. It refuses unless you are on `main`, the tree is clean and the commit is exactly `origin/main`.

## Security

See [SECURITY.md](SECURITY.md) for how the live connector is protected, the daily check, and the off switch.
Found a problem? Use GitHub's **Report a vulnerability** button on this repo (private), not a public issue.

## License

MIT. See [LICENSE](LICENSE). The answer style comes from the open-source
[i-have-adhd](https://github.com/ayghri/i-have-adhd) skill by Ayoub Ghriss (MIT).
The sign-in plumbing started from Cloudflare's remote MCP + Google OAuth demo
([cloudflare/ai](https://github.com/cloudflare/ai), `demos/remote-mcp-google-oauth`).
