# PERN_FINTRACK - Technical Specification & Architectural Requirements

## Overview

PERN_FINTRACK is a full-stack financial tracking application built on the PERN stack (PostgreSQL, Express, React, Node.js). This project implements a modernized Budget module and Overview dashboard while training the developer in Software Architecture, Clean Code patterns, and incremental zero-downtime refactoring.

## Architectural & Technical Requirements

### 1. Feature Flagging & Safe Execution Strategy

- Flag Control: Introduce `USE_NEW_BUDGET_SYSTEM` in `dashboardController.js`.
- Backward Compatibility: All new calculations must co-exist with existing legacy logic behind the feature flag to prevent code breakage.
- Deprecation Workflow: Identify obsolete budget manual calculation helper functions (e.g., manual calculations of remaining balances and status alerts) and isolate them for deprecation once the new system is verified.

### 2. Overview Dashboard & Multi-Account Card Metrics

- Period Selection: Frontend sends custom date windows using `startDate` and `endDate` parameters.
- Backend Date Normalization: Express backend normalizes input date ranges. If range adjustments occur, the payload response must include a `meta.notices` array explaining the adjustment.
- Account Type Cards:
  - `category_budget` accounts summary cards displaying: `budgetedAmount`, `actualSpent`, `remainingBudget`, and `% execution`.
  - Account cards for non-budget account types rendered alongside budget metrics.
- Server-Driven Aggregations: Eliminate frontend manual status/alert calculations (`remainingBudget`, `statusAlert`) by delivering pre-calculated database aggregations directly from the backend API.

### 3. Git Branching Strategy

- `feat/vercel-serverless`: **Production deploy target on Vercel.** Long-lived, not a feature branch awaiting cleanup. No pushes, rebases, force-pushes, or deletion without explicit approval. Being fully merged into `main` does not make it disposable — merge status answers whether deleting would lose commits, not whether something deploys from the ref.
- `main`: Integration branch. Feature branches merge here before reaching production.
- `feat/budget`: Houses the database migrations, core models, and API endpoints for the Budget module.
- `feat/overview`: Houses the dashboard metrics, card aggregations, date normalization, and `USE_NEW_BUDGET_SYSTEM` flag integration.

### 4. Communication Standards

- Explanations must be clear, direct, and concise. No verbosity, no restating what the code already shows, no filler preamble.
- State the change, the reason it is needed, and the effect. Nothing else.
- One edit per intent. Do not mix cosmetic changes (quote style, spacing) into a functional fix — it hides the real change in noise.

### 5. Non-Functional & Quality Standards

- Database Engineering: Safe, reversible migrations with strict schema constraints and indexed foreign keys.
- Error Handling & Architecture: Domain-driven validation, explicit middleware pipelines, and strict type safety.

### 6. UI Accessibility Specification: WCAG 2.1 / 2.2 Level AA Standard

#### Purpose & Scope

This specification defines mandatory web accessibility rules (WCAG 2.1 and 2.2 Level AA). Claude Code must strictly apply the application's defined color palettes, themes, and design tokens, ensuring chosen combinations satisfy the mathematical contrast thresholds required by the standard.

#### 6.1. Contrast & Color Tokens (WCAG 1.4.3 & 1.4.11)

Claude Code must **exclusively use the application's own CSS variables**, defined in `frontend/src/styles/tokens.css`. There is no `--color-text-*` or `--color-bg-*` family — content tokens are prefixed `--color-content-*`, surfaces `--color-surface-*`, and `tokens.css:14-18` states the rule they follow: a near-black app with white or cream panels, near-black content on those panels. Every content token's own comment names the surfaces it is valid on (e.g. `tokens.css:38`, `--color-content-primary: #141414; /* on inverse, panel */`) — read that comment before pairing a token with a surface, not after.

* **Primary & Secondary Text (< 18pt / 24px):** Any text token applied over a background token must guarantee a minimum contrast ratio of **4.5:1**.
* *Secondary Text / Placeholder Rule:* Assign a higher-contrast text token if the default secondary token fails to reach 4.5:1 on the selected background.
* **Non-Text Components & Control Borders:** Input field borders, buttons, and interactive controls must use a border token guaranteeing at least **3.0:1** contrast against adjacent background tokens.
* **Theme Support (Dark/Light Mode):** Combinations must be independently evaluated for every active theme in the application.

**Verified pairs.** Computed with the sRGB relative-luminance formula (WCAG 1.4.3/1.4.11), not estimated. Recompute rather than trust this table once a token's hex changes.

