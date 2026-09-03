# FinTrack Design System — Agent Reference Specification

Status: **normative for new code, descriptive for existing code.**
Source of truth: `frontend/src/**/*.css`, measured 2026-08-13.
Design origin: <https://www.figma.com/design/izE8HcSvsNFm3AVFErXWyP/Fintrack>

---

## 0. How to use this document

This is not a style guide to read. It is a **contract to execute**. An agent that
is handed this file must be able to produce a component that visually belongs in
FinTrack without opening Figma, without guessing a hex value, and without
inventing a spacing step.

The document is split into three layers that must never be confused:

| Layer | Sections | What it means for the agent |
| --- | --- | --- |
| **Normative** | §1 – §5 | The rules new code MUST follow. No exceptions without an explicit instruction from the developer. |
| **Descriptive** | §6 | What the codebase contains **today**. Read it to understand existing files. **Never extend it.** |
| **Defects** | §7 | Measured bugs. An agent that reproduces these is being faithful to the wrong thing. |

The blueprint in §8 is the block to paste into an agent's system prompt.

**The single most important instruction in this file:** FinTrack's current CSS is
*not* a token system. It is a hand-grown stylesheet with five duplicate spacing
scales, eleven undefined tokens in active use, and two unrelated palettes. §2's
token set is the **target**, and §9 states exactly what has to happen before an
agent may assume the tokens resolve. Until then, use the alias column in §6.2.

---

## 1. Non-negotiable rules

These are ordered by how much damage a violation does.

| # | Rule | Why |
| --- | --- | --- |
| R1 | **No hardcoded color.** Every `color`, `background-color`, `border-color` and `fill` consumes `var(--token)`. | A raw hex cannot be re-themed and cannot be audited. It is how a palette silently forks. |
| R2 | **No magic numbers for space or size.** Padding, margin and gap come from the spacing scale (§2.4). | `margin: 13px` is an unrepeatable decision. |
| R3 | **Never invent a token name.** If the value you need has no token, stop and ask. Do not create `--my-card-bg`. | Inventing local tokens is precisely how §6.3's five duplicate scales happened. |
| R4 | **1-space indentation** in every file, CSS included. | Project-wide standard (`CLAUDE.md`). |
| R5 | **Comments and identifiers in English.** | Project-wide standard. Existing Spanish comments are legacy, not a precedent. |
| R6 | **No decorative rules.** No `/* ===== */` banners, no emoji section headers. A comment states *why*, in one or two lines. | The current files are ~40% banner. It hides the code. |
| R7 | **No `!important`.** If specificity forces it, the selector is wrong. | 47 occurrences today; each one is a rule nobody can override. |
| R8 | **Mobile-first.** The base rule targets 360px. Every media query is `min-width`, growing upward. | §3. The app is a 22.5rem Figma frame first and a desktop layout second. |
| R9 | **Every interactive element declares all five states** (§4.1). A component without `:focus-visible` is incomplete, not "pending". | Accessibility is not a later commit. |
| R10 | **Animate only `transform` and `opacity`.** Plus `background-color`/`color` for state feedback. Never `width`, `height`, `top`, `left`. | Layout-triggering animations drop frames on the mobile viewport this app targets. |
| R11 | **One component, one stylesheet, one class prefix.** A component's CSS never styles an element it does not own. | Today `.box__title` is declared in three files at equal specificity and the winner depends on lazy-route load order. |
| R12 | **Never write into global `:root` from a component file.** | A deletion-flow leaf currently defines the global spacing scale. See §7.6. |

---

## 2. Token architecture

All tokens live in **one file**: `frontend/src/styles/tokens.css`, imported once
from `main.tsx` before every other stylesheet. Nothing else declares `:root`.

Naming grammar, applied without exception:

```
--{category}-{role}-{variant}
   |          |       |
   |          |       +-- optional: hover, active, subtle, strong
   |          +---------- semantic function, never appearance
   +--------------------- color | font | space | radius | border | shadow | z | motion
```

`--color-surface-card` is legal. `--color-dark-gray-2` is not: it names the
appearance, so it cannot survive a theme change.

### 2.1 Color — semantic layers

FinTrack is a **dark application with light content panels**. This inversion is
the core of its identity and the most common thing an agent gets wrong: the page
is near-black, but cards, headers and navbars are white or cream, and the text
inside them is near-black.

#### Surface — what a rectangle is painted with

| Token | Value | Where it is the surface today |
| --- | --- | --- |
| `--color-surface-app` | `#0d0f12` | `body` background, the whole viewport. Also the modal panel in `.transactionDetail__panel` |
| `--color-surface-raised` | `#161a22` | Panels sitting on the app surface (`.budgetLayout`, `.card__tile__pocket`) |
| `--color-surface-inverse` | `#ffffff` | Header (`.home__header`, `.layout__header`) and bottom navbar (`.mainNavbar__container`) |
| `--color-surface-panel` | `#e8e4da` | Cream data panels: `.summary__container`, `.displayScreen.light`, active navbar button |
| `--color-surface-overlay` | `rgba(17, 24, 39, 0.7)` | Modal scrim |
| `--color-surface-disabled` | `#cccccc` | Disabled control fill |

> These two carried the same value until the elevation pass separated them. A
> card floating over the page now reads one step lighter than the ground it sits
> on. They were always two tokens because they answer different questions; the
> pass is what made the difference visible.

#### Content — what sits on a surface

Content tokens are **paired to a surface**. Picking a content token without
knowing its surface is the single most frequent contrast failure.

| Token | Value | Valid on |
| --- | --- | --- |
| `--color-content-primary` | `#141414` | `inverse`, `panel` |
| `--color-content-secondary` | `#5b5b5b` | `panel`, `inverse` |
| `--color-content-on-dark` | `#ffffff` | `app`, `raised` |
| `--color-content-on-dark-muted` | `#e8e4da` | `app`, `raised` — subtitles and secondary figures |
| `--color-content-on-dark-subtle` | `#bdb1b1` | `app`, `raised` — tertiary tile subtitles |
| `--color-content-placeholder` | `#7f7f7f` | any input |

#### Interactive

