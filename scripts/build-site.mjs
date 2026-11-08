// Builds the static site pages into ./site (node scripts/build-site.mjs). Plain HTML, no dependencies.
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const site = join(dirname(fileURLToPath(import.meta.url)), "..", "site");
mkdirSync(join(site, "files"), { recursive: true });

const NAV = [["/", "Home"], ["/install", "Install"], ["/privacy", "Privacy"], ["/terms", "Terms"], ["/feedback", "Feedback"]];
const MAIL = "roomforopinions@gmail.com";

const page = (file, path, title, desc, body) => {
	const nav = NAV.map(([h, n]) => `<a href="${h}"${h === path ? ' aria-current="page"' : ""}>${n}</a>`).join("");
	writeFileSync(join(site, file), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="description" content="${desc}"><meta name="theme-color" content="#120a1f"><link rel="icon" href="/logo.png" type="image/png"><link rel="stylesheet" href="/style.css"></head><body>
<header><img src="/logo.svg" alt="" width="44" height="44"><b>Damn Homie AI</b></header>
<nav aria-label="Main">${nav}</nav>
<main>
${body}
</main>
<footer><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/feedback">Feedback</a><p>Made by Jarod Moraga, Maui. Not affiliated with Anthropic, OpenAI, xAI or Google.</p></footer>
</body></html>
`);
};

writeFileSync(join(site, "style.css"), `:root{--bg:#120a1f;--card:#1e1233;--pink:#ff7ae6;--cyan:#5ff3ff;--mute:#d9cdf0}
*{box-sizing:border-box}
body{margin:0;background:radial-gradient(1200px 500px at 50% -10%,#3a1466 0,#120a1f 60%) fixed,var(--bg);color:#fff;font:20px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-text-size-adjust:100%}
header{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:2px solid #3b2368}
header img{width:44px;height:44px;border-radius:10px}
header b{font-size:22px;letter-spacing:.5px}
nav{display:flex;flex-wrap:wrap;gap:8px;padding:12px 18px}
nav a{padding:12px 16px;min-height:48px;border:2px solid var(--cyan);border-radius:12px;color:var(--cyan);text-decoration:none;font-weight:700}
nav a[aria-current=page]{background:var(--cyan);color:#120a1f}
main{padding:12px 18px 40px;max-width:720px;margin:0 auto}
h1{font-size:38px;line-height:1.15;margin:18px 0 10px;color:var(--pink);text-shadow:0 0 18px #ff4fd855}
h2{font-size:27px;margin:30px 0 8px;color:var(--cyan)}
h3{font-size:22px;margin:0 0 6px}
.mute{color:var(--mute)}
a{color:var(--cyan)}
a:focus-visible,button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:3px solid #fff;outline-offset:3px}
.card{background:var(--card);border:2px solid #3b2368;border-radius:16px;padding:16px 18px;margin:16px 0}
.btn{display:inline-block;min-height:52px;padding:14px 22px;margin:8px 8px 8px 0;border-radius:14px;background:var(--pink);color:#120a1f;font-weight:800;text-decoration:none;border:0;font-size:20px;font-family:inherit}
.btn.alt{background:transparent;color:var(--cyan);border:2px solid var(--cyan)}
code{background:#0b0615;border:1px solid #4b2f80;border-radius:8px;padding:3px 8px;word-break:break-all;color:#fff;font-family:ui-monospace,Consolas,monospace;font-size:18px}
.draft{background:#3a2a05;border:2px solid #ffd24a;border-radius:12px;padding:12px 16px}
ol,ul{padding-left:26px}li{margin:8px 0}
label{display:block;margin:14px 0 6px;font-weight:700}
input,textarea,select{width:100%;min-height:52px;font:inherit;padding:12px;border-radius:12px;border:2px solid #6a45b0;background:#0b0615;color:#fff}
textarea{min-height:150px}
footer{padding:24px 18px 40px;text-align:center;color:var(--mute);font-size:18px}
footer a{margin:0 8px}
`);

writeFileSync(join(site, "logo.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff4fd8"/><stop offset="1" stop-color="#5ff3ff"/></linearGradient></defs><rect width="512" height="512" rx="96" fill="#120a1f"/><circle cx="256" cy="200" r="120" fill="url(#g)"/><rect x="60" y="240" width="392" height="10" fill="#120a1f"/><rect x="60" y="280" width="392" height="16" fill="#120a1f"/><rect x="60" y="326" width="392" height="24" fill="#120a1f"/><text x="256" y="452" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="84" text-anchor="middle" fill="#fff">DH·AI</text></svg>
`);

page("index.html", "/", "Damn Homie AI: brain dump in, game plan out", "An AI memory that lives in your own Google Drive. Works with Claude, ChatGPT and Grok.", `
<h1>Brain dump in. Game plan out.</h1>
<p>Damn Homie AI is a helper for people whose brains run fast and messy. You talk or type everything out of your head. It sorts it into a short list of next steps, and <b>remembers you next time</b>.</p>
<a class="btn" href="/install">Set it up</a><a class="btn alt" href="/privacy">How your data is handled</a>
<h2>Who it is for</h2>
<p>Chaotic smart people. Neurodivergent brains (ADHD and friends). Anyone who has ten tabs open in their head and wants the next one thing.</p>
<h2>What it does</h2>
<ul>
<li><b>Save Point:</b> your quests, next steps and wins, loaded at the start of every chat.</li>
<li><b>My Rules:</b> how you like answers: short, numbered, one step at a time.</li>
<li><b>Projects:</b> a one-page summary plus a details doc for each big thing.</li>
<li><b>Daily tidy:</b> finished items move to an Archive so your list stays short.</li>
<li><b>Safety Homie:</b> it will not save keys, passwords, card numbers or ID numbers, and it asks before anything risky.</li>
</ul>
<div class="card"><h3>Your memory is yours</h3><p>Everything it remembers lives in a folder called <b>Damn Homie</b> in <b>your own Google Drive</b>. We only keep the sign-in key, locked. You can read, edit or delete your files any time.</p></div>
<h2>Works with</h2>
<p>Claude, ChatGPT and Grok. Same memory in all three.</p>
<a class="btn" href="/install">Set it up</a>
`);

page("install.html", "/install", "Install Damn Homie AI", "Add Damn Homie AI to Claude, ChatGPT or Grok in a minute.", `
<h1>Install</h1>
<p>Pick your AI. Setup is free. You sign in with Google once, and it can only see the files it makes.</p>
<div class="card"><h3>The link you paste</h3><p><code>https://ai.damnhomie.com/mcp</code></p><p class="mute">Name it <b>Damn Homie AI</b>.</p></div>
<h2>Claude</h2>
<ol><li>Open <b>Customize</b>, then <b>Connectors</b>.</li><li>Tap <b>+ Add</b>, then <b>Add custom connector</b>.</li><li>Name: <b>Damn Homie AI</b>. URL: the link above. Tap <b>Continue</b>, then <b>Add</b>.</li><li>Tap <b>Connect</b>, then <b>Approve</b>, and sign in with Google. <b>Check the Google Drive box</b> (Google leaves it unchecked), then tap <b>Continue</b>.</li><li>Start a chat and say: <b>Load my Save Point.</b></li></ol>
<h2>ChatGPT</h2>
<ol><li>Open <b>Settings</b>, then <b>Connectors</b>, then <b>Advanced</b>. Turn on <b>Developer mode</b>.</li><li>Tap <b>Create</b>. Name: <b>Damn Homie AI</b>. URL: the link above. Authentication: <b>OAuth</b>.</li><li>Sign in with Google. <b>Check the Google Drive box</b> (Google leaves it unchecked), then tap <b>Continue</b>.</li><li>In a new chat, add the connector and say: <b>Load my Save Point.</b></li></ol>
<h2>Grok</h2>
<ol><li>Go to <a href="https://grok.com/connectors">grok.com/connectors</a>. It opens <b>Connect Apps</b>.</li><li>Scroll to the bottom and tap <b>Add a custom connector</b>.</li><li>Name: <b>Damn Homie AI</b>. Server URL: the link above. Tap <b>Add MCP</b>.</li><li>In the pop-up, tap <b>Approve</b> and sign in with Google. <b>Check the Google Drive box</b> (Google leaves it unchecked), then tap <b>Continue</b>.</li><li>Start a chat and say: <b>Load my Save Point.</b></li></ol>
<p class="mute">Menu names change as the apps update. If a button has moved, look for "connectors", "custom" or "MCP".</p>
<h2>No connector? Use the starter kit</h2>
<p>This is the first version. No sign-in: the AI keeps your Save Point where it can, or you paste it back yourself.</p>
<a class="btn" href="/files/damn-homie-ai.zip" download="damn-homie-ai.zip">Download the Claude skill (zip)</a>
<a class="btn alt" href="/files/one-prompt.txt">One prompt for ChatGPT, Grok, Gemini</a>
<a class="btn alt" href="/files/damn-homie-ai-setup-guide.pdf">Setup guide (PDF)</a>
<h2>Stop using it</h2>
<ol><li>Remove the connector in your AI app.</li><li>Go to <a href="https://myaccount.google.com/connections">myaccount.google.com/connections</a> and remove <b>Damn Homie AI</b>.</li></ol>
<p>Your Drive files stay yours. Delete the <b>Damn Homie</b> folder if you want them gone.</p>
`);

page("privacy.html", "/privacy", "Privacy Policy: Damn Homie AI", "What Damn Homie AI stores, where, and how to delete it.", `
<h1>Privacy Policy</h1>
<p class="draft"><b>Draft.</b> Written by an AI, not a lawyer. It says in plain words what the app really does. Last updated: November 7, 2026.</p>
<h2>The short version</h2>
<ul><li>Your notes and memory live in <b>your own Google Drive</b>, in a folder called <b>Damn Homie</b>.</li><li>Our server keeps <b>only a locked sign-in grant</b>. No name, no email, no notes.</li><li>We do not sell, share or read your data.</li></ul>
<h2>Who we are</h2>
<p>Damn Homie AI is run by Jarod Moraga in Maui, Hawaii. Contact: <a href="mailto:${MAIL}">${MAIL}</a>.</p>
<h2>What you give Google permission to do</h2>
<p>When you sign in with Google, you allow one thing: the <code>drive.file</code> permission. It lets Damn Homie AI see and change <b>only the files it created</b> (or files you pick for it). It cannot see the rest of your Drive. We also get a basic sign-in ID from Google. We do not ask for your email, name, contacts or calendar.</p>
<h2>What we store on our server</h2>
<ul><li>Your Google access token and refresh token. They are encrypted by the sign-in library, with a key tied to your own token.</li><li>A one-way hash of your Google account ID, so the app knows it is you next time. It cannot be turned back into your ID.</li></ul>
<p>That is all. We store <b>no chats, no Save Point, no file contents, no name and no email</b>.</p>
<h2>What happens to what you say</h2>
<p>Your words go to the AI you chose (Claude, ChatGPT or Grok), under that company's own rules. When the AI saves a memory, our server passes it straight to your Google Drive and does not keep a copy. Before anything is written, the app blanks things that look like API keys, passwords, ID numbers and card numbers.</p>
<h2>Google API Limited Use</h2>
<p>Damn Homie AI's use of information received from Google APIs follows the <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including the Limited Use requirements. We use Google data only to run your memory inside the app. We do not use it for ads, sell it, or let people read it. We do not use it to train AI models.</p>
<h2>How to delete everything</h2>
<ol><li>Remove the connector in your AI app.</li><li>Go to <a href="https://myaccount.google.com/connections">myaccount.google.com/connections</a> and remove <b>Damn Homie AI</b>. This cancels our access.</li><li>Delete the <b>Damn Homie</b> folder in your Google Drive to erase your memory.</li><li>To also erase the locked sign-in grant we hold, email us and we will delete it.</li></ol>
<h2>Kids</h2>
<p>Damn Homie AI is not for children under 13.</p>
<h2>Changes</h2>
<p>If this changes we will update the date above. Questions: <a href="mailto:${MAIL}">${MAIL}</a>.</p>
`);

page("terms.html", "/terms", "Terms of Service: Damn Homie AI", "The rules for using Damn Homie AI.", `
<h1>Terms of Service</h1>
<p class="draft"><b>Draft.</b> Written by an AI, not a lawyer. Last updated: November 7, 2026.</p>
<h2>What this is</h2>
<p>Damn Homie AI is a free connector that gives your AI a memory in your own Google Drive. It is run by Jarod Moraga in Maui, Hawaii.</p>
<h2>Using it</h2>
<ul><li>You must be 13 or older.</li><li>You are responsible for what you save and what you ask the AI to do.</li><li>Do not use it to break the law, harm people, or attack the service.</li><li>Please do not save secrets (passwords, keys, card numbers). The app tries to block them, but it can miss.</li></ul>
<h2>It is free and it is not perfect</h2>
<p>The service is provided <b>"as is"</b>, with no promise it will always work, always be available, or never lose data. Keep copies of anything important. Your files are in your Drive, so you can always back them up.</p>
<h2>Not advice</h2>
<p>An AI writes the answers. They can be wrong. Damn Homie AI is not medical, legal, financial or mental health advice.</p>
<h2>Our limits</h2>
<p>To the most the law allows, we are not liable for lost data, lost time or other damage from using the service.</p>
<h2>Stopping</h2>
<p>You can stop any time (see <a href="/privacy">Privacy</a> for how to delete). We can change or shut down the service, or block someone who misuses it.</p>
<h2>Your data</h2>
<p>Your memory files belong to you. How we handle data is in the <a href="/privacy">Privacy Policy</a>.</p>
<h2>Contact</h2>
<p><a href="mailto:${MAIL}">${MAIL}</a></p>
`);

page("feedback.html", "/feedback", "Feedback: Damn Homie AI", "Found a bug or have an idea? Tell us.", `
<h1>🐞 Feedback</h1>
<p>Found a bug? Got an idea? Tell us. Short is fine.</p>
<form id="f">
<label for="k">What is it?</label>
<select id="k"><option>Bug</option><option>Idea</option><option>Something confusing</option><option>Love it</option></select>
<label for="m">What happened?</label>
<textarea id="m" placeholder="Which AI (Claude, ChatGPT, Grok)? What did you say? What did it do?"></textarea>
<p><button class="btn" type="submit">Email it</button></p>
</form>
<p class="mute">This opens your email app with the message ready. Do not include passwords or keys. Or write to <a href="mailto:${MAIL}">${MAIL}</a>.</p>
<script>
document.getElementById('f').addEventListener('submit',function(e){e.preventDefault();
var k=document.getElementById('k').value,m=document.getElementById('m').value;
location.href='mailto:${MAIL}?subject='+encodeURIComponent('Damn Homie AI: '+k)+'&body='+encodeURIComponent(m);});
</script>
`);
console.log("site built");
