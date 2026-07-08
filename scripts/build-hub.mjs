import { readFileSync, writeFileSync } from 'node:fs';
const root = process.argv[2];
const read = f => readFileSync(root + '/' + f, 'utf8');
const b64 = f => readFileSync(root + '/' + f).toString('base64');

const kanbanRaw = read('kanban.html');
// Embed context is a read-only showcase: clear kanban's localStorage cache on load
// so the tab always renders the committed board-data, not a visitor's stale drag state.
// (Standalone kanban.html keeps its own persistence — this only affects the embedded copy.)
const kanbanForEmbed = kanbanRaw.replace(
  '<body>',
  '<body>\n<script>try{localStorage.removeItem("lifeos-kanban-v1")}catch(e){}</script>'
);
const kanban = Buffer.from(kanbanForEmbed).toString('base64');
const graph = b64('graphify-out/graph.html');

// live stats from the board's canonical data block
const board = JSON.parse(kanbanRaw.match(/<script id="board-data"[^>]*>\s*(\{[\s\S]*?\})\s*<\/script>/)[1]);
const byCol = id => board.cards.filter(c => c.column === id).length;
const stats = { done: byCol('done'), progress: byCol('progress'), ready: byCol('ready'), backlog: byCol('backlog'), total: board.cards.length };

const DOMAINS = [
  ['Building Things', '#5E5CE6'], ['Career', '#FF375F'], ['Growth', '#BF5AF2'],
  ['Life Admin', '#8E8E93'], ['Body & Mind', '#30D158'], ['Finance', '#FFD60A'],
  ['Relationship', '#FF9F0A'],
];

const GROUPS = [
  ['A', 'S2–S5', 'Grow the Task', 'done_when, priority, project, domain + seed', 'done'],
  ['B', 'S6–S10', 'Daily driver', 'NOW view, tab bar, tap-dot, warmth, balance brain', 'done'],
  ['C', 'S11–S13', 'The skin', 'Glass pass, smart capture, Pulse', 'done'],
  ['D', 'S14–S15', 'Vault is truth', 'Obsidian read + write over git-as-transport', 'done'],
  ['E', 'S16–S19', 'Telegram bot', 'text · confirm edits · photo · voice — all shipped', 'done'],
];

const FACES = [
  ['◈', 'PWA Dashboard', '#6ea8fe', 'Live &amp; hosted', 'The command center, deployed at <b>deepak-lakshmipathi.github.io/LifeOS</b>. A tab-navigated glass app: NOW queue, domain warmth, Pulse trends. Installs offline on Windows &amp; Android; clones your private vault in-browser through a self-hosted proxy.'],
  ['◎', 'Obsidian Vault', '#30D158', 'Source of truth', 'The raw markdown underneath. Every task is a <code>- [ ]</code> checkbox line in a project note; edit them by hand in Obsidian and the dashboard syncs.'],
  ['✧', 'Telegram Bot', '#FF9F0A', 'Live', 'Capture from anywhere by text, photo, or voice &mdash; Claude parses intent and writes to the vault, confirming before it edits or deletes. Group E shipped; awaiting live owner verification.'],
];

const FEATURES = [
  ['Balance-brain NOW', 'Priority-ranked, but capped ~2 tasks per domain with one ❄ rescue task pulled from your coldest domain so nothing rots.'],
  ['Tap-the-dot complete', 'Tap the ● → it fills to ✓ with a ring pulse, folds away, and a 3-second Undo toast catches mistakes.'],
  ['Domain warmth', 'Seven life domains heat when you act and cool when you don’t. Warmth is <i>derived</i> from recent completions, never logged.'],
  ['Smart capture', 'One field parses shorthand: <code>#domain</code>, <code>!1&ndash;3</code> priority, <code>when…</code> finish line, <code>/project</code> &mdash; in any order.'],
  ['Pulse trends', 'Done-this-week count, a 7-day completions sparkline, and per-domain warmth standings. Read-only, all derived.'],
  ['Vault sync', 'Behind <code>VITE_VAULT=1</code> the Obsidian vault becomes the real backend &mdash; in-browser git clone, commit, and best-effort push.'],
  ['Telegram capture', 'Text, photo, or voice a task from anywhere. Claude classifies intent, transcribes voice (Whisper) and reads photos (vision), and confirms before any update or delete &mdash; writing straight to the same vault.'],
  ['Hosted &amp; installable', 'Live on GitHub Pages, auto-deployed on every push to <code>master</code>. Install it from the browser for a standalone offline app on desktop or phone.'],
  ['Your own git path', 'The vault PAT never touches a public bundle &mdash; it&rsquo;s entered once and kept in your browser, and git traffic flows only through a self-hosted Cloudflare Worker you control.'],
];