| Token | Value | Use |
| --- | --- | --- |
| `--color-accent` | `#e8e4da` | Primary action fill (`.submit__btn`) |
| `--color-accent-content` | `#141414` | Text on `--color-accent` |
| `--color-interactive-hover` | `#00ffff` | Hover tint and focus ring |
| `--color-border-strong` | `#141414` | 2px outlines on light surfaces |
| `--color-border-inverse` | `#ffffff` | Dividers and outlines on dark surfaces |
| `--color-border-subtle` | `rgba(232, 228, 218, 0.26)` | Dashed separators inside panels |

#### Feedback and financial semaphore

The status square is FinTrack's signature indicator: a 0.75rem rounded square
that is teal when a figure is healthy and dusty red when it is not.

| Token | Value | Meaning |
| --- | --- | --- |
| `--color-status-ok` | `#5b8c93` | Within budget / positive balance |
| `--color-status-alert` | `#c97474` | Over budget / negative |
| `--color-status-error` | `#fc0c0c` | Validation failure |
| `--color-status-warning` | `#ffa500` | Non-blocking caution |
| `--color-status-success` | `#008000` | Completed operation |
| `--color-status-info` | `#60b1d6` | Non-blocking informative message |
| `--color-amount-positive` | `#5b8c93` | A remaining/left amount |
| `--color-amount-negative` | `#c97474` | An overspent amount |

> `--color-amount-positive` / `--color-amount-negative` are **live**. They carry
> the same values as `--color-financial-positive` / `--color-financial-negative`
> and the duplication is on the list to resolve, but they are the tokens the hero
> amount of the detail modals reads today, so nothing is removed until a
> replacement is in place. Separately, `summaryDetailBox-style.css:69,73` asks for
> `--amountPositive` / `--amountNegative`, which are **not defined anywhere** and
> render with no colour — see §7.1.

#### Financial effect — what a movement did to Net Worth

The effect is a property of the **movement type**, not of the sign a figure
carries in one account. A transfer between two of the owner's own accounts leaves
Net Worth exactly where it was, even though the origin account sees a negative
figure. Reading the effect off the sign is therefore wrong, and it is the mistake
this family exists to prevent.

| Token | Value | Meaning |
| --- | --- | --- |
| `--color-financial-positive` | `#5b8c93` | Net Worth went up |
| `--color-financial-negative` | `#c97474` | Net Worth went down |
| `--color-financial-neutral` | `#bdb1b1` | Value moved, Net Worth did not |
| `--color-financial-attention` | `#c49a5a` | A counterparty entered the picture |

`attention` is not a fourth direction. It marks a movement that involves someone
outside the owner's own accounts, and debt is the only one that does today.

Each effect also ships a **triad** — a ground, a border and a content colour — so
a pill can carry the effect as a filled shape while a plain figure keeps reading
the flat colour above. The two are separate on purpose: raising a pill's
legibility must not drag a hero amount up with it.

| Effect | `-surface` | `-border` | `-content` |
| --- | --- | --- | --- |
| positive | `#103a42` | `#3da5b8` | `#5fccdd` |
| negative | `#4d1614` | `#cc3833` | `#f4837b` |
| neutral | `#3a3131` | `#917978` | `#d8cdcd` |
| attention | `#473515` | `#c48e31` | `#f6bb55` |

> **The grounds are opaque, and that is a rule, not a preference.** A pill in this
> application sits on `--color-surface-app` (`#0d0f12`). A semi-transparent tint
> over a near-black ground composites to near-black: `rgba(2, 44, 34, 0.4)` over
> `#0d0f12` resolves to `#091b18`, which reads as black, not as the colour it
> names. Every `-content` / `-surface` pair above clears 4.5:1, which 12px bold
> uppercase requires.

**The mapping from the movement catalogue.** The catalogue stores nine types. Only
four rows are needed because everything unnamed moves value between the owner's
own accounts:

| `movement_type_name` | Effect | Why |
| --- | --- | --- |
| `income` | positive | Value enters from outside |
| `expense` | negative | Value leaves for outside |
| `debt` | attention | A counterparty is involved |
| `pnl` | positive **or** negative by the sign of `amount` | A gain and a loss are one type; only the sign separates them |
| everything else | neutral | Transfers between the owner's own accounts |

#### Movement direction — the second pill

A second pill states which way the money went **in this account**: a deposit or a
withdrawal, a borrow or a lend. It reads `transaction_type_name`, and it carries
its own colour from the badge family.

| Token | Value | Meaning |
| --- | --- | --- |
| `--color-badge-positive-surface` | `rgba(2, 44, 34, 0.4)` | Money came into this account |
| `--color-badge-positive-border` | `rgba(6, 95, 70, 0.5)` | |
| `--color-badge-positive-content` | `#34d399` | |
| `--color-badge-negative-surface` | `rgba(69, 10, 10, 0.4)` | Money left this account |
| `--color-badge-negative-border` | `rgba(153, 27, 27, 0.5)` | |
| `--color-badge-negative-content` | `#f87171` | |

**The two pills answer different questions and both are needed.** On a `lend` the
movement is `debt`, so the effect pill is ochre because a counterparty entered the
picture, while the direction pill is red because the money left. They disagree on
purpose, and collapsing them into one would lose whichever fact was dropped.

> Direction was briefly styled as a colourless outline, on the argument that the
> word inside the pill and the sign of the hero amount already state it. That was
> wrong on screen: in the four movement types whose effect is neutral by design —
> `pocket`, `transfer`, `investment`, `account-opening` — both pills then read grey
> and the modal lost every colour cue it had. Reverted. Do not re-derive the
> argument without checking the neutral case.

### 2.2 Theming

**FinTrack has no theme switcher, and this specification does not add one.**

`index.css:23` declares `color-scheme: light dark`, which only tells the browser
how to paint native controls and scrollbars. It does not switch anything in the
app. There is exactly one `prefers-color-scheme` block in the entire frontend and
it is inverted (§7.4).

The token file is nevertheless written so a theme can be added without touching a
single component, by following the three-state contract below. An agent asked to
add dark mode implements this and nothing else:

```css
/* Complete palette on bare :root. Every token gets its value here. */
:root {
 --color-surface-app: #1b1b1b;
 /* ...all tokens... */
}

/* System preference. Redefine ONLY the tokens that change. */
@media (prefers-color-scheme: light) {
 :root:not([data-theme='dark']) {
  --color-surface-app: #e8e4da;
 }
}

/* Explicit user choice wins in both directions. */
:root[data-theme='dark'] {
 --color-surface-app: #1b1b1b;
}
```

