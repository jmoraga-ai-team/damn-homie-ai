// Small worker-made pages in the site's look (big text, high contrast).

export const GOOGLE_APP_NUMBER = "415261767037"; // Google Cloud project number = Picker app id (public)

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function page(title: string, body: string, headers: Record<string, string> = {}, status = 200) {
	const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}: Damn Homie AI</title><meta name="theme-color" content="#120a1f"><link rel="icon" href="/logo.png" type="image/png"><link rel="stylesheet" href="/style.css"></head><body>
<header><img src="/logo.svg" alt="" width="44" height="44"><b>Damn Homie AI</b></header>
<main>${body}</main></body></html>`;
	return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", ...headers } });
}

// Google showed the Drive box unchecked (its default) and they left it that way.
export function driveBoxPage(retryUrl: string, setCookie: string) {
	return page(
		"Check the Drive box",
		`<h1>One more tap</h1>
<p>Damn Homie AI needs the <b>Google Drive</b> box checked. That is where your memory lives.</p>
<div class="card"><ol>
<li>Tap <b>Try again</b>.</li>
<li>Check the box next to <b>See, edit, create, and delete only the specific Google Drive files you use with this app</b>.</li>
<li>Tap <b>Continue</b>.</li>
</ol></div>
<p><a class="btn" href="${esc(retryUrl)}">Try again</a></p>
<p class="mute">It only sees files it makes in a folder called Damn Homie, plus files you pick. Never the rest of your Drive.</p>`,
		{ "Set-Cookie": setCookie },
		400,
	);
}

// /pick: Google file picker. drive.file only: picking a file is what lets the app read it.
export function pickPage(clientId: string, apiKey: string) {
	const cfg = JSON.stringify({ c: clientId, k: apiKey, a: GOOGLE_APP_NUMBER });
	return page(
		"Pick files",
		`<h1>Pick files for your AI</h1>
<p>Pick the Google Drive files you want Damn Homie AI to read. It can read only the files you pick here.</p>
<p><button class="btn" id="go" type="button">Pick files</button></p>
<div class="card" id="out" role="status" aria-live="polite"><p class="mute">Use the same Google account you signed in with.</p></div>
<script src="https://apis.google.com/js/api.js" async defer></script>
<script>
const C=${cfg};
const out=document.getElementById('out');
const say=(h)=>{out.innerHTML=h};
const esc=(s)=>s.replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
// Same-tab Google sign-in, no popup window. Google returns the token in the #fragment, which never reaches our server.
const h=new URLSearchParams(location.hash.slice(1));
if(location.hash)history.replaceState(null,'',location.pathname);
const want=sessionStorage.getItem('dhPick');sessionStorage.removeItem('dhPick');
document.getElementById('go').onclick=()=>{
  const s=crypto.randomUUID();sessionStorage.setItem('dhPick',s);
  location.href='https://accounts.google.com/o/oauth2/v2/auth?'+new URLSearchParams({client_id:C.c,redirect_uri:location.origin+'/pick',response_type:'token',scope:'https://www.googleapis.com/auth/drive.file',prompt:'select_account',state:s});
};
const pick=(t)=>{
  if(!window.gapi){setTimeout(()=>pick(t),300);return;}
  gapi.load('picker',()=>{
    new google.picker.PickerBuilder()
      .addView(new google.picker.DocsView().setIncludeFolders(true).setSelectFolderEnabled(false))
      .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
      .setOAuthToken(t).setDeveloperKey(C.k).setAppId(C.a)
      .setTitle('Pick files for Damn Homie AI')
      .setCallback((d)=>{
        if(d.action!==google.picker.Action.PICKED)return;
        const n=d.docs.map((x)=>x.name);
        say('<h2>Done</h2><p>Your AI can now read: <b>'+n.map(esc).join(', ')+'</b></p><p>Go back to your AI and say:</p><p><code>read my picked file '+esc(n[0])+'</code></p>');
      }).build().setVisible(true);
  });
};
if(h.get('error'))say('<p>Google sign-in did not finish. Tap <b>Pick files</b> again.</p>');
else if(h.get('access_token')){
  if(!want||h.get('state')!==want)say('<p>That sign-in was old. Tap <b>Pick files</b> again.</p>');
  else pick(h.get('access_token'));
}
</script>`,
	);
}