const shippedSlices = 19, totalSlices = 19;

const overview = `
<div class="wrap">
  <section class="hero reveal">
    <h1>Life<span class="os">OS</span></h1>
    <p class="tagline">One vault. Three faces. Your whole life, ranked by what matters <em>now</em>.</p>
    <p class="lede">A personal, Apple-feel life tracker for a single user &mdash; local-first, installable, and offline. An Obsidian markdown vault is the one source of truth; a glass PWA dashboard, a Telegram bot, and Obsidian itself are the three ways in.</p>
    <div class="progress-strip">
      <div class="groups">
        ${GROUPS.map(([g,,,,st]) => `<span class="grp grp--${st}" title="Group ${g}">${g}</span>`).join('')}
      </div>
      <div class="progress-meta">
        <b>${shippedSlices}/${totalSlices}</b> slices shipped
        <span class="sep">·</span> Groups A&ndash;E complete
        <span class="sep">·</span> ${stats.done} of ${stats.total} cards done
      </div>
    </div>
  </section>

  <section class="reveal">
    <h2>One vault, three faces</h2>
    <div class="faces">
      ${FACES.map(([ic,name,c,badge,desc]) => `
      <article class="face" style="--fc:${c}">
        <div class="face-top"><span class="face-ic">${ic}</span><span class="face-badge">${badge}</span></div>
        <h3>${name}</h3>
        <p>${desc}</p>
      </article>`).join('')}
    </div>
  </section>

  <section class="reveal">
    <h2>Seven life domains</h2>
    <p class="sub">Every task belongs to one. The balance brain keeps them all warm.</p>
    <div class="domains">
      ${DOMAINS.map(([n,c]) => `<span class="chip" style="--dc:${c}"><span class="chip-dot"></span>${n}</span>`).join('')}
    </div>
  </section>

  <section class="reveal">
    <h2>What&rsquo;s built</h2>
    <dl class="features">
      ${FEATURES.map(([t,d]) => `<div class="feat"><dt>${t}</dt><dd>${d}</dd></div>`).join('')}
    </dl>
  </section>

  <section class="reveal">
    <h2>Roadmap</h2>
    <ol class="roadmap">
      ${GROUPS.map(([g,sl,name,desc,st]) => `
      <li class="road road--${st}">
        <span class="road-tag">${g}</span>
        <div class="road-body">
          <div class="road-head"><b>${name}</b><span class="road-sl">${sl}</span><span class="road-st road-st--${st}">${st === 'done' ? 'Shipped' : 'Up next'}</span></div>
          <p>${desc}</p>
        </div>
      </li>`).join('')}
    </ol>
    <p class="stack">Built on <b>Vite</b> · React · TypeScript · Tailwind · Framer Motion · Dexie/IndexedDB · isomorphic-git.</p>
  </section>
</div>`;