Rule: **no token may have its only definition inside a media query or a
`[data-theme]` block.** A token defined only there is `unset` in the default
state, and `var()` without a fallback yields the inherited value or nothing.

### 2.3 Typography

**Family.** One typeface, loaded from Google Fonts in `index.css:6`:

| Token | Value |
| --- | --- |
| `--font-family-sans` | `'Outfit', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif` |
| `--font-family-mono` | `'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace` |

Outfit is a variable font loaded across `100..900`. The mono family exists for
account identifiers and reference codes. **Monetary amounts use the sans family**
— this is a deliberate FinTrack choice, not an omission: amounts are rendered
through `numberFormatCurrency` and sit in flex rows that already align them.

**Scale.** Measured from 260 `font-size` declarations. Every size is a rem value;
`px` font sizes appear only in `auth/` (§6.4) and are not part of the system.

| Token | Size | Line height | Letter spacing | Used for |
| --- | --- | --- | --- | --- |
| `--font-size-2xs` | `0.625rem` | `1.2` | `1px` | Tile subtitles, currency badge |
| `--font-size-xs` | `0.75rem` | `1.3` | `0` | Summary subtitles, captions |
| `--font-size-sm` | `0.875rem` | `1.4` | `0.5px` | **Default UI size.** Labels, buttons, list rows |
| `--font-size-base` | `1rem` | `1.625rem` | `0` | Body copy, list titles |
| `--font-size-lg` | `1.25rem` | `1.3` | `0` | Card and section titles |
| `--font-size-xl` | `1.5rem` | `1.2` | `0` | Page headings |
| `--font-size-2xl` | `2rem` | `1.1` | `1px` | The total amount figure |

`--font-size-sm` at `0.875rem` is the workhorse: 52 of the measured declarations.
When in doubt about a label, it is this one.

**Weights.** Four permitted values. `bold`, `bolder`, `lighter` and `normal` are
forbidden — they are keyword aliases that defeat the variable font's axis.

| Token | Value | Use |
| --- | --- | --- |
| `--font-weight-regular` | `400` | Body, subtitles |
| `--font-weight-medium` | `500` | Emphasis inside a row |
| `--font-weight-semibold` | `600` | **Default for titles and buttons** |
| `--font-weight-bold` | `700` | Amounts, primary actions |

**Letter spacing.** FinTrack applies positive tracking to figures and labels:
`--letter-spacing-wide: 0.5px` (labels), `--letter-spacing-wider: 1px` (titles,
totals), `--letter-spacing-widest: 1.5px` (the summary amount row).

> **Inheritance trap.** `index.css:12-18` sets `font-size: 16px` on the universal
> selector `*`. A bare `<span>` therefore does **not** inherit the size of the
> line it sits in — it resets to 16px. Any inline element inside a sized parent
> must restate `font-size: inherit`. This is already documented in
> `summaryDetailBox-style.css:52-58`. See §7.5.

### 2.4 Spacing

Base unit **4px (0.25rem)**. The scale is linear to 8, then jumps.

| Token | Value | px |
| --- | --- | --- |
| `--space-1` | `0.25rem` | 4 |
| `--space-2` | `0.5rem` | 8 |
| `--space-3` | `0.75rem` | 12 |
| `--space-4` | `1rem` | 16 |
| `--space-5` | `1.25rem` | 20 |
| `--space-6` | `1.5rem` | 24 |
| `--space-8` | `2rem` | 32 |
| `--space-12` | `3rem` | 48 |
| `--space-16` | `4rem` | 64 |

Applies to `padding`, `margin`, `gap`, and to `top/right/bottom/left` on absolute
positioning. It does **not** apply to component dimensions (`width`, `height`),
which come from §2.5's sizing tokens or from the layout in §3.

Standard compositions, so an agent does not have to choose:

| Context | Value |
| --- | --- |
| Card / panel padding | `var(--space-3)` |
| Cream summary panel padding | `var(--space-2) var(--space-6)` |
| Gap between stacked list rows | `var(--space-3)` |
| Gap between label and value in a row | `var(--space-2)` |
| Gap between icon and label | `var(--space-1)` |
| Section vertical rhythm | `var(--space-4)` |

### 2.5 Radius, borders, elevation and size

**Radius.** `0.75rem` is FinTrack's card radius and the most frequent value in
the codebase.

| Token | Value | Use |
| --- | --- | --- |
| `--radius-xs` | `0.25rem` | Status square, chips |
| `--radius-sm` | `0.5rem` | Inputs, small buttons |
| `--radius-md` | `0.75rem` | **Default.** Buttons, panels, navbar items |
| `--radius-lg` | `0.875rem` | Summary container |
| `--radius-xl` | `1rem` | Page-level cards, navbar container |
| `--radius-full` | `9999px` | Pills, avatars, currency badge |

**Borders.** FinTrack separates by border, not by shadow, because most surfaces
are dark-on-dark.

| Token | Value |
| --- | --- |
| `--border-width-thin` | `1px` |
| `--border-width-thick` | `2px` |
| `--border-divider` | `1px solid var(--color-border-inverse)` |
| `--border-dashed` | `1px dashed var(--color-border-subtle)` |

**Elevation.** Reserved for content that floats over the page: modals, toasts,
tooltips, menus. **A card does not get a shadow.**

| Token | Value | Use |
| --- | --- | --- |
| `--shadow-sm` | `0 2px 8px rgba(0, 0, 0, 0.1)` | Menus, tooltips |
| `--shadow-md` | `0 4px 6px -1px rgba(0, 0, 0, 0.1)` | Raised buttons |
| `--shadow-lg` | `0 10px 15px -3px rgba(0, 0, 0, 0.1)` | Popovers, action sheets |
| `--shadow-overlay` | `0 25px 50px -12px rgba(0, 0, 0, 0.25)` | Modals |

**Sizing.** Fixed dimensions that recur and must not be re-derived:

| Token | Value | Component |
| --- | --- | --- |
| `--size-status-square` | `0.75rem` | Status indicator |
| `--size-icon` | `2rem` | `.iconContainer` |
| `--size-badge` | `2.5rem` | Currency badge |
| `--size-control-height` | `3.125rem` | Submit button, add/edit button |
| `--size-touch-target` | `2.75rem` | Minimum tappable area (44px) |

