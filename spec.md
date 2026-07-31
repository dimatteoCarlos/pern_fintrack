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