const start = `
<div class="wrap prose">
  <h1>Get started &amp; test</h1>
  <p class="lede">The whole slice backbone (S1&ndash;S19) is shipped <b>and the dashboard is live on the internet</b> &mdash; PWA, vault sync, and the Telegram bot with all four capture modalities. This page is the <b>user-testing guide</b>: open (or install) the live app, then walk the checklist to verify the flow end&ndash;to&ndash;end. Local dev instructions follow for making changes.</p>

  <div class="callout">
    <h2 style="margin-top:0">0 &middot; It&rsquo;s live &mdash; just open it</h2>
    <p>The dashboard is hosted on GitHub Pages and auto-deploys on every push to <code>master</code>:</p>
    <p><a href="https://deepak-lakshmipathi.github.io/LifeOS/"><b>deepak-lakshmipathi.github.io/LifeOS</b></a></p>
    <ol class="steps">
      <li><b>Open it</b> on desktop or phone. On first load it prompts once for your <b>vault access token</b> (a GitHub fine-grained PAT for the vault repo, Contents: Read&nbsp;+&nbsp;Write). It&rsquo;s stored only in that browser &mdash; never in the app bundle.</li>
      <li>It clones your private vault (<code>LiveOS-VaultRepo</code>) in-browser through a <b>self-hosted Cloudflare Worker proxy</b>, then loads your tasks. Add or complete one and it commits + pushes straight back to the vault.</li>
      <li><b>Install it</b> &mdash; use the browser&rsquo;s &ldquo;Install app&rdquo; (address-bar icon or ⋮ menu) for a standalone, offline, full-screen app.</li>
    </ol>
    <p class="note">Wrong token or a load error? The app shows a panel with the reason and a <b>Re-enter token</b> button (clears the stored PAT and reloads). The PAT + all git traffic transit only your own Cloudflare account &mdash; not any third party.</p>
  </div>

  <h2>1 &middot; Run the dashboard locally (for changes)</h2>
  <p>The dashboard is a Vite + React + TypeScript PWA. From the repo root:</p>
  <pre><code>npm install
npm run dev            <span class="c"># dev server, hot reload</span>
npm run build &amp;&amp; npm run preview   <span class="c"># production build</span></code></pre>
  <p>Open the URL Vite prints (usually <code>http://localhost:5173</code>). On first run with an empty database it seeds <b>107 tasks</b> from <code>seed_tasks_detailed.json</code> (idempotent; add <code>?noseed</code> to skip).</p>

  <h3>Vault-backed mode</h3>
  <p>By default the app is local-only (IndexedDB). To make the <b>Obsidian vault the real source of truth</b> (git-as-transport read + write), copy <code>.env.example</code> &rarr; <code>.env</code> (gitignored), fill in <code>VITE_VAULT_REPO_URL</code>, <code>VITE_VAULT_PAT</code> (Contents: Read&nbsp;+&nbsp;Write) and the <code>VITE_VAULT_CORS_PROXY</code> URL, then:</p>
  <pre><code>VITE_VAULT=1 npm run dev</code></pre>
  <p class="note">Writes commit locally (offline-safe) and best-effort push. The hosted build gets the same config from CI env + the <code>VAULT_CORS_PROXY</code> repo variable &mdash; the PAT is entered at runtime and never baked in. The CORS proxy is the self-hosted Worker in <code>cors-proxy/</code> (see its README to deploy).</p>

  <h2>2 &middot; Run the Telegram bot</h2>
  <p>A standalone Node worker in <code>services/bot/</code> long-polls Telegram and writes to the <b>same vault</b> over its own git credential. Copy <code>.env.example</code> &rarr; <code>.env</code> (gitignored) and fill in all six secrets:</p>
  <pre><code>TELEGRAM_BOT_TOKEN         <span class="c"># from @BotFather</span>
BOT_VAULT_PAT              <span class="c"># vault-repo PAT (Contents: R+W), separate from the PWA's</span>
BOT_VAULT_REPO_URL         <span class="c"># same vault repo the PWA points at</span>
ANTHROPIC_API_KEY          <span class="c"># Claude — NLU + photo vision</span>
GROQ_API_KEY               <span class="c"># Whisper — voice transcription</span>
OWNER_TELEGRAM_CHAT_ID     <span class="c"># your chat id (via @userinfobot); every other id is ignored</span></code></pre>
  <pre><code>cd services/bot &amp;&amp; npm install &amp;&amp; npm start</code></pre>
  <p class="note">The bot serves a single owner. Any chat id that isn&rsquo;t <code>OWNER_TELEGRAM_CHAT_ID</code> is a complete no-op &mdash; no reply, no Claude call, no vault write.</p>

  <h2>3 &middot; Dashboard walkthrough</h2>
  <p>A glass command center with a bottom tab bar: <b>Now &middot; Domains &middot; Pulse &middot; +</b>.</p>
  <ol class="steps">
    <li><b>Capture a task</b> &mdash; tap <b>+</b>. One field parses shorthand in any order: <code>#domain</code> (fuzzy-matched to one of 7; no match &rarr; Inbox), <code>!1</code>/<code>!2</code>/<code>!3</code> priority, <code>when &hellip;</code> or <code>~ &hellip;</code> for a &ldquo;done when&rdquo; finish line, <code>/project</code>, and the rest is the title. A live preview shows the parse before you commit. <span class="ex">e.g. <code>Book dentist #body !2 when confirmed /health-admin</code></span></li>
    <li><b>Work the NOW queue</b> &mdash; the <b>Now</b> tab is the balance brain: priority-ranked, capped ~2 per domain, injecting one &#10052; rescue task from your coldest domain. Top 3 live; the rest fold under &ldquo;Up next / Later&rdquo;.</li>
    <li><b>Complete a task</b> &mdash; tap the &#9679; dot. Ring pulse, fade-and-fold, a 3-second <b>Undo</b> toast. (Haptic buzz on mobile.)</li>
    <li><b>Read the map</b> &mdash; the <b>Domains</b> tab shows a warmth tile per domain: glow + a one-word state, hot &rarr; cold.</li>
    <li><b>See trends</b> &mdash; the <b>Pulse</b> tab: done-this-week count, a 7-day sparkline, and warmth standings.</li>
    <li><b>Install it</b> &mdash; use the browser&rsquo;s &ldquo;Install app&rdquo;; it runs offline, full-screen, like native.</li>
  </ol>

  <h2>4 &middot; Bot walkthrough</h2>
  <p>Message the bot from your owner account. It confirms every create, and <b>gates every edit and delete behind an explicit reply</b>.</p>
  <ol class="steps">
    <li><b>Text &rarr; create</b> &mdash; send a free-form task (<span class="ex"><code>call the CA about GST, life admin, high priority</code></span>). Claude classifies + extracts, writes a task line to the vault (real commit, non-empty <code>id::</code>), and replies <code>&#10003; added &hellip;</code>.</li>
    <li><b>Photo &rarr; vision</b> &mdash; send a photo (whiteboard, sticky notes, a list). Claude vision extracts the tasks (cap 20) and replies with a <b>numbered batch</b>. Reply <code>all</code>, <code>none</code>, or a subset (<code>1,3</code>) to choose which get created.</li>
    <li><b>Voice &rarr; transcribe</b> &mdash; send a voice note. Groq Whisper transcribes it; a confident transcript flows through the same create pipeline with the reply echoing <code>heard: &lsquo;&hellip;&rsquo; &rarr; &#10003; added</code>. A muffled/empty one short-circuits to &ldquo;mind typing it instead?&rdquo; &mdash; no write.</li>
    <li><b>Edit / delete &rarr; confirm</b> &mdash; ask to change or remove a task (<span class="ex"><code>mark call the CA done</code></span>, <code>delete the dentist task</code>). The bot fuzzy-matches the target, echoes the exact change, and waits: it only commits on a <code>y</code>. Ambiguous reference &rarr; a numbered candidate list; <code>n</code> or a 2-minute timeout cancels.</li>
  </ol>

  <h2>5 &middot; Testing checklist</h2>
  <h3>Dashboard (PWA)</h3>
  <ul class="check">
    <li>App loads and seeds tasks on first run (Now tab shows a ranked queue).</li>
    <li>Capture parses shorthand &mdash; type the example above, confirm the preview splits domain / priority / done-when / project.</li>
    <li>Complete a task &rarr; ring pulse plays, Undo toast appears, Undo restores it.</li>
    <li>Domains tab shows 7 tiles; completing a task warms its domain.</li>
    <li>Pulse count and sparkline update after completions.</li>
    <li>Reload the page &mdash; tasks survive (local persistence).</li>
    <li>Go offline (DevTools &rarr; Network &rarr; Offline) &mdash; the app still opens and works.</li>
    <li>Install as a PWA and launch it standalone.</li>
    <li><span class="dim">Vault mode:</span> add a task, then confirm it lands as a commit in the vault repo.</li>
  </ul>
  <h3>Telegram bot</h3>
  <p class="note">These exercise the live git-network + Telegram + Claude/Groq paths that CI can&rsquo;t reach &mdash; the owner-only sign-off before trusting the bot in production (full script: <code>afk-pipeline-out/s16c-verify-checklist.md</code>).</p>
  <ul class="check">
    <li><b>Text create</b> &rarr; a real commit lands (author <code>LifeOS Bot</code>, non-empty <code>id::</code>), pushes to the remote, and shows on the PWA (<code>VITE_VAULT=1</code>) after refresh; bot replies <code>&#10003; added</code>.</li>
    <li><b>Offline resilience</b> &mdash; cut the bot&rsquo;s network, text a task: it still replies <code>&#10003; added</code> (local commit); reconnect and the commit reaches the remote (not lost).</li>
    <li><b>Non-owner ignored</b> &mdash; message from a different account: no reply, no commit, no Claude call.</li>
    <li><b>Ambiguous domain &rarr; Inbox</b> &mdash; a task with no confident domain lands under <code>Inbox/</code>, and the reply shows <code>Inbox</code>.</li>
    <li><b>Photo batch</b> &mdash; a photo yields a numbered list; <code>all</code> creates every task, <code>none</code> cancels, <code>1,3</code> creates only that subset.</li>
    <li><b>Voice</b> &mdash; a clear voice note transcribes and creates (reply echoes <code>heard: &hellip;</code>); a muffled/empty one gets the retype prompt, no write.</li>
    <li><b>Confirm-gated edit/delete</b> &mdash; update/delete waits for <code>y</code>; <code>n</code> or timeout cancels with no write; a stale target (changed since asked) is rejected, not mis-applied.</li>
    <li>No secret (PAT, bot token, API keys) appears in the bot&rsquo;s logs; the local <code>.vault-clone/</code> is never committed to this repo.</li>
  </ul>
</div>`;