### 2.6 Motion

| Token | Value | Use |
| --- | --- | --- |
| `--motion-fast` | `150ms cubic-bezier(0.4, 0, 0.2, 1)` | Color and opacity feedback |
| `--motion-normal` | `200ms ease` | **Default.** Hover, active, layout shifts |
| `--motion-slow` | `300ms ease` | Entrances, modal transitions |
| `--motion-press` | `100ms ease-out` | The `:active` snap-back |

Two hard rules:

1. **Enumerate the properties.** `transition: background-color var(--motion-normal), transform var(--motion-normal);` — never `transition: all`. `all` animates properties you did not intend, including layout ones.
2. **Every animation honours reduced motion.** Ship this block with any component that transitions or animates:

```css
@media (prefers-reduced-motion: reduce) {
 .component {
  transition: none;
  animation: none;
 }
}
```

### 2.7 Z-index

An unmanaged `z-index` is how a modal ends up behind a navbar. The scale is
closed: eight values, and nothing outside them.

| Token | Value | Layer |
| --- | --- | --- |
| `--z-base` | `0` | Normal flow |
| `--z-raised` | `1` | Sticky header, back arrow |
| `--z-navbar` | `10` | Bottom navigation |
| `--z-dropdown` | `100` | Menus, date picker |
| `--z-overlay` | `500` | Scrims |
| `--z-modal` | `1000` | Dialogs |
| `--z-modal-popover` | `1050` | A layer opened from inside a dialog, above it |
| `--z-toast` | `1100` | Transient notifications |

Two elements on the **same** value do not have an undefined order — they have a
worse one: the browser falls back to document order and paints the later sibling
on top. That is a real ordering, and it is stable only while the document order
is. When the two elements are portalled into `<body>` by different owners, it is
not: see §7.10. A layer that must sit above another needs its own value, not the
same one.

There is no tooltip value, and that is deliberate. The shipped tooltip is not a
layer of the application: `.tooltip__wrapper--text` is `position: absolute`
inside its own trigger (`tooltip.css:11-26`), so its `z-index` orders it against
that trigger's siblings and never against a dialog. A scale value would promise
a stacking it cannot deliver, and would let a tooltip inside the navbar paint
over a modal. A tooltip that is ever portalled to `<body>` gets a value agreed
at that point, not one reserved now.

---

## 3. Layout and responsiveness

### 3.1 The frame

FinTrack is a **single-column mobile application that is centred, not stretched,
on wide viewports.** It never becomes a multi-column desktop layout.

| Token | Value | Meaning |
| --- | --- | --- |
| `--layout-width-min` | `22.5rem` (360px) | The Figma frame. The design target. |
| `--layout-width-max` | `40rem` (640px) | `.home__layout` max-width. Beyond this the column stops growing and centres. |
| `--layout-content-width` | `88%` | The width of every content block inside the frame. Cards, navbar, header content. |
| `--layout-top-space` | `2.75rem` | Status-bar gap above the header. Collapses to `0` on short viewports. |
| `--layout-header-height` | `12.5rem` | Fixed header block. |
| `--layout-navbar-top` | `5rem` | Tracker navbar. |
| `--layout-navbar-bottom` | `3.5rem` | Main bottom navbar. |

`88%` is not arbitrary and must not be rounded to 90%: it is the measured content
width of every container in the app, widened from the original Figma `81.11%`.

### 3.2 Breakpoints

**Width** — three, mobile-first, `min-width` only:

| Token | Value |
| --- | --- |
| `--bp-sm` | `480px` |
| `--bp-md` | `768px` |
| `--bp-lg` | `1024px` |

Custom properties do not work inside a media query condition. Write the literal
value and keep the token as the documented name:

```css
/* --bp-md */
@media (min-width: 768px) { }
```

**Height** — FinTrack's distinguishing feature, and the reason a naive agent
breaks it. The app is a full-height column with a fixed header and a sticky
bottom navbar, so it degrades by **viewport height**, not width:

| Token | Value | Behaviour below it |
| --- | --- | --- |
| `--bp-h-short` | `735px` | `--layout-top-space` collapses to `0` |
| `--bp-h-compact` | `730px` | Navbar padding and gaps tighten |
| `--bp-h-tiny` | `568px` | Icon sizes scale with the navbar height |

Any component that occupies vertical space in the main column must state what it
does below `735px`.

### 3.3 Layout primitives

Flexbox for component-internal arrangement, Grid for page-level regions.
The utility classes in `generalStyles.css` are the canonical row/column
compositions and should be reused rather than re-declared:

| Class | Composition |
| --- | --- |
| `.utility-flex-row-between` | row · center · space-between — **the list-row primitive** |
| `.utility-flex-row-center` | row · center · center |
| `.utility-flex-row-start` / `-end` | row · center · flex-start / flex-end |
| `.utility-flex-col-center` | column · center · center |
| `.utility-flex-col-space-between` | column · center · space-between |

The `.flx-*` family is the deprecated predecessor of these (§6.5).

### 3.4 Overflow

- The page **never** scrolls horizontally. Wide content (tables, code, long rows) scrolls inside its own `overflow-x: auto` container.
- Long user-authored text (account names, notes) wraps rather than overflowing: `overflow-wrap: anywhere; word-break: break-word;`. This is already applied to `.tile__subtitle` and `.box__subtitle` in `index.css:60-67`.
- The main column uses `min-height: 100dvh`, not `100vh` — `dvh` accounts for mobile browser chrome.

---

## 4. Component anatomy and states

### 4.1 The mandatory state matrix

Every interactive element implements all five rows. A missing row is a defect,
not a backlog item.

| State | Requirement | Canonical implementation |
| --- | --- | --- |
| **Default** | Base appearance from tokens only. | — |
| `:hover` | A visible change that is not a size change. | `opacity: 0.8` for filled controls, `color: var(--color-interactive-hover)` for text. |
| `:focus-visible` | **Mandatory.** A 2px ring, offset so it never touches the shape. | `outline: 2px solid var(--color-interactive-hover); outline-offset: 2px;` |
| `:active` | A tactile press. | `transform: scale(0.95);` or `translateY(2px)` with `--motion-press`. |
| `:disabled` | Visually inert and non-interactive. | `opacity: 0.5; cursor: not-allowed; pointer-events: none;` |

Notes that prevent the two most common mistakes:

