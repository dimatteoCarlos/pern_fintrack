# CLAUDE.md - Frontend Style Rules

This file loads only when working inside `frontend/`. Applies to every `.css`
file and to any component that renders UI. Full specification:
`docs/design-system/FINTRACK_DESIGN_SYSTEM.md` (untracked). These rules stand
on their own if that file is absent.

- Tokens: consume `var(--token)` for color, spacing, radius, font size and weight. Never hardcode a hex or a pixel value, in CSS or inline. If a value has no token, ask — never invent a token name.
- States: every interactive element declares default, `:hover`, `:focus-visible` (2px ring, 2px offset), `:active` and `:disabled` (`opacity: 0.5; pointer-events: none`).
- Surfaces: the app is dark (`--bgBodyColor`), headers and navbars are white (`--light`), data panels are cream (`--creme`) with dark text (`--dark`). A shared component that lands on both exposes `.light` / `.dark` modifiers naming the surface it sits on, not its own color.
- Responsive: mobile-first from 360px, `min-width` at 480/768/1024px. The app also degrades by viewport height at 735px and 568px.
- Fetch states: loading (skeleton), error (message and retry) and empty are three distinct states. A missing figure renders as a skeleton or a dash, never as `0` or `NaN`.
- Naming: BEM `.block__element--modifier`, interactive state as `.is-active`. One level of descent. No `!important`.
- Do not imitate neighbouring CSS. It holds catalogued defects: undefined tokens, duplicate declarations, and an inverted `prefers-color-scheme` query.
- Trap: `index.css` sets `font-size` on the universal selector, so an inline element does not inherit the size of the line it sits in and must restate `font-size: inherit`.
