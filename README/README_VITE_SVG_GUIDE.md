# 🖼️ SVG Handling with Vite — Setup & Usage Guide

📂 Key files
`frontend/vite.config.ts` · `frontend/src/vite-env.d.ts` · `frontend/tsconfig.app.json`
Worked example: `frontend/src/fintrack/pages/budget/components/BudgetListControls.tsx` and `frontend/src/assets/budgetListControlsSvg/`

This guide covers the full lifecycle of an SVG in this codebase: installing the
plugin, the config gotcha that silently breaks one of the two import forms,
the TypeScript trap that makes a working import fail `tsc`, and a checklist
for authoring a new icon file so it behaves like the rest of the set.

## 🛠️ Tech Stack

- **Bundler:** [Vite](https://vitejs.dev)
- **Transform:** [vite-plugin-svgr](https://github.com/pd4d10/vite-plugin-svgr) v4 (wraps [@svgr/core](https://react-svgr.com))
- **Framework:** React + TypeScript

## 🚀 Why two import forms exist

An `.svg` file can enter a component in two different shapes, and Vite has to
be told which one you want on each import:

| form | import | resolves to | can take props |
| :--- | :--- | :--- | :--- |
| **bare** | `import Logo from './logo.svg'` | a `string` — the built asset URL | ❌ no |
| **`?react`** | `import Logo from './logo.svg?react'` | a React component | ✅ yes |

The bare form is for anywhere a URL is expected: `<img src={Logo} />`, a CSS
`background-image`, an `<link rel="icon">`. The `?react` form is for anywhere
the SVG is a piece of UI that needs to react to props — most commonly a
`className` that ties it to a stylesheet.

## ⚙️ Installation & Configuration

**1. Install the plugin**

```bash
npm install --save-dev vite-plugin-svgr
```

**2. Register it in `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

export default defineConfig({
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        exportType: 'default',
        ref: true,
        svgo: false,
        titleProp: true,
      },
      include: ['**/*.svg', '**/*.svg?react'],
    }),
  ],
});
```

`svgrOptions` used in this project:

| option | value | effect |
| :--- | :--- | :--- |
| `exportType` | `'default'` | `import Logo from '...'` instead of a named `{ ReactComponent }` |
| `ref` | `true` | the component forwards a `ref` to the underlying `<svg>` |
| `svgo` | `false` | the file is embedded as authored — SVGO's optimizer does not rewrite it |
| `titleProp` | `true` | unlocks a `title` prop that renders as `<title>` + `aria-labelledby`, for icons that carry meaning |

⚠️ **The `include` pitfall.** vite-plugin-svgr v4 ships a default of
`'**/*.svg?react'` — files without a `?react` suffix are left alone by the
plugin. Passing your own `include` **replaces** that default, it does not
extend it. If this project only wrote `include: '**/*.svg'`, every `?react`
import in the codebase would 404 at build time. The array form —
`['**/*.svg', '**/*.svg?react']` — keeps both doors open: bare imports still
resolve as strings (nothing here changes their behavior), and `?react`
imports resolve as components.

**3. Add the client types in `vite-env.d.ts`**

```ts
/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />
```

`vite/client` alone declares `*.svg` as `string`. That declaration wins over
any project-owned `.d.ts` that tries to widen it (ambient module declarations
merge, they do not override one another by file order). The only declaration
that changes the type of an import is the one scoped to the suffix that
carries it — `vite-plugin-svgr/client` types `*.svg?react` as a
`React.FunctionComponent<React.SVGProps<SVGSVGElement>>`. Skipping this line
means `?react` still works at runtime (Vite's dev server and build both
transform it correctly) but fails `tsc` the moment a prop is passed.

## ⚠️ The TypeScript trap: it runs, but does not typecheck

A bare `.svg` import compiles as a JSX tag because TypeScript accepts a
string-typed value as an intrinsic element — but **any prop on it is a type
error**:

```
error TS2322: Property 'className' does not exist on type 'IntrinsicAttributes'.
```

This is easy to miss because the dev server never shows it — Vite doesn't
typecheck. The project's real typecheck command is:

```bash
npx tsc --noEmit -p tsconfig.app.json
```

Not bare `npx tsc --noEmit` — the root `tsconfig.json` declares `"files": []`
and checks nothing. `npm run build` (`vite build`) does not typecheck either.
If you add or change an SVG import, run the `-p tsconfig.app.json` form
before trusting a green build.

## ✅ Worked example: the budget control bar

`frontend/src/assets/budgetListControlsSvg/` holds one file per icon —
`SearchSvg.svg`, `ClearSvg.svg`, `SortSvg.svg`, `ChevronDownSvg.svg`,
`SortDirectionSvg.svg`, `OverBudgetSvg.svg`. Each is imported through
`?react` and rendered as a component:

```tsx
import SearchSvg from '../../../../assets/budgetListControlsSvg/SearchSvg.svg?react';

<SearchSvg className='budgetListControls__icon' />
```

And a representative file:

```xml
<svg
 xmlns="http://www.w3.org/2000/svg"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 stroke-width="2"
 stroke-linecap="round"
 stroke-linejoin="round"
 aria-hidden="true"
 focusable="false"
>
 <circle cx="11" cy="11" r="7" />
 <line x1="16.5" y1="16.5" x2="21" y2="21" />
</svg>
```

Three things about this file only make sense together with how it is
consumed — see the checklist below for why each one is there.

## 📝 Authoring checklist for a new icon

- [ ] **`stroke="currentColor"`, never a hardcoded hex.** The icon then
      inherits `color` from whatever CSS class is passed in — one file works
      on any surface, light or dark, without a second color variant.
- [ ] **No `width`/`height` on the root**, unless the icon must always render
      at a fixed size regardless of context. Leaving them out lets the
      stylesheet size the icon off `font-size` (as `budgetListControls.css`
      does), so it scales with the text next to it instead of needing manual
      re-tuning whenever that text size changes.
- [ ] **`aria-hidden="true" focusable="false"`** for a decorative icon — one
      that sits next to a text label which already announces the meaning.
      Drop `aria-hidden` and pass a `title` prop instead when the icon is the
      *only* carrier of meaning (`titleProp: true` in the config above is
      what makes that `title` prop exist).
- [ ] **Know that `{...props}` is spread last** in svgr's output — a
      `className` (or any prop) passed at the call site always wins over a
      static attribute written in the SVG file. You do not need `!important`
      or extra specificity to override the file from the component.
- [ ] **One file, one icon**, named for what it draws (`ClearSvg.svg`, not
      `Icon3.svg`), grouped under `assets/<feature>Svg/` next to the
      component that owns it.

## 🔍 Known non-conformance in this repo

`frontend/src/assets/accountingDashboardSvg/` (added 2026-08-18, not yet
imported anywhere) does not follow the checklist above: each file hardcodes
`stroke="#000000"` and a fixed `width="32" height="32"`. As authored, these
icons cannot change color from CSS and will not scale with `font-size` the
way the budget control bar's set does. Left as-is intentionally — flagging
it here rather than editing files that are not wired into any component yet.

## 🧭 Decision tree

```
Does the SVG need to change color, size, or take any prop from React?
 ├─ No  → bare import:  import Logo from './logo.svg'
 │        use it as a URL — <img src={Logo} />, background-image, favicon
 └─ Yes → '?react' import: import Logo from './logo.svg?react'
          use it as a component — <Logo className="..." />
          requires the vite-env.d.ts reference above, or `tsc` fails on any prop
```

## 📚 References

- [vite-plugin-svgr — README](https://github.com/pd4d10/vite-plugin-svgr)
- [@svgr/core — options reference](https://react-svgr.com/docs/options/)
- `REMARKS.md` — internal record of the investigation that produced this guide (R34)