- **`:focus-visible`, not `:focus`.** `:focus` draws the ring on mouse click too, which designers then remove with `outline: none`, and keyboard users lose the app. The precedent is `mainNavbar.css:99-102`.
- **`pointer-events: none` alone is not enough** on a `<button>`: keep the `disabled` attribute so it leaves the tab order. The CSS is the visual half of the contract.
- Disabled opacity is **0.5**. Two competing values exist today (0.5 and 0.7); 0.5 is normative.

### 4.2 The surface modifier idiom

This is FinTrack's most distinctive and least obvious convention, and an agent
that misses it will produce black text on a black card.

A component that can appear on either a dark or a light surface takes a modifier
naming **the surface it sits on**, not its own color:

```css
/* Sitting on a light surface: dark ink, dark outline. */
.icon-currency.light {
 border: var(--border-width-thick) solid var(--color-border-strong);
 color: var(--color-content-primary);
}

/* Sitting on the dark app surface: cream ink, cream outline. */
.icon-currency.dark {
 border: var(--border-width-thick) solid var(--color-content-on-dark-muted);
 color: var(--color-content-on-dark-muted);
}
```

Measured precedents: `.icon-currency.light/.dark` and its context aliases
`.tracker`/`.form`, `.displayScreen.light`, `.displayScreen--result.dark`,
`.iconArrowLeftDark`/`.iconArrowLeftLight`.

**Rule:** any new shared component that can land on both surfaces must expose
this pair. It must not read the surface from a parent selector.

### 4.3 Component contracts

Each entry states the anatomy an agent must produce.

#### Button — primary

Full-width control on the panel accent, used to submit a form.

| Property | Value |
| --- | --- |
| Height | `var(--size-control-height)` |
| Width | `100%` |
| Background / text | `var(--color-accent)` / `var(--color-accent-content)` |
| Radius | `var(--radius-md)` |
| Type | `var(--font-size-base)` · `var(--font-weight-bold)` · `text-transform: capitalize` |
| Disabled | `background: var(--color-surface-disabled)` · `opacity: 0.5` |

#### Button — outline

Adds or edits an entry from inside a dark panel.

| Property | Value |
| --- | --- |
| Background | `transparent` |
| Border | `var(--border-width-thick) solid var(--color-border-inverse)` |
| Radius | `var(--radius-md)` |
| Label | `var(--font-size-sm)` · `var(--color-content-on-dark)` · `--letter-spacing-wide` |

#### List row

The repeating unit of every budget, pocket and transaction list.

- Root uses `.utility-flex-row-between`, `width: 100%`.
- Separated by `border-bottom: var(--border-divider)`, padding `var(--space-1) 0`.
- **Left:** title `var(--font-size-base)` / `--color-content-on-dark` / `capitalize`; subtitle `var(--font-size-2xs)` / `--color-content-on-dark-subtle`.
- **Right:** figure right-aligned, `--letter-spacing-wider`; secondary line `var(--font-size-sm)` / `--color-content-on-dark-muted`.
- A row that is a link gets `cursor: pointer` and a hover color; it is never a bare `<div>` with an `onClick`.

#### Summary panel

The cream figure panel at the top of a detail screen.

| Property | Value |
| --- | --- |
| Background / text | `var(--color-surface-panel)` / `var(--color-content-primary)` |
| Radius / padding | `var(--radius-lg)` / `var(--space-2) var(--space-6)` |
| Layout | `flex`, `align-items: start`, `justify-content: space-between` |
| Title | `var(--font-size-lg)` · `--font-weight-medium` · `capitalize` |
| Amount row | `--letter-spacing-widest`, underlined with `1px solid var(--color-content-primary)` |
| Caption | `var(--font-size-xs)` · `var(--color-content-secondary)` |

#### Status square

FinTrack's semaphore. `0.75rem` square, `--radius-xs`, no border.
`--color-status-ok` by default, `--color-status-alert` with the `.alert` modifier.

> **Tri-state requirement.** The budget contract returns `isOverBudget` as
> `true | false | null`. `null` means *unknown* (a mixed-currency category), and
> it must be visually distinct from `false` — rendering `null` as the healthy
> teal reports "fine" about a figure the server refused to compute. A third
> state is required whenever this component is bound to budget data.

#### Currency badge

`2.5rem` circle (`--radius-full`), `var(--font-size-2xs)`, `--font-weight-bold`,
`var(--border-width-thick)` outline. Takes the §4.2 surface modifier.

#### Input

Transparent background, no border, no outline — FinTrack inputs are underlined
or bare inside a panel. Placeholder is `var(--color-content-placeholder)` at
`var(--font-size-base)`. Number inputs have their spinners removed. The
validation message below is `0.7rem`, italic, `var(--color-status-error)`; the
non-blocking informative variant is `var(--color-status-info)`, upright, with
`--letter-spacing-wide`.

#### Modal

Scrim `var(--color-surface-overlay)` at `--z-overlay`; dialog on
`--color-surface-inverse`, `--radius-md`, `--shadow-overlay`, `max-width: 32rem`,
`margin: var(--space-4)`, at `--z-modal`. Closes on `Escape` and on scrim click;
focus is trapped inside while open.

### 4.4 Loading and empty states

Every view that fetches declares **three** states. This is a contract, not a
suggestion — a screen missing one of them shows stale or nonsensical figures.

| State | Requirement |
| --- | --- |
| **Loading** | A skeleton whose block dimensions match the real content, so nothing shifts on arrival. Never a bare `Loading...`. |
| **Error** | A message plus a retry affordance. **A skeleton is not an error state** — a skeleton that never resolves is worse than an error, because it promises data that is not coming. |
| **Empty** | Distinct from both. Zero results is a valid answer, not a failure. |

A figure that has not arrived renders as a skeleton or a dash — **never as `0`,
and never as `NaN`**. Zero is a meaningful financial value and must not be used
as a placeholder for absence.

---

## 5. CSS code style

### 5.1 Naming — BEM

```
.block                      /* .summary */
.block__element             /* .summary__title */
.block__element--modifier   /* .summary__data--amount */
.block.is-state             /* .summary.is-loading */
```