| content token | on surface token | ratio | floor |
|---|---|---|---|
| `--color-content-primary` (#141414) | `--color-surface-inverse` (#ffffff) | 18.43:1 | 4.5:1 |
| `--color-content-primary` (#141414) | `--color-surface-panel` (#e8e4da) | 14.51:1 | 4.5:1 |
| `--color-content-secondary` (#5b5b5b) | `--color-surface-inverse` (#ffffff) | 6.79:1 | 4.5:1 |
| `--color-content-secondary` (#5b5b5b) | `--color-surface-panel` (#e8e4da) | 5.35:1 | 4.5:1 |
| `--color-content-placeholder` (#5b5b5b) | `--color-surface-panel` (#e8e4da) | 5.35:1 | 4.5:1 |
| `--color-content-on-dark` (#ffffff) | `--color-surface-app` (#0d0f12) | 19.23:1 | 4.5:1 |
| `--color-content-on-dark` (#ffffff) | `--color-surface-raised` (#161a22) | 17.43:1 | 4.5:1 |
| `--color-content-on-dark-subtle` (#bdb1b1) | `--color-surface-app` (#0d0f12) | 9.24:1 | 4.5:1 (used as border: also clears 3.0:1) |
| `--color-content-on-dark-subtle` (#bdb1b1) | `--color-surface-raised` (#161a22) | 8.37:1 | 4.5:1 |

A pairing not in this table is not "probably fine" — measure it before shipping it, the same way each row here was measured, and add the row.

#### 6.2. Form Structure & Interaction (WCAG 3.3.2, 2.5.8 & 2.4.7)

* **Explicit Labels:** Every input field must be explicitly associated with its corresponding `<label>` using `htmlFor` and `id`.
* **Visual Input Boundaries:** Every interactive input field must have clearly perceptible boundaries (via borders with contrast `>= 3.0:1` or distinct background contrast).
* **Target Size:** Interactive elements must maintain a minimum target size of **24x24px** (recommended **44x44px**).
* **Focus Indicators:** Use the global focus style/variable (`:focus-visible`) to maintain visual consistency while ensuring high visibility.

#### 6.3. Semantics & Screen Readers (WCAG 4.1.2)

* **Icon-Only Actions:** Buttons containing only an icon (e.g., close modal, toggle password visibility) MUST include a descriptive `aria-label` attribute.
* **Decorative Icons:** Visual icons accompanying text must include `aria-hidden="true"`.

#### 6.4. Integrated Reference Pattern (Design Tokens & Accessibility)

There is already an accessible input in this codebase — `frontend/src/auth/components/formUIComponents/InputField.tsx`, styled by the CSS Module at `styles/inputField.module.css`. Do not invent a second one from generic markup (plain `form-group`/`form-input` classes belong to no styling system this project uses); extend or reuse this component instead. Its pattern, in the same order 6.1-6.3 above require it:

* Label association — `InputField.tsx:118-124,145`: `inputId` is derived once and shared between the `<label htmlFor={inputId}>` and the `<input id={inputId}>`.
* Error/help association — `InputField.tsx:130-132`: `aria-describedby` points at `${inputId}-error` only `hasError` is true, matching the rendered element's own `id` at `InputField.tsx:193`.
* Icon-only control — `InputField.tsx:181`: the show/hide toggle carries `aria-label={isContentVisible ? 'Hide content' : 'Show content'}`, no visible text.
* Token-only color — `inputField.module.css:287-298`: the filled variant's background, text and border are each a `var(--color-*)` token, never a literal hex; the border exists at all because the fill alone measured under the 3.0:1 floor (`inputField.module.css:290-293`).
* Focus ring — `inputField.module.css:313-317`: `:focus-visible` only, so a mouse click does not paint a ring a keyboard user actually needs.

When a form needs a new field, render `<InputField variant="filled" .../>` — see `SignInForm.tsx:72-100` for a working call — rather than authoring a new input element.

---

#### 6.5. How to Audit a View

1. List every `color`/`background-color`/`border-color` declaration the view's CSS Module actually applies, in every state (`:hover`, `:focus-visible`, `:disabled`, `::placeholder`, and separately for each theme it renders in).
2. For each one, resolve the two tokens involved (content-on-surface) and check the table in 6.1. Not there — compute it with the sRGB relative-luminance formula and add the row; do not eyeball it or reuse a ratio measured for a different pair.
3. Flag any literal hex outside `tokens.css` — it has no verified ratio and no comment naming its valid surfaces, which is itself a finding regardless of what it measures to.
4. Confirm every `<label>`/`<input>` pair shares an `id`/`htmlFor`, every icon-only control has an `aria-label`, and every focusable control has a visible `:focus-visible` ring (not just `:hover`).
5. Report findings as `element | token pair | measured ratio | floor | verdict`, the same shape as the table in 6.1 — a finding that only says "contrast looks low" without a measured ratio is not an audit.