const shell = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LifeOS &mdash; Hub</title>
<style>
  :root{
    --bg:#0a0c11; --ink:#f0f2f8; --ink-soft:#c7cdda; --ink-dim:#9aa2b2;
    --accent:#6ea8fe; --accent-ink:#06101f;
    --line:rgba(255,255,255,.09); --line-strong:rgba(255,255,255,.15);
    --panel:rgba(255,255,255,.045); --panel-2:rgba(255,255,255,.028);
    --done:#3ad19b; --ease:cubic-bezier(.22,1,.36,1);
    --sp:clamp(20px,4vw,40px);
  }
  *{box-sizing:border-box}
  html,body{height:100%}
  body{
    margin:0; color:var(--ink);
    font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
    background:
      radial-gradient(1200px 640px at 15% -14%, #1a2740 0%, transparent 58%),
      radial-gradient(1000px 560px at 96% -10%, #281a38 0%, transparent 52%),
      radial-gradient(900px 900px at 50% 120%, #101a2e 0%, transparent 60%),
      var(--bg);
    display:flex; flex-direction:column;
  }
  ::selection{background:rgba(110,168,254,.28)}

  header{
    display:flex; align-items:center; gap:20px; padding:12px 20px;
    border-bottom:1px solid var(--line);
    background:rgba(10,12,17,.66); backdrop-filter:blur(18px) saturate(1.4);
    position:sticky; top:0; z-index:10; flex:0 0 auto;
  }
  .brand{font-size:16px; font-weight:660; letter-spacing:.2px; flex:0 0 auto}
  .brand .os{color:var(--accent)}
  nav{display:flex; gap:3px}
  .tab{
    font:inherit; font-size:13.5px; color:var(--ink-dim); cursor:pointer;
    background:transparent; border:1px solid transparent;
    padding:9px 15px; min-height:40px; border-radius:10px; white-space:nowrap;
    transition:color .18s var(--ease), background .18s var(--ease);
  }
  .tab:hover{color:var(--ink); background:var(--panel)}
  .tab:active{transform:translateY(.5px)}
  .tab:focus-visible{outline:2px solid var(--accent); outline-offset:2px}
  .tab[aria-selected="true"]{color:var(--accent-ink); background:var(--accent); font-weight:600}
  .spacer{flex:1}
  .hint{color:var(--ink-dim); font-size:12px; flex:0 1 auto; overflow:hidden; text-overflow:ellipsis; white-space:nowrap}

  main{position:relative; flex:1 1 auto; min-height:0}
  .panel{position:absolute; inset:0; display:none}
  .panel.active{display:block}
  .panel.scroll{overflow:auto; scroll-behavior:smooth}
  iframe{position:relative; width:100%; height:100%; border:0; display:block; background:var(--bg); z-index:1}
  .loading{position:absolute; inset:0; display:flex; gap:11px; align-items:center; justify-content:center; color:var(--ink-dim); font-size:13px; z-index:0}
  .loading::before{content:""; width:15px; height:15px; border-radius:50%; border:2px solid var(--line-strong); border-top-color:var(--accent); animation:spin .7s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}

  .wrap{max-width:1080px; margin:0 auto; padding:var(--sp) var(--sp) 96px}
  section{margin-top:clamp(44px,7vw,84px)}
  section:first-child{margin-top:0}
  h1{font-size:clamp(40px,7vw,60px); line-height:1.02; letter-spacing:-.03em; margin:0; text-wrap:balance}
  .os{color:var(--accent)}
  h2{font-size:clamp(21px,3vw,27px); letter-spacing:-.02em; margin:0 0 20px; text-wrap:balance}
  h3{font-size:16px; letter-spacing:-.01em; margin:0}
  .sub{color:var(--ink-dim); margin:-12px 0 22px; font-size:14.5px}

  .hero{padding-top:clamp(24px,6vw,56px)}
  .tagline{font-size:clamp(19px,2.6vw,25px); line-height:1.32; color:var(--ink); margin:22px 0 0; max-width:22ch; letter-spacing:-.01em; text-wrap:balance}
  .tagline em{color:var(--accent); font-style:normal}
  .lede{font-size:16.5px; color:var(--ink-soft); max-width:64ch; margin:18px 0 0; text-wrap:pretty}

  .progress-strip{display:flex; align-items:center; gap:18px; flex-wrap:wrap; margin-top:34px; padding-top:26px; border-top:1px solid var(--line)}
  .groups{display:flex; gap:7px}
  .grp{width:34px; height:34px; display:grid; place-items:center; border-radius:10px; font-size:13px; font-weight:700; border:1px solid var(--line-strong); color:var(--ink-dim)}
  .grp--done{background:color-mix(in oklab, var(--done) 20%, transparent); border-color:transparent; color:#bff4de}
  .grp--next{border-color:var(--accent); color:var(--accent)}
  .progress-meta{font-size:14px; color:var(--ink-dim)}
  .progress-meta b{color:var(--ink); font-variant-numeric:tabular-nums}
  .sep{opacity:.4; margin:0 4px}

  .faces{display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:16px}
  .face{border:1px solid var(--line); border-radius:16px; padding:20px; background:linear-gradient(180deg, color-mix(in oklab, var(--fc) 8%, transparent), var(--panel-2)); transition:border-color .2s var(--ease), transform .2s var(--ease)}
  .face:hover{border-color:color-mix(in oklab, var(--fc) 45%, transparent); transform:translateY(-2px)}
  .face-top{display:flex; align-items:center; justify-content:space-between; margin-bottom:14px}
  .face-ic{font-size:22px; color:var(--fc); line-height:1}
  .face-badge{font-size:11px; font-weight:600; letter-spacing:.02em; color:var(--fc); background:color-mix(in oklab, var(--fc) 16%, transparent); padding:3px 9px; border-radius:20px}
  .face h3{margin-bottom:8px}
  .face p{margin:0; color:var(--ink-soft); font-size:14px}
  .face code{font-family:ui-monospace,Menlo,Consolas,monospace; font-size:12.5px; background:rgba(255,255,255,.08); padding:1px 5px; border-radius:5px}

  .domains{display:flex; flex-wrap:wrap; gap:10px}
  .chip{display:inline-flex; align-items:center; gap:9px; padding:9px 15px 9px 12px; border-radius:12px; font-size:14px; font-weight:500; color:var(--ink); background:color-mix(in oklab, var(--dc) 12%, var(--panel)); border:1px solid color-mix(in oklab, var(--dc) 28%, transparent)}
  .chip-dot{width:9px; height:9px; border-radius:50%; background:var(--dc); box-shadow:0 0 12px color-mix(in oklab, var(--dc) 70%, transparent)}

  .features{display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:2px 40px; margin:0}
  .feat{padding:18px 0; border-top:1px solid var(--line)}
  .feat dt{font-weight:640; font-size:15px; margin-bottom:5px}
  .feat dd{margin:0; color:var(--ink-soft); font-size:14px}
  .feat code, .feat i{font-style:normal}
  .feat code{font-family:ui-monospace,Menlo,Consolas,monospace; font-size:12.5px; background:rgba(255,255,255,.08); padding:1px 5px; border-radius:5px}
  .feat i{color:var(--ink); font-style:italic}

  .roadmap{list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:2px}
  .road{display:flex; gap:16px; padding:16px 0; border-top:1px solid var(--line)}
  .road-tag{flex:0 0 34px; width:34px; height:34px; display:grid; place-items:center; border-radius:10px; font-weight:700; font-size:13px; background:color-mix(in oklab, var(--done) 18%, transparent); color:#bff4de}
  .road--next .road-tag{background:transparent; border:1px solid var(--accent); color:var(--accent)}
  .road-body{flex:1}
  .road-head{display:flex; align-items:center; gap:12px; flex-wrap:wrap}
  .road-head b{font-size:15.5px}
  .road-sl{font-family:ui-monospace,Menlo,Consolas,monospace; font-size:12px; color:var(--ink-dim)}
  .road-st{margin-left:auto; font-size:11px; font-weight:600; padding:2px 9px; border-radius:20px}
  .road-st--done{color:#bff4de; background:color-mix(in oklab, var(--done) 15%, transparent)}
  .road-st--next{color:var(--accent); background:color-mix(in oklab, var(--accent) 15%, transparent)}
  .road-body p{margin:5px 0 0; color:var(--ink-dim); font-size:14px}
  .stack{margin-top:28px; color:var(--ink-dim); font-size:14px}
  .stack b{color:var(--ink)}

  /* prose (get started) */
  .prose{max-width:76ch}
  .prose h1{font-size:clamp(32px,5vw,42px)}
  .prose h2{margin-top:clamp(38px,6vw,60px); padding-top:16px; border-top:1px solid var(--line)}
  .prose h3{margin:26px 0 8px; color:var(--ink-soft); font-size:16px}
  .prose>.lede{margin-bottom:8px}
  .prose p{color:var(--ink-soft)}
  .prose code{font-family:ui-monospace,Menlo,Consolas,monospace; font-size:13px; background:rgba(255,255,255,.07); padding:1.5px 6px; border-radius:6px; color:#dbe4ff}
  .prose pre{background:rgba(255,255,255,.035); border:1px solid var(--line); border-radius:12px; padding:14px 16px; overflow:auto; margin:12px 0}
  .prose pre code{background:none; padding:0; color:var(--ink-soft)}
  .prose pre .c{color:#8a93a3}
  .callout{background:color-mix(in oklab, var(--accent) 9%, transparent); border:1px solid color-mix(in oklab, var(--accent) 30%, transparent); border-radius:14px; padding:16px 20px; margin:18px 0}
  .callout a{color:var(--accent); font-weight:600}
  .note,.ex,.dim{font-size:13px; color:var(--ink-dim)}
  .ex{display:block; margin-top:6px}
  .ex code{background:color-mix(in oklab, var(--accent) 14%, transparent); color:#bcd3ff}
  .steps{padding-left:20px; margin:12px 0}
  .steps li{margin:11px 0; color:var(--ink-soft)}
  .steps li b{color:var(--ink)}
  ul.check{list-style:none; padding-left:0; margin:14px 0}
  ul.check li{position:relative; padding-left:29px; margin:9px 0; color:var(--ink-soft)}
  ul.check li::before{content:""; position:absolute; left:2px; top:6px; width:15px; height:15px; border:1.5px solid #3a4459; border-radius:5px; background:rgba(255,255,255,.03)}

  /* reveal: visible by default, enhanced only when JS present */
  body.js .reveal{opacity:0; transform:translateY(14px); transition:opacity .5s var(--ease), transform .5s var(--ease)}
  body.js .reveal.in{opacity:1; transform:none}
  @media (prefers-reduced-motion: reduce){
    *{transition:none !important; animation-duration:.01ms !important}
    body.js .reveal{opacity:1; transform:none}
  }
  @media (max-width:640px){
    header{gap:10px; padding:10px 13px}
    .hint{display:none}
    .tab{padding:9px 11px; font-size:13px}
  }
</style>
</head>
<body>
<header>
  <span class="brand">Life<span class="os">OS</span></span>
  <nav id="nav" role="tablist" aria-label="LifeOS views">
    <button class="tab" role="tab" id="tab-overview" aria-controls="panel-overview" data-tab="overview" aria-selected="true" tabindex="0">Overview</button>
    <button class="tab" role="tab" id="tab-start" aria-controls="panel-start" data-tab="start" aria-selected="false" tabindex="-1">Get Started</button>
    <button class="tab" role="tab" id="tab-kanban" aria-controls="panel-kanban" data-tab="kanban" aria-selected="false" tabindex="-1">Kanban</button>
    <button class="tab" role="tab" id="tab-graph" aria-controls="panel-graph" data-tab="graph" aria-selected="false" tabindex="-1">Knowledge Graph</button>
  </nav>
  <span class="spacer"></span>
  <span class="hint" id="hint"></span>
</header>
<main>
  <section class="panel scroll active" role="tabpanel" id="panel-overview" aria-labelledby="tab-overview" tabindex="0">${overview}</section>
  <section class="panel scroll" role="tabpanel" id="panel-start" aria-labelledby="tab-start" tabindex="0">${start}</section>
  <section class="panel" role="tabpanel" id="panel-kanban" aria-labelledby="tab-kanban"><div class="loading">Loading board</div></section>
  <section class="panel" role="tabpanel" id="panel-graph" aria-labelledby="tab-graph"><div class="loading">Loading graph</div></section>
</main>

<script id="src-kanban" type="application/octet-stream">${kanban}</script>
<script id="src-graph" type="application/octet-stream">${graph}</script>
<script>
  document.body.classList.add("js");
  const HINTS = {
    overview: "What LifeOS is",
    start: "Set up & test LifeOS",
    kanban: "Drag cards · double-click to edit · saves locally",
    graph: "Click a node to inspect · needs internet",
  };
  const TITLES = { kanban: "LifeOS Kanban board", graph: "LifeOS knowledge graph" };
  const tabs = [...document.querySelectorAll(".tab")];
  const loaded = {};
  function frameFor(tab){
    const bytes = Uint8Array.from(atob(document.getElementById("src-" + tab).textContent), c => c.charCodeAt(0));
    const html = new TextDecoder("utf-8").decode(bytes);
    const f = document.createElement("iframe");
    // srcdoc (not a blob URL) so the frame inherits this page's origin —
    // kanban.html reads localStorage, which throws on a blob's opaque origin.
    f.srcdoc = html; f.title = TITLES[tab] || tab;
    f.addEventListener("load", () => { const l = document.querySelector("#panel-" + tab + " .loading"); if(l) l.remove(); });
    return f;
  }
  function select(tab, focus){
    for(const b of tabs){
      const on = b.dataset.tab === tab;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
      if(on && focus) b.focus();
    }
    for(const p of document.querySelectorAll(".panel")) p.classList.remove("active");
    const panel = document.getElementById("panel-" + tab);
    panel.classList.add("active");
    if((tab === "kanban" || tab === "graph") && !loaded[tab]){ panel.appendChild(frameFor(tab)); loaded[tab] = true; }
    document.getElementById("hint").textContent = HINTS[tab] || "";
    history.replaceState(null, "", "#" + tab);
  }
  const nav = document.getElementById("nav");
  nav.addEventListener("click", e => { const b = e.target.closest(".tab"); if(b) select(b.dataset.tab); });
  nav.addEventListener("keydown", e => {
    const cur = (location.hash || "#overview").slice(1);
    const i = tabs.findIndex(t => t.dataset.tab === cur);
    let n = -1;
    if(e.key === "ArrowRight") n = (i + 1) % tabs.length;
    else if(e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
    else if(e.key === "Home") n = 0;
    else if(e.key === "End") n = tabs.length - 1;
    if(n >= 0){ e.preventDefault(); select(tabs[n].dataset.tab, true); }
  });

  // scroll reveal, progressive enhancement
  const io = new IntersectionObserver((entries) => {
    for(const en of entries){ if(en.isIntersecting){ en.target.classList.add("in"); io.unobserve(en.target); } }
  }, { rootMargin: "0px 0px -8% 0px", threshold: .04 });
  document.querySelectorAll(".reveal").forEach(el => io.observe(el));

  const initial = (location.hash || "#overview").slice(1);
  select(initial in HINTS ? initial : "overview");
</script>
</body>
</html>`;

writeFileSync(root + '/lifeos-hub.html', shell);
console.log('wrote lifeos-hub.html', (shell.length/1024).toFixed(0) + 'KB', '| board:', JSON.stringify(stats));