- Block names are `camelCase` where multi-word (`.mainNavbar__container`) — this matches the existing codebase and must not be changed to kebab.
- **Interactive state modifiers use the `is-` prefix** (`.is-active`, `.is-open`, `.is-loading`) so a state is never confused with a variant. Bare `.active` exists in legacy code; new code uses `is-active`.
- Nesting never exceeds one level of descent. `.a .b .c` is forbidden — it is the specificity ladder that produces `!important`.

### 5.2 File organisation

```
frontend/src/
├── styles/
│   ├── tokens.css      ← the ONLY :root declaration
│   ├── reset.css       ← the base layer
│   └── utilities.css   ← the flex/spacing utility classes
└── <feature>/<component>/
    ├── Component.tsx
    └── styles/component.css   ← styles ONLY this component
```

### 5.3 Cascade layers

Declared once, in `main.tsx`'s first import, in this order:

```css
@layer reset, tokens, base, layout, components, utilities;
```

Anything in a later layer beats anything in an earlier one regardless of
specificity. This is what makes `!important` unnecessary: a utility class wins
over a component rule because of its layer, not because it shouts louder.

Component stylesheets wrap their rules:

```css
@layer components {
 .summary { }
}
```

### 5.4 Declaration order

Within a rule, group in this order — it makes diffs readable and stops the same
property being declared twice, which happens repeatedly in the current files:

1. Layout — `display`, `position`, `inset`, `z-index`
2. Box model — `width`, `height`, `margin`, `padding`
3. Flex/grid — `flex-direction`, `gap`, `align-*`, `justify-*`
4. Typography — `font-*`, `line-height`, `letter-spacing`, `text-*`
5. Visual — `background`, `border`, `border-radius`, `box-shadow`, `opacity`
6. Motion — `transition`, `animation`
7. Nested state selectors and media queries, last

**Never declare the same property twice in one rule.** The current files
routinely leave the old value above the new one as a record; that record belongs
in git, not in the cascade.

### 5.5 Reset

```css
@layer reset {
 *,
 *::before,
 *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
 }

 body {
  font-family: var(--font-family-sans);
  font-size: var(--font-size-base);
  line-height: 1.5;
  color: var(--color-content-on-dark);
  background-color: var(--color-surface-app);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
 }

 a { color: inherit; text-decoration: none; }
 button { font: inherit; background: none; border: none; cursor: pointer; }
 img, svg { display: block; max-width: 100%; }
}
```

The reset sets `font-size` on `body`, **not** on `*`. Setting it on the universal
selector is what breaks inheritance today (§7.5).

### 5.6 Inline styles

Every rule in this document is enforceable only where it can be read. A
`style={{ … }}` prop bypasses the stylesheet, the cascade, the layers and any
linter pointed at `.css` files — a component can satisfy all of §1 and still
paint itself with a raw literal. This section closes that gap.

**The rule is a test, not a prohibition:**

> Inline `style` is permitted **only for a value that cannot exist at build
> time** — a width computed from a percentage, a color selected by a prop from
> the token set, a transform driven by measured geometry. It still consumes
> tokens. Anything whose value is knowable when the file is written belongs in
> CSS.

```tsx
/* Legitimate: the number does not exist until the data arrives. */
<div className="bar__fill" style={{ width: `${percentage}%` }} />

/* Legitimate: the caller picks from the token set, not from free text. */
<Badge style={{ backgroundColor: `var(--color-status-${tone})` }} />

/* Not legitimate: static value, belongs in the stylesheet. */
<span style={{ color: 'cyan', fontSize: '0.8rem' }} />

/* Not legitimate: a state selector already answers this. */
<button style={{ cursor: disabled ? 'not-allowed' : 'pointer' }} />
```

Three clarifications that decide most real cases:

1. **Looking dynamic is not being dynamic.** A ternary on `:hover`, `:disabled`,
   `:active` or a route-active flag is a state the CSS already expresses. A
   ternary is a justification only when neither branch is a selector.
2. **Dynamic value, static vocabulary.** When a prop chooses the color, the prop
   must carry a token name or a semantic key, never a hex. `variant="alert"` is
   correct; `variant="#c97474"` moves the hardcoded value one file up.
3. **`color: 'inherit'` inline is a symptom.** It is being used to patch the
   universal-selector trap (§7.5) element by element. The fix belongs in the
   stylesheet, and eventually in the reset.

Measured on 2026-08-13, and the reason this section exists:

| Signal | Count |
| --- | --- |
| `style={{ … }}` objects | **86**, across 42 files |
| Genuinely runtime-computed | **3** — and two of those three are state a selector already covers |
| Inline `color` declarations | **24** |
| …of which consume a token | **1** |
| Literals absent from the palette | `cyan` ×3, `yellow`, `lightblue`, `#666`, `#ff4d4d`, `#333` |
| `color: 'inherit'` patches | **7** |
| Off-scale values | `0.8rem`, `40px`, `12px`, `10px` |

---

## 6. Legacy inventory — read, do not extend

This section exists so an agent editing an existing file recognises what it is
looking at. **Nothing here may be used in new code.**

### 6.1 The two coexisting systems

| Tree | Convention | Palette | Tokens |
| --- | --- | --- | --- |
| `src/fintrack/**` (41 files) | Global CSS, BEM-ish | FinTrack dark/cream | Partial |
| `src/auth/**` (16 files) | CSS Modules, camelCase | Bootstrap (`#007bff`, `#dc3545`, `#28a745`) | **None** |

The `auth/` tree is visually unrelated to the application it gates. Aligning it
is a separate, deliberate piece of work — not something to do incidentally while
touching a file there.

### 6.2 Legacy token aliases

The names an agent will actually encounter, and their canonical replacements:

| Legacy | Value | Canonical |
| --- | --- | --- |
| `--dark` | `#141414` | `--color-content-primary` / `--color-border-strong` |
| `--light` | `white` | `--color-surface-inverse` / `--color-content-on-dark` |
| `--creme` | `#e8e4da` | `--color-surface-panel` / `--color-content-on-dark-muted` |
| `--bgBodyColor` | `#1b1b1b` | `--color-surface-app` |
| `--secondary` | `#7f7f7f` | `--color-content-placeholder` |
| `--square` | `#5b8c93` | `--color-status-ok` |
| `--squareAlert` | `#c97474` | `--color-status-alert` |
| `--error` | `#fc0c0c` | `--color-status-error` |
| `--warn` | `orange` | `--color-status-warning` |
| `--success` / `--lightSuccess` | `green` / `lightgreen` | `--color-status-success` |
| `--hoverColor` | `cyan` | `--color-interactive-hover` |
| `--textColor` | `#141414` | Duplicate of `--dark`; unused |
| `--figmaWidth` | `22.5rem` | `--layout-width-min` |
| `--topSpaceHeight` | `2.75rem` | `--layout-top-space` |
| `--navbar-bottom-height` | `3.5rem` | `--layout-navbar-bottom` |
| `--navbar-top-height` | `5rem` | `--layout-navbar-top` |
| `--header-height` | `12.5rem` | `--layout-header-height` |

