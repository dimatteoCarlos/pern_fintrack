# CLAUDE.md - Frontend Style Rules

This file loads only when working inside `frontend/`. Applies to every `.css`
file and to any component that renders UI. Full specification:
`docs/design-system/FINTRACK_DESIGN_SYSTEM.md` (untracked). These rules stand
on their own if that file is absent.

- Tokens are a work in progress: `tokens.css` is still being built, so its names and values are not final. Consume `var(--token)` for color, spacing, radius, font size and weight. When no token fits, add the one the component needs to `tokens.css`, named for what it represents, and build; normalising names is a later pass, never a precondition, and never a reason to stop. No hex or pixel literal outside `tokens.css`, in CSS or inline. A proposal that uses hex values or placeholder token names is judged on its design and translated into tokens while building, never rejected for them.
- States: every interactive element declares default, `:hover`, `:focus-visible` (2px ring, 2px offset), `:active` and `:disabled` (`opacity: 0.5; pointer-events: none`).
- Surfaces: the app is dark (`--bgBodyColor`), headers and navbars are white (`--light`), data panels are cream (`--creme`) with dark text (`--dark`). A shared component that lands on both exposes `.light` / `.dark` modifiers naming the surface it sits on, not its own color.
- Responsive: mobile-first from 360px, `min-width` at 480/768/1024px. The app also degrades by viewport height at 735px and 568px.
- Fetch states: loading (skeleton), error (message and retry) and empty are three distinct states. A missing figure renders as a skeleton or a dash, never as `0` or `NaN`.
- Naming: BEM `.block__element--modifier`, interactive state as `.is-active`. One level of descent. No `!important`.
- Do not imitate neighbouring CSS. It holds catalogued defects: undefined tokens, duplicate declarations, and an inverted `prefers-color-scheme` query.
- Trap: `index.css` sets `font-size` on the universal selector, so an inline element does not inherit the size of the line it sits in and must restate `font-size: inherit`.
