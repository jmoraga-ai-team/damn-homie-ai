# Security

## Report a problem

Use **Security > Report a vulnerability** on this GitHub repo. It stays private. Please don't open a public issue.

## How the live connector is protected

- **Small permissions.** Google `drive.file` only. No full-Drive access, ever.
- **No user content on our side.** Only the encrypted sign-in grant (see README).
- **Keys only in Cloudflare secrets.** Nothing secret is in this repo. GitHub secret scanning and push protection are on.
- **`main` protection (being switched on, 2026-11-07).** The rule set is written: no direct pushes, no force pushes,
  every change needs an approved pull request, outside pull requests never auto-merge. Until GitHub shows it on, treat `main` as unprotected.
- **Fewest dependencies, exact versions** (no `^`), with Dependabot alerts on.
- **Deploy only from `main`.** `npm run deploy` refuses anything that is not exactly `origin/main`.
- **Daily check, no AI.** `npm run check:live` compares the live worker's code hash with the last reviewed deploy
  and prints `MATCH` or `MISMATCH`. The maintainer runs it every morning and gets paged on a mismatch.

## Off switch

Pick one:

1. **Roll back** to the last good version: `npx wrangler rollback` (or Cloudflare dashboard > Workers > damn-homie-ai > Deployments > Rollback).
2. **Turn it off completely:** Cloudflare dashboard > Workers > damn-homie-ai > Settings > Domains & Routes > remove `ai.damnhomie.com`.
   Every AI loses the connector at once. Users' Drive files are untouched.
3. **Cut Google access for everyone:** Google Cloud console > the OAuth client > reset the client secret.