`--dark`, `--creme` and `--light` account for 158 of the ~400 `var()` calls in
the codebase. They are load-bearing; a rename is a mechanical migration, not an
edit to make in passing.

### 6.3 The duplicate scales

The identical 4px spacing scale is declared **five times** under five prefixes,
each by a component in the account-deletion flow:

`--spacing-*` · `--post-spacing-*` · `--confirm-spacing-*` · `--status-spacing-*` · `--error-spacing-*`

The same duplication exists for radius (`--post-radius-*`, `--confirm-radius-*`,
`--status-radius-*`, `--error-radius-lg`, `--account-radius`), for type
(`--post-font-*`, `--confirm-text-*`) and for shadow. There is additionally a
self-contained `--fx-*` palette (`#0B0E14`, `#161C26`, `#00E676`, `#FF5252`) for
the FX display, which is the only part of the app with its own visual language.

**Do not add a sixth.** If a value is missing from §2, ask.

### 6.4 Hardcoded values in circulation

Recurring raw values that already have a token and must be replaced on touch:
`#1b1b1b` (surface-app), `#5b5b5b` (content-secondary), `#bdb1b1`
(content-on-dark-subtle), `#141414`, `#ccc` (surface-disabled), `cyan`.

### 6.5 Deprecated utility classes

`.flx-row-sb`, `.flx-row-jc`, `.flx-row-start`, `.flx-row-end`, `.flx-col-center`,
`.flex-col-sb` — superseded by the `.utility-*` family (§3.3). Both are live;
new markup uses `.utility-*` only.

---

## 7. Defect ledger

Measured, reproducible, and **not to be copied**. An agent that imitates
surrounding code will propagate every one of these.

### 7.1 Eleven tokens are consumed but never defined

| Token | Consumed at | Effect |
| --- | --- | --- |
| `--amountPositive`, `--amountNegative` | `summaryDetailBox-style.css:69,73` | The over/left percentages have **no color** — the whole point of the pair is lost. |
| `--spacing-large/-medium/-small/-tiny` | `generalStyles.css:63,67,71,75` | Four utility classes apply **no margin**. |
| `--font-size-tiny`, `--line-height-tight` | `mainNavbar.css:135,136` | The navbar label does not shrink on short viewports. |
| `--dark-light` | `accountingDashboard-styles.css:71` | Element has no background. |
| `--crems`, `--cremse` | `overview-styles.css:275,276` | Typos of `--creme`. These two **do** render, because a fallback was supplied — which is why they were never noticed. |

`var(--undefined)` with no fallback is not an error. It silently resolves to the
inherited value or to nothing. **Always supply a fallback, or verify the token
exists.**

### 7.2 An invalid declaration

`budget-styles.css:108` — `color: cyan f;`. The stray token invalidates the
declaration, so the category-name hover does nothing.

### 7.3 Duplicate properties within one rule

`budget-styles.css:19-20` declares `width: 81.11%` then `width: 88%`;
`formSubmitBtn-style.css:17-21` declares `font-size` and `font-weight` twice
each. The first value is dead code kept as a comment-by-declaration.

### 7.4 The dark-mode block is inverted

`accountDetailsUI.css:163-166` is titled `DARK MODE SUPPORT` and queries
`@media (prefers-color-scheme: light)`. On a light-preference system it paints
the card dark; on a dark-preference system it does nothing, and the
`--text-gray-*` overrides that were meant for a dark card never apply. It is the
only `prefers-color-scheme` block in the frontend.

### 7.5 The universal selector sets `font-size`

`index.css:12-18` applies `font-size: 16px` to `*`. Every element resets to 16px
instead of inheriting, so a `<span>` inside a `0.875rem` row renders at 16px
unless it restates `font-size: inherit`. Fixing this is a global visual change
and belongs in its own commit.

### 7.6 A leaf component defines the global scale

`accountDetailsUI.css:7-24` — a component three levels deep inside the
account-deletion flow opens a global `:root` block and defines `--spacing-1..6`,
`--font-bold`, `--font-semibold` and `--font-mono` for the entire application.
Those tokens are consumed elsewhere, so the app's spacing scale currently depends
on that route's stylesheet being loaded.

### 7.7 Specificity collisions across lazy routes

`.box__title`, `.box__subtitle` and `.box__container` are declared in three
stylesheets at equal specificity. Which one wins depends on the order the lazy
routes load their CSS — the rendered result is **route-history dependent**. This
is documented in place at `summaryDetailBox-style.css:60-63`.

### 7.8 `!important` inventory

47 occurrences, concentrated in `tooltip.css` (15), `tracker-style.css` (13) and
`datepicker-styles.css` (8). Each is a rule that cannot be overridden by a caller.

### 7.9 The stylesheet is bypassed 86 times

86 inline `style` objects across 42 files, of which **3** carry a value that
could not have been written into CSS. The rest are static declarations placed
where no stylesheet, layer or linter can see them. 24 set a color and exactly
one of those consumes a token; the literals include `cyan`, `yellow` and
`lightblue`, which appear nowhere in the palette. See §5.6 for the rule and the
full measurement.

`auth/components/passwordChangeForm/ChangePasswordContainer.tsx:296-298` declares
a fixed-position `DebugPanel`, labelled by its own comment as temporary. Whether
it mounts was not verified.

### 7.10 Two portalled layers shared one z-index — **fixed 2026-09-02**

**What was seen.** Inside the pocket cash dialog (`PocketCashModal`, which
renders both *Commit cash* and *Release cash* from one component), pressing the
date button opened the calendar the first time and never again. In *Release* it
appeared never to work at all.

