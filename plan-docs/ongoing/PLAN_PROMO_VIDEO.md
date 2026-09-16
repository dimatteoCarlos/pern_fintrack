# PLAN — PROMOTIONAL VIDEO, AND WHETHER IT BECOMES A DEMO

**Opened 2026-08-16**, from the developer's request: a promotional video for
FinTrack that is attractive, professional and elegant, and an evaluation of
whether the same asset can serve as a live demo.

**Resumed 2026-09-15, moved out of `on-hold/`.** Two things changed since the
plan was parked: R53, the blocker that made beat 3 unfilmable (§4), shipped in
`d7cd81d` — confirmed in `PLAN_BUDGET_FRONTEND.md:164`, "the budget store
invalidated on a tracker write". And the developer brought a second, wider
brief: a breadth-first script covering FX, budget, pocket, debt, transfer,
portfolio, KPIs and export, at 20–30 seconds instead of 60–90, captured on a
Google Pixel 7 frame. §3, §5 and §7 are rewritten below to carry both plans
without silently dropping either one's reasoning.

This file lives under `plan-docs/ongoing/`, one of the three subfolders
`.gitignore` re-includes — it is tracked and takes the full commit gate, same
as any other file under `ongoing/`.

---

## 0. Setup — tools, installation, and the manual path

**No MCP server applies here.** None of the connected MCP servers (Gmail,
Google Calendar, Google Drive, Notion, Slack, Supabase, IBKR) does screen
capture, browser recording or video rendering. This is two local CLI tools,
not an MCP integration — anyone reading this expecting a `claude mcp add` step
can stop looking for one.

Two tools, one already in the repo, one a plain download. Both are chosen
because they are scriptable and deterministic — the same script produces the
same clip every time, which matters for a project whose whole premise (§5) is
that nothing on screen is fabricated.

### 0.1 — Capture: Playwright, already installed at `plan-docs/playwright`

`plan-docs/playwright/package.json` already depends on `playwright@^1.55.0` —
no new install. It exists today for browser verification scripts, not video,
so scene capture is a new use of an existing dependency, not a new dependency.

**Manual steps, no Claude involved:**

1. Start the app the way it normally runs locally — backend and frontend dev
   servers up, a seeded account signed in (§6A's dataset, once it exists as a
   fixture).
2. In `plan-docs/playwright/`, write one plain Node script per scene — not a
   Playwright *test*, a script that launches a browser, drives it, and exits.
   Minimum shape:

   ```js
   import { chromium } from 'playwright';

   const browser = await chromium.launch();
   const context = await browser.newContext({
     viewport: { width: 412, height: 915 },   // Pixel 7 CSS px, §5
     deviceScaleFactor: 2.625,
     recordVideo: { dir: 'output/raw', size: { width: 412, height: 915 } },
   });
   const page = await context.newPage();

   await page.goto('http://localhost:5173/fintrack/tracker');
   await page.getByLabel('Amount').fill('250.00');
   await page.getByLabel('Date').fill('2026-08-15');
   // ... every action the scene's chain needs, one line each ...

   await context.close();   // the recorded .webm only finalizes on close
   await browser.close();
   ```

3. Run it with `node scenes/fx-scene.js`. Repeat one script per row of §3B's
   scene table — `intro.js`, `fx-scene.js`, `budget-scene.js`, and so on. Each
   run drops one `.webm` into `output/raw/`.
4. Watch the raw clip before moving on. If a scene doesn't read cleanly at
   412×915, fix the script, not the plan — the frame size is decided (§5).

**Devtools must be closed during capture** — §4 item 5 is still open, and an
open devtools panel makes the `console.log` noise from `transactionController.js`
visible in the recording even though it never reaches the UI.

### 0.2 — Assembly: ffmpeg, CLI

Not installed by default on Windows. One-time setup:

```powershell
winget install Gyan.FFmpeg
```

**Manual steps, no Claude involved:**

1. Trim each raw clip to its exact scene duration from §3B's table:

   ```powershell
   ffmpeg -i output\raw\fx-scene.webm -ss 0 -t 5 -c:v libx264 output\scenes\fx.mp4
   ```

