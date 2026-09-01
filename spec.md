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

Claude Code must **exclusively use the application's CSS variables or design tokens** (e.g., `var(--color-text-primary)`, `var(--color-bg-surface)`), adhering to the following contrast rules:

* **Primary & Secondary Text (< 18pt / 24px):** Any text token applied over a background token must guarantee a minimum contrast ratio of **4.5:1**.
* *Secondary Text / Placeholder Rule:* Assign a higher-contrast text token if the default secondary token fails to reach 4.5:1 on the selected background.


* **Non-Text Components & Control Borders:** Input field borders, buttons, and interactive controls must use a border token guaranteeing at least **3.0:1** contrast against adjacent background tokens.
* **Theme Support (Dark/Light Mode):** Combinations must be independently evaluated for every active theme in the application.

#### 6.2. Form Structure & Interaction (WCAG 3.3.2, 2.5.8 & 2.4.7)

* **Explicit Labels:** Every input field must be explicitly associated with its corresponding `<label>` using `htmlFor` and `id`.
* **Visual Input Boundaries:** Every interactive input field must have clearly perceptible boundaries (via borders with contrast `>= 3.0:1` or distinct background contrast).
* **Target Size:** Interactive elements must maintain a minimum target size of **24x24px** (recommended **44x44px**).
* **Focus Indicators:** Use the global focus style/variable (`:focus-visible`) to maintain visual consistency while ensuring high visibility.

#### 6.3. Semantics & Screen Readers (WCAG 4.1.2)

* **Icon-Only Actions:** Buttons containing only an icon (e.g., close modal, toggle password visibility) MUST include a descriptive `aria-label` attribute.
* **Decorative Icons:** Visual icons accompanying text must include `aria-hidden="true"`.

#### 6.4. Integrated Reference Pattern (Design Tokens & Accessibility)

When building form controls or UI components, follow this React + TypeScript architecture:

```tsx
import React, { useId } from 'react';

type AccessibleInputProps = {
  label: string;
  type?: string;
  error?: string;
  helperText?: string;
} & React.InputHTMLAttributes<HTMLInputElement>;

export const AccessibleInput = React.forwardRef<HTMLInputElement, AccessibleInputProps>(
  ({ label, type = 'text', error, helperText, className = '', ...props }, ref) => {
    const id = useId();
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;

    const describedBy = [
      error ? errorId : null,
      helperText ? helperId : null,
    ].filter(Boolean).join(' ') || undefined;

    return (
      <div className="form-group">
        <label htmlFor={id} className="form-label">
          {label}
        </label>
        
        <input
          ref={ref}
          id={id}
          type={type}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={`form-input ${error ? 'form-input--error' : ''} ${className}`.trim()}
          {...props}
        />

        {helperText && !error && (
          <p id={helperId} className="form-helper-text">
            {helperText}
          </p>
        )}

        {error && (
          <p id={errorId} role="alert" className="form-error-text">
            <span aria-hidden="true">⚠️ </span>
            <span>{error}</span>
          </p>
        )}
      </div>
    );
  }
);

AccessibleInput.displayName = 'AccessibleInput';

```

---

#### 6.5. Automated Verification Checklist

When designing or refactoring UI components, verify:

1. Are design tokens/variables being used instead of hardcoded hex colors?
2. Does the text token meet the **4.5:1** contrast ratio over the chosen background token?
3. Does the input border token meet the **3.0:1** contrast ratio over the background?
4. Do all icon-only interactive controls contain a descriptive `aria-label`?
5. Is the form input fully accessible via keyboard navigation with clear focus outlines?
