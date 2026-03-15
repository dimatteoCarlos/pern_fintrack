# Database Lifecycle – FinTrack

This document describes **how the database is created, migrated, seeded, and maintained** throughout the lifecycle of the FinTrack backend.

It is the single source of truth for **DB operations** and must be followed strictly.

---

## 1. Core Principles

* Migrations define **schema structure** (DDL)
* Seeds define **initial data** (DML)
* Nothing related to DB setup runs automatically at runtime
* Production is always protected by explicit flags
* Destructive actions are always manual

---

## 2. Database Reset (Manual Only)

Used when starting from scratch in **local development only**.

### When to use

* First project setup
* Schema corruption
* Clean local reset

### How

```bash
# Connect as postgres superuser
psql -U postgres

# Inside psql
DROP DATABASE IF EXISTS fintrack_dev;
CREATE DATABASE fintrack_dev;
\q
```

⚠️ Never automate this step.
⚠️ Never run in production.

---

## 3. Migrations

### Purpose

Migrations define and evolve the **database schema**:

* Tables
* Constraints
* Indexes
* Extensions

They are written as **pure SQL** and are **idempotent**.

### Location

```
backend/src/db/migrations/
```

### Execution

```bash
npm run db:migrate
```

### Behavior

* Uses a `migrations` tracking table
* Executes pending files in order
* Runs inside a transaction
* Safe to run multiple times

### Environment

* Runs automatically during deploy
* Allowed in dev, staging, production

---

## 4. Base Seeds

### Purpose

Base seeds insert **static reference data** required for the system:

* currencies
* roles
* account types
* movement types

This data:

* Rarely changes
* Is shared by all environments

### Location

Base catalogs are implemented as **SQL migrations**, not seeds:

```
backend/src/db/migrations/00x_base_catalogs.sql
```

### Reason

* They are part of the schema contract
* Required before any app logic runs
* Must exist in production

---

## 5. Admin / System Bootstrap Seed

### Purpose

Creates the **initial system administrator**.

This user is:

* A bootstrap user
* Not a regular application user
* Used to access and configure the system

### Location

```
backend/src/db/seeds/002_system_admin_user.js
```

### Execution (Manual Only)

```bash
SEED_ADMIN=true npm run db:seed
```

### Rules

* NEVER auto-run
* NEVER run in CI
* NEVER run in production without intent
* Uses credentials from `.env`

Required env vars:

```
SYSTEM_ADMIN_EMAIL
SYSTEM_ADMIN_PASSWORD
```

---

## 6. Seed Runner Behavior

Seed runner executes **JavaScript-only seeds**.

### What it does

* Reads `src/db/seeds/*.js`
* Classifies seeds by filename
* Requires explicit env flags
* Executes inside a single transaction

### Flags

| Flag       | Purpose                 |
| ---------- | ----------------------- |
| SEED_ADMIN | Allow system admin seed |

---

## 7. What Runs Automatically

| Action            | Auto | Notes                  |
| ----------------- | ---- | ---------------------- |
| Database reset    | ❌    | Manual only            |
| Migrations        | ✅    | On deploy              |
| Base catalogs     | ✅    | Via migrations         |
| System admin seed | ❌    | Manual + explicit flag |

---

## 8. Production Safety Rules

* No seeds without flags
* No destructive commands automated
* No credentials hardcoded
* No runtime schema changes

Breaking any of these rules is a **deployment blocker**.

---

## 9. Recommended Workflow (Dev)

```text
1. Create database manually
2. Run migrations
3. (Optional) Run admin seed manually
4. Start backend
```

---

## 10. Summary

* Schema = migrations
* Static data = migrations
* Bootstrap users = manual JS seeds
* Runtime = read-only DB access

This separation keeps the system **predictable, safe, and maintainable**.