2. Build text cards as their own short clips rather than fighting `ffmpeg`'s
   built-in `drawtext` for the app's `Outfit` typeface — capture a styled
   `<div>` with the same Playwright setup (a static page, no app), so the
   card uses the exact token colors and font as the product (§5's craft rule).
3. Concatenate the scene list for one cut. Two list files, one per cut, so
   the 20s version is "fewer entries", never "shorter durations":

   ```text
   # scenes_30s.txt
   file 'scenes/intro.mp4'
   file 'scenes/fx.mp4'
   file 'scenes/budget.mp4'
   file 'scenes/pocket.mp4'
   file 'scenes/debt-transfer-portfolio.mp4'
   file 'scenes/kpis.mp4'
   file 'scenes/export.mp4'
   file 'scenes/outro.mp4'
   ```

   ```powershell
   ffmpeg -f concat -safe 0 -i scenes_30s.txt -c copy output\fintrack-promo-30s.mp4
   ```

4. Scale and pad to the final aspect ratio once Q6 is answered — a portrait
   master needs no crop; a 16:9 master needs the 412×915 capture padded or
   letterboxed, decided by Q6, not guessed here.

**On HyperFrames:** the developer's briefs keep naming it as the compositor.
It is not adopted here — it is a third-party skill (`npx skills add
heygen-com/hyperframes`) whose actual capabilities have not been verified
against this project's needs, whereas ffmpeg is confirmed to do the concrete
job §5.1 requires (stitch real captures, composite them into the phone-mockup
canvas, cut transitions, render final MP4) with zero unverified dependency.
If HyperFrames is verified later and does this better, it replaces ffmpeg
here — it is not ruled out, only not assumed.

**Why ffmpeg over a GUI editor:** a timeline built from `.txt` scene lists and
one-line trims is re-runnable end to end when a single scene changes — the 20s
cut is one edited text file and one command, not a re-export from a GUI
project file. A GUI editor (DaVinci Resolve, free) is the fallback for
whoever prefers dragging clips on a visual timeline over editing a list file,
but it does not get regenerated by re-running a script, which is the reason
this plan defaults to ffmpeg.

---

## 1. The two things being asked for, and why they are not one thing

| | Promotional video | Demo |
|---|---|---|
| What it is | A recorded, edited, scripted piece | A running instance a stranger can click |
| Who controls the path | We do | The visitor does |
| What it must survive | One take, edited | Every path, including the ones we did not think of |
| What it costs | Script, capture, edit | A seeded database, a read-only guest identity, a deploy, and every defect fixed rather than avoided |

**They share exactly one asset: the script.** The sequence that makes a good
video is the sequence a first-time visitor should be walked through, so writing
it once serves both. Everything after the script diverges.

**The honest evaluation of "can the video become the demo": not directly, and
the reason is worth stating.** A video is allowed to route around a defect — we
simply do not film that screen. A demo is not, because the visitor will click it.
So the video can ship on today's codebase with a chosen path, and the demo cannot
ship until §4 is closed. The video is the near-term deliverable; the demo is a
milestone the video's script defines the acceptance criteria for.

**A second constraint, added 2026-09-15: the video must never show functionality
FinTrack does not have.** A rendered clip that promises a live-updating budget
or a working export is a claim about the product, exactly like a screenshot in
a README. §4 exists so that claim is true, not so that it is merely convincing.

## 2. What FinTrack actually has to show

Ordered by how distinctive it is, not by how much work it took:

| # | What | Why it earns screen time |
|---|---|---|
| 1 | **Double-entry accounting under a personal-finance surface** | This is the thesis. Most personal finance apps track a number; this one keeps two sides balanced. The slack account is the proof and must never appear by name |
| 2 | **Budget as a live comparison, not a snapshot** | Spending is computed from transactions on every request. Nothing is ever "as of last sync" |
| 3 | **The month is the server's month, not the browser's** | The timezone work. Reads as a detail, lands as trust |
| 4 | **The financial semaphore** | Teal healthy, dusty red not. One visual grammar across the app |
| 5 | **The three budget levels** | Totals → categories → accounts, one request |
| 6 | Multi-currency with an FX origin trail | Real, but half-built. Show only if §4 clears it |

**Resolved 2026-09-15 (Q4/Q5): item 1 gets its own scene, but only in the
60–90s deliverable (§3A).** The 30s deliverable (§3B) carries it as a
0.5–1s visual transition — `€250 Expense → FX → Account → Ledger → Budget` —
without explaining it. The reasoning, from the developer: a 30s video has to
sell, a 60–90s video has to explain, and the double-entry thesis is
explanation, not a hook. Splitting it this way is why §3 is now two standing
deliverables instead of one script with two possible cuts.

## 3. The script

**Resolved 2026-09-15 (Q4): two standing deliverables, not one script with two
cuts.** §3A is now **"FinTrack — How it works"**, 60–90s, educational. §3B is
now **"FinTrack — What you can do"**, 30s, promotional. Neither is a trim of
the other — they carry different theses (§2) and neither is optional once the
other ships.

### 3A — "FinTrack — How it works", 60–90s, opened 2026-08-16, confirmed as a standing deliverable 2026-09-15

Target length **60–90 seconds**. A promo that needs two minutes is two promos.

| beat | seconds | on screen | what it says without saying it |
|---|---|---|---|
| 1 | 0–8 | The budget hero: amount, spent, remaining, the month badge | This app knows what month it is and what you have left |
| 2 | 8–25 | Drill: totals → a category → the accounts inside it | Depth exists and it is one gesture away |
| 3 | 25–45 | Record an expense in the tracker, return to budget, the figure has moved | **The money is connected.** This is the whole product in one cut |
| 4 | 45–60 | Open a transaction: the movement pill, the direction pill, the hero amount disagreeing with the pill on purpose | Two facts, not one. The app has a point of view about money |
| 5 | 60–75 | The accounting inventory, every account type in one place | It holds the whole picture, not one account |

**Beat 3 is the video.** It was also the beat that could not be filmed as of
2026-08-16 — see §4. **As of 2026-09-15, R53 is fixed and beat 3 is filmable.**

**Added 2026-09-15 (Q5) — beat 3.5, the double-entry scene, 15–20s, the
scene that only exists in this deliverable.** A movement is not "subtract
from one account" — it resolves through both sides of the ledger:

```
             MOVEMENT
                |
        +-------+-------+
        v               v
     SOURCE          DESTINATION
        |               |
        v               v
      DEBIT           CREDIT
        +-------+-------+
                v
          BALANCE / LEDGER
```

Not framed as an accounting lesson on screen — the diagram is the storyboard
note, not the on-screen text. What the viewer sees is the same transaction
from beat 3 resolving on both accounts it touches, so the takeaway is "this
app tracks a relationship between two accounts", not a vocabulary lesson.

### 3B — "FinTrack — What you can do", 30s, opened 2026-09-15

**Resolved 2026-09-15 (Q4): 30s is the only cut of this deliverable.** The
20s cut floated on 2026-09-15 is superseded — Q4 settled on exactly two
deliverables, 30s and 60–90s, not a 20s/30s pair. If a 20s social cut is
wanted later it comes back as its own decision, not a leftover column here.

| scene | seconds | what one scene must chain, not list |
|---|---|---|
| Intro | 0–3s | FinTrack, one line of positioning |
| Transaction + historical FX | 3–8s | Typed amount → resolved FX rate for that date → accounting-currency amount. Ends with the 0.5–1s double-entry hint (§3A beat 3.5's diagram, unexplained here): `€250 Expense → FX → Account → Ledger → Budget` |
| Expenses + budget | 8–12s | The FX'd transaction lands in a category, the category's budget bar moves. Continues the same chain, does not restart it |
| Pocket | 12–16s | Money allocated toward a goal, progress bar moves |
| Debt + transfer + portfolio | 16–20s | Three sub-beats, fast — recognition, not explanation |
| KPIs | 20–25s | Derived, not typed: income, expenses, savings, savings rate, net worth computed from the same dataset the earlier scenes used |
| Export | 25–28s | CSV / XLSX / PDF — the capability that actually shipped this cycle (`0e2c7eae`, `42b7118d`) |
| Outro | 28–30s | Brand frame |

**The chaining principle, stated once so it governs every scene:** a scene
earns its seconds by showing an input becoming a consequence downstream, not
by displaying a screen. The €250 hotel example from the brief — amount → FX →
accounting amount → category → budget bar moving — demonstrates four
capabilities in one continuous shot. Four separate screens of "here is FX",
"here is expenses", "here is budget" would cost the same seconds and teach
less. Every scene in the table above is written as a chain for this reason.

**Both ship — resolved, see above.** This deliverable does not wait for §3A
or vice versa; they answer different briefs (§1) and neither blocks the other.

**Added 2026-09-15, from the developer: account creation is not a scene of
nine, it is three.** Neither §3A's nor §3B's table has an "open an account"
beat — if one is filmed, it shows exactly one on-camera registration per
account type (bank, investment, income_source), never all nine of §6A's
demo accounts opened back to back. The other six exist already when the
camera starts. This is what `data/seed-demo-account.js` is for: it drives
the real UI to build the full nine-account dataset off camera, before any
capture script runs — the seed run itself is never the footage.

## 4. What must be true before the camera rolls

Filming around a defect is how a promo becomes a lie, and every item here is
already registered independently. None of them is new work invented by this plan.

| # | Blocker | Register | Blocks | Status, checked 2026-09-15 |
|---|---|---|---|---|
| 1 | The budget screen does not update after a tracker write | **R53** | Beat 3 (§3A) / the transaction→budget chain (§3B) | **Fixed**, `d7cd81d` |
| 2 | The accounting dashboard is one long list with no scroll restoration | **R52** | Beat 5 (§3A) | Not re-checked this pass |
| 3 | A transaction detail can print the same account as source and destination | Account-opening rows | Beat 4 (§3A) — only if an opening is opened on camera | Not re-checked this pass |
| 4 | `/fintrack/overview/accounts` is not a declared route | R52, adjacent finding | Any beat touching bank, income or investment grouping | Route now exists in `App.tsx` — looks closed, not verified end-to-end |
| 5 | A live `console.log` on the transaction detail fetch | `transactionController.js:926` | Nothing on screen — but visible in any recording with devtools open | **Still open.** `transactionController.js` carries active `console.log` calls at lines 69, 183, 264, 300, 335, 724, 743–748, 981 and 1127 — several tagged `🔍`/`🚀`. Any capture must run with devtools closed, or these get fixed first |
| 6 | Seed data that reads as a real person's finances | — | Everything | Not re-checked this pass — see §6A below, which now has a concrete answer for §3B |

**Item 6 now has an answer for the breadth-first script, from the developer's
brief: a single fictional dataset object** (`accounts / income / expenses /
budgets / debts / pockets / investments`), with every on-screen figure —
including KPIs — **derived from it, never typed**. This is stronger than the
2026-08-16 plan's "a deliberate, coherent set", because it makes internal
consistency mechanical instead of something an editor has to get right by eye.
It does not replace the requirement that the figures still look like a real
person's finances, not a test bed's.

**The historical FX rate is a named risk, not a detail.** The brief's own FX
scene example (`€250 → 1 EUR = 1.1684 USD → $292.10`) is illustrative. Before
that number is filmed, it must be checked against FinTrack's actual historical
FX resolution for that date — the same rule the retrofecha work already
enforces in production (`plan-docs/completed/PLAN_BACKDATING`). A promo that
shows a fabricated rate under a feature called "historical FX" is exactly the
lie §4's opening line warns about.

## 5. Craft — what makes it read as professional

| aspect | decision |
|---|---|
| Capture | Real app in a real browser. Never a mockup, never a Figma export, never a hand-built HTML/CSS/JS recreation of the UI — the product's credibility is that it runs |
| **Frame, revised 2026-09-15** | **Google Pixel 7 CSS viewport: 412 × 915, device pixel ratio 2.625.** This sits inside FinTrack's mobile-first floor (360px, next step 480px per `frontend/CLAUDE.md:11`) — capturing at 412px renders the shipped base layout, not an undesigned intermediate width. **600×800 was considered and rejected**: 600px falls in the 480–768 band, which is not the mobile-first layout the video is meant to show — it renders the 480px layout stretched to 600, a width the design system never targeted as its own step. Height is not the deciding factor either way; both 800 and 915 clear the 735 and 568 degradation floors |
| Frame rate | 60fps capture. The motion tokens are 150–300ms and read as stutter at 30 |
| Cursor | Hidden. Motion is driven by cuts, not by watching a pointer travel |
| Typography in titles | The app's own `Outfit`. A promo in a different typeface than the product is a promo for something else |
| Palette | The app's tokens, nothing invented. Dark ground, teal and dusty red as the only accents |
| Motion | Cuts on the app's own transitions, not added ones. The product already animates; a second animation grammar on top of it is the thing that makes software promos feel fake |
| Audio | One track, no voice-over in v1. A voice-over locks the language, and the audience for this is not settled (§7 Q1) |
| Text on screen | Four words or fewer per card |
| **Per-action caption, added 2026-09-15** | **Every on-camera action gets its own short caption band, in English, naming what that action does** — e.g. the FX scene's typed amount gets a caption for the FX resolution step, the budget scene's category drop gets one for the bar moving. Composition layer only (§5.1's rule: HTML/CSS/JS never touches app UI), rendered as a text band over or beside the capture, not baked into the FinTrack screen itself. Scoped to these per-action bands — it does not resolve §7 Q1/Q2 (audience, overall video language), which govern voice-over and title-card language, not this caption's |
| **Aspect, resolved 2026-09-15 (Q6)** | **Three masters, not one with crops: 1920×1080 (16:9, desktop/YouTube), 1080×1920 (9:16, social vertical), 1080×2400 (9:20, Pixel 7-exact).** Reasoning below — this is a composition decision, and it opens a new question the developer's proposal did not settle (§7 Q6b) |

### 5.1 — three masters from one capture, not three rebuilt UIs

**Confirmed 2026-09-15.** Capture once, at 412×915 (§5, §0.1). That single
real recording is the only source of on-screen product UI in all three
masters, and in both deliverables (§3A and §3B alike — "same principle" is
the developer's own phrase for the 60–90s master). The three masters differ
in what surrounds that recording on the canvas, never in what the recording
shows:

| master | treatment | on-screen UI |
|---|---|---|
| 9:20 — 1080×2400, Pixel 7 | The 412×915 capture fills the frame directly, scaled — no composition needed, this is the native shape | 100% real |
| 9:16 — 1080×1920 | Same capture, light crop/letterbox top-bottom, not a redesign | 100% real |
| 16:9 — 1920×1080 (both §3A and §3B) | Capture sits inside a **phone-mockup composition** — bezel, shadow, background, external text and KPI callouts live beside it in HTML/CSS/JS; the phone's screen area is the untouched real recording | 100% real |

**The governing rule, stated once so nothing downstream re-litigates it:**

> **FinTrack UI is the source of truth. Video composition is HTML/CSS/JS.**
> HTML/CSS/JS builds the phone bezel, the background, the external text, the
> zoom and the transitions — never the form, the screen, or a single pixel
> that claims to be FinTrack's interface. `Never recreate, redraw, or
> approximate the FinTrack application UI in HTML/CSS/JS` is the literal
> instruction this becomes for whoever builds the composition step.

**Interactive scenes (§3B's transaction+FX chain, §3A's beat 3 and 3.5) are
built the same way, at the level of a shot, not a whole scene:** several
short real captures — form empty, `€250` typed, FX rate resolved, saved and
in the list — stitched with crossfades/cuts rather than one continuous take,
when a continuous take isn't practical to script. The stitching is
composition; every frame inside each cut is still a real capture.

**Confirmed project structure**, composition kept structurally separate from
capture so the distinction in the rule above is enforced by the file tree,
not just by convention:

```
fintrack-video/
├── captures/        (raw real recordings, one dir per scene subject)
│   ├── transaction/  fx/  budget/  pocket/
│   └── debt/  portfolio/  kpis/  export/
├── scenes/          (trimmed/stitched cuts built from captures/, per §3A/§3B beat)
├── composition/     (bezel, background, text, transitions — never app UI)
│   ├── phone-mockup/  landscape/  portrait/  pixel7/
├── data/
│   └── demo-data.js  (§6A)
├── index.html / styles.css / script.js   (composition layer only)
└── output/
```

## 6. Data

### 6A — the fictional demo dataset (2026-09-15, for §3B)

One object, one source of truth, matching the developer's brief:

```
demoData = {
  period, accountingCurrency,
  accounts, income, expenses, budgets,
  debts, transfers, pockets, investments, fxTransactions
}
```

Every derived figure — category totals, budget remaining, pocket progress,
portfolio P&L, savings, savings rate, net worth — is computed from this object,
never hand-typed into a scene. This is what makes the KPI scene (§3B) honest:
`savings = income − expenses`, `savingsRate = savings / income`, and both must
visibly come from the same numbers the earlier scenes already showed.

**Still open:** whether this object lives as a checked-in fixture usable by
both the video project and, later, any seeded demo tenant (§6 of the original
plan, now §... see below), or is video-only and thrown away after rendering.

### 6B — if it becomes a demo — what that additionally requires

| # | Requirement | State |
|---|---|---|
| 1 | Every §4 blocker fixed rather than avoided | Open — item 5 (console.log) still open as of this pass |
| 2 | A deployed instance | Supabase untouched by decision (D4). `on-hold/PLAN_DEPLOYMENT/PLAN_SUPABASE_MIGRATION.md` fires first |
| 3 | A guest identity that cannot damage the data | Does not exist. Either a per-visitor seeded tenant or a hard read-only mode |
| 4 | Rate limiting that actually limits | **R23** — `authLimiter` protects nobody today |
| 5 | `/api/db-test` and `/api/health`'s `step` field removed | **R7**, **R6** — both public, both reconnaissance |
| 6 | A reset job, so visitor N+1 does not inherit visitor N's mess | Does not exist |

**Read the dependency honestly:** the demo is gated on the production merge
chain, which is gated on the timezone rollout (D2), which is gated on the budget
module closing. The video is not. That is the whole argument for building the
video first.

## 7. Open questions

| # | question |
|---|---|
| Q1 | **Audience.** A recruiter watching a portfolio piece and a prospective user evaluating a product want opposite videos. The first wants to see the architecture; the second must never notice it exists |
| Q2 | **Language.** Spanish, English, or a silent cut with text cards that can be swapped per language. Q1 decides it |
| ~~Q3~~ | **Resolved 2026-09-15 — the developer confirms the budget module is closed.** Filming is not gated on it. (Note: `plan-docs/ongoing/PLAN_BUDGET/` still exists as a folder name — if it should move to `completed/`, that is that plan's own housekeeping, not this one's.) |
| ~~Q4~~ | **Resolved 2026-09-15.** Two standing deliverables — §3A ("How it works", 60–90s) and §3B ("What you can do", 30s). Neither is a cut of the other |
| ~~Q5~~ | **Resolved 2026-09-15.** Double-entry gets a full scene (beat 3.5) in §3A only; §3B carries a 0.5–1s unexplained visual hint |
| ~~Q6~~ | **Resolved 2026-09-15.** Three masters — 16:9, 9:16, 9:20 — detailed in §5.1 |
| ~~Q6b~~ | **Resolved 2026-09-15.** Composition confirmed over UI rebuild — §5.1's table and governing rule (`FinTrack UI is the source of truth. Video composition is HTML/CSS/JS.`) stand for both deliverables and all three masters |
| ~~Q7~~ | **Resolved 2026-09-15.** Repo storage: `docs/VIDEO/`, gitignored, one subfolder per video named for what it is — e.g. `docs/VIDEO/promo-30s/`, `docs/VIDEO/how-it-works-60s/`, each holding that video's own `captures/scenes/composition/output` (§5.1's tree, nested one level under the video's name). Public placement: **README**, via a `<video controls>` embed using a GitHub-attachment URL (upload the rendered mp4 through the GitHub web editor to get a `user-images.githubusercontent.com` link), not a link out to YouTube. **In-app placement, also decided:** a "watch demo" link/icon next to the sign-in/sign-up badges on the existing `authPage` — not the split-screen hero pattern (Stripe/Mercury-style), which would mean redesigning `authPage` and is explicitly out of this plan's scope. Landing page and portfolio are **not** destinations — neither exists today and neither is being built for this. The `authPage` link is its own small frontend task, downstream of this plan (consumes the finished 30s master), not part of video production itself |

## 8. Where this sits against other work

**Correction, 2026-09-15: "D7" and "D4" below were carried over from the
2026-08-16 draft as if they named global project directives. They do not —
the only D7 and D4 findable in `plan-docs/` are local decision labels inside
`CROSS_PLAN_MATRIX.md` (budget-board month visibility, and where a
delete-from-detail-view returns to), unrelated to either point made here.
The two points themselves are kept, renamed to what they actually are.**

- **The budget-module gate is lifted.** The 2026-08-16 draft held this plan
  until the budget module closed. The developer confirms, 2026-09-15, that it
  is closed — filming is not gated on it (§7, was Q3).
- **The fictional dataset (§4 item 6 / §6A)** is built on the local database
  or a standalone fixture object — never a migration, never production data.
- This block is **not** part of `feat/budget`. It executes on its own branch.
