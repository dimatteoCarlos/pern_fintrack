
# Database Lifecycle – FinTrack Backend

This document describes how the database is created, migrated, seeded, and reset
during the lifecycle of the FinTrack backend application.

This project uses **PostgreSQL** and **Node.js (ESM)**.
Migrations and seeds are executed manually or during deploy — never at runtime.

---

## 1. Environments

The database lifecycle depends on the environment:

| Environment | Migrations | Base Data | Admin Seed | Reset |
|------------|------------|-----------|------------|-------|
| Development | Manual / CI | Automatic | Manual only | Allowed |
| Staging | Automatic | Automatic | Manual only | Restricted |
| Production | Automatic | Automatic | Manual only | ❌ Never |

---

## 2. Database Creation (Manual)

Creating or dropping databases is **never automated in production**.

Example (local development):

```bash
psql -U postgres
DROP DATABASE IF EXISTS fintrack_dev;
CREATE DATABASE fintrack_dev;
\q
````

---

## 3. Migrations

### Purpose

Migrations define **schema structure and base reference data**.
They are **idempotent** and tracked in the `migrations` table.

### Location

```
src/db/migrations/
```

### Execution

```bash
npm run db:migrate
```

### Rules

* Migrations run **in order**
* Already executed migrations are skipped
* The `migrations` table is the source of truth
* Migrations may include:

  * Tables
  * Constraints
  * Base catalogs (currencies, roles, types, etc.)

---

## 4. Seeds

Seeds are **NOT migrations**.
They insert **contextual or sensitive data** that must not run automatically.

### Location

```
src/db/seeds/
```

### Naming Convention

| Type                 | Prefix   |
| -------------------- | -------- |
| Base seeds           | `base_`  |
| Admin / system seeds | `admin_` |

---

## 5. Base Seeds

### Purpose

Optional non-sensitive data used for development or staging.

### Execution

```bash
npm run db:seed:base
```

### Rules

* Never required in production
* Must be idempotent
* May be empty in this project (base catalogs live in migrations)

---

## 6. Admin / System Seeds

### Purpose

Bootstrap **system-level users**, not application users.

Examples:

* system_admin
* platform owner
* root operator

### Execution (MANUAL ONLY)

```bash
npm run db:seed:admin
```

### Rules

* Never auto-run
* Requires explicit CLI command
* Reads credentials from environment variables
* Safe to re-run (checks for existence)

---

## 7. Reset Database (Development Only)

Reset scripts are **manual and explicit**.

### Purpose

* Drop database
* Recreate database
* Re-run migrations
* Optionally re-run seeds

### Rules

* ❌ Never allowed in production
* Must be run intentionally
* Used only during development

---

## 8. Runtime Rule (Critical)

🚫 **No migrations**
🚫 **No seeds**
🚫 **No schema changes**

The application runtime must assume the database is already prepared.

---

## 9. Summary

* Migrations define **structure**
* Seeds define **initial context**
* Admin users are **bootstrap-only**
* Everything is explicit
* Nothing dangerous runs automatically

```