**What it actually was.** The calendar did open every time. It was painted
behind the dialog. `.react-datepicker__portal` and `.pocketCash__overlay` are
both children of `<body>` and both declared `z-index: var(--z-modal)`. Equal
values tie, so the winner was decided by document order — and document order here
is not ours to decide. `react-datepicker` creates its portal host on the first
open anywhere in the application and never removes it: `Portal.componentWillUnmount`
drops only its own child, not the host (`react-datepicker/dist/index.js:4088`).
So the host outlives the calendar, and every dialog React portals in afterwards
lands after it in the body and paints over it.

That is the whole reason the failure looked inconsistent. The calendar has two
callers — `TopCard.tsx:313` on the tracker, outside any dialog, and
`PocketCashModal.tsx:563` inside one. Opening it once on the tracker is enough to
plant the host, after which no calendar inside a dialog is ever visible again.
*Release* was not a second defect; by the time it is reached the host exists.

**How it was resolved.** `--z-modal-popover: 1050` was added between `--z-modal`
and `--z-toast`, and `.react-datepicker__portal` consumes it
(`transactionDateTrigger-styles.css:170`). `z-index` is compared before document
order, so 1050 wins wherever the host happens to sit. The tie is removed rather
than the order corrected — the order belongs to the library.

Measured in `plan-docs/playwright/calendarOverModal.mjs`, which hit-tests the
centre of the viewport with the host inserted before and after the dialog:
both orders lost before, both win after.

**The rule this establishes.** Never place two layers that can overlap on the
same z-index token, and never rely on document order to separate them when either
one is portalled.

**What was deliberately not changed.** `react-toastify` keeps its own
`--toastify-z-index: 9999`: it portals outside this scale, like the date picker.
`--z-toast: 1100` looked dead from here and was not -- the app's own `Toast`
component was writing the same `1100` by hand. It reads the token as of
`toast-styles.css:9` (commit `5039769b`).

---

## 8. Blueprint — the block to hand to an agent

Paste this into the agent's system prompt or task description. It is written to
be self-sufficient.

````markdown
# FinTrack UI Task — Style Contract

You are writing CSS and JSX for FinTrack, a personal-finance PERN application.
`docs/design-system/FINTRACK_DESIGN_SYSTEM.md` is the authority. Follow it
exactly. Where it is silent, ask — do not decide.

## Visual identity in one paragraph
A dark, single-column mobile application. The page is near-black (#1b1b1b).
Content sits in cards that are either the same near-black separated by white
borders, or cream (#e8e4da) panels with near-black text. The header and the
bottom navbar are white. One typeface, Outfit, at 0.875rem for most UI. Radii
are soft (0.75rem). There are almost no shadows — separation comes from borders.
The signature element is a 0.75rem status square, teal when a figure is healthy
and dusty red when it is over budget.

## Hard rules
1. Consume `var(--token)` for every color, space, radius, font size, weight,
   shadow, duration and z-index. **Zero hardcoded values.**
2. Never invent a token name. If the value you need does not exist, STOP and ask.
3. Mobile-first. Base rule targets 360px; media queries are `min-width` at
   480 / 768 / 1024px. Also handle the height breakpoints at 735px and 568px.
4. Every interactive element implements all five states: default, `:hover`,
   `:focus-visible` (2px ring, 2px offset — mandatory), `:active`, `:disabled`
   (`opacity: 0.5; pointer-events: none`).
5. Animate only `transform`, `opacity`, `background-color`, `color`. Enumerate
   the properties — never `transition: all`. Ship a
   `@media (prefers-reduced-motion: reduce)` block with anything that moves.
6. BEM: `.block__element--modifier`; interactive states use `is-` (`.is-active`).
   Maximum one level of descent. **No `!important`.**
7. 1-space indentation. English comments, one or two lines, stating *why*.
   No decorative banners, no emoji headers.
8. Component CSS lives in `styles/<component>.css` next to the component, wrapped
   in `@layer components`, and styles only that component. **Never write to
   `:root` from a component file.**
9. A component that can sit on both a dark and a light surface exposes `.light`
   and `.dark` modifiers naming **the surface**, not its own color.
10. Every fetching view declares three states: loading (skeleton matching the
    real dimensions), error (message + retry), empty. A missing figure renders
    as a skeleton or a dash — **never as `0`, never as `NaN`**.

## Do not imitate surrounding code
The existing CSS contains known defects catalogued in §7: undefined tokens,
duplicate declarations, an inverted dark-mode query, `!important` chains, and
five copies of the same spacing scale. Match the *specification*, not the
neighbouring file. If a file you are editing violates the spec, leave the
violation alone unless fixing it is the task — and say that you found it.

## Before you finish
- [ ] Every value is a `var()`, and every token consumed exists in `tokens.css`.
- [ ] All five states present on every interactive element.
- [ ] Renders correctly at 360px, 768px, and at 700px viewport height.
- [ ] Contrast checked: content token paired to the surface it actually sits on.
- [ ] No `!important`, no `transition: all`, no nesting past one level.
- [ ] Loading, error and empty states all reachable.
````

---

## 9. Adoption path

§2's token file **does not exist in the repository yet.** An agent that consumes
`var(--color-surface-app)` today gets nothing. This section states the order in
which that becomes false. Each step is one commit.

| # | Step | Risk | Reversible |
| --- | --- | --- | --- |
| 1 | Add `styles/tokens.css` with the full §2 set and import it first in `main.tsx`. Nothing consumes it yet. | None — additive only | Yes |
| 2 | Alias the legacy names to the canonical ones (`--dark: var(--color-content-primary)`), leaving every existing `var(--dark)` working. | None — values identical | Yes |
| 3 | Define the eleven missing tokens from §7.1. Four utility classes and two percentage colors start working, which is a **visible change**. | Low, intended | Yes |
| 4 | Introduce `@layer` and move the reset out of the universal selector (§7.5). | **Medium — global visual change.** Needs a visual pass over every route. | Yes |
| 5 | Migrate component stylesheets to canonical tokens, one feature at a time. | Low per commit | Yes |
| 6 | Collapse the five duplicate scales (§6.3) onto `--space-*`. | Low | Yes |
| 7 | Remove the legacy aliases once no `var()` references them. | None if step 5 is complete | Yes |

Steps 1–3 are additive and safe to land at any time. **Step 4 is the point of no
return** and should not be attempted while another visual refactor is in flight.
The `auth/` tree (§6.1) is out of scope for all seven steps and needs its own
decision.
