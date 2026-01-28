Perfecto 👍
Aquí tienes **el contenido real, limpio y profesional** de **`docs/db-lifecycle.md`**, alineado 100% con lo que ya implementaste (reset manual, migrate automático, seeds controlados).

---

# Database Lifecycle

This document describes **how the database is managed across its lifecycle** in the Fintrack backend.

It defines **what runs**, **when it runs**, and **who is allowed to run it**.

---

## Scope

This document applies to:

* Local development
* Staging environments
* CI pipelines (partial)
* Production (with strict limitations)

---

## Core Principles

1. **Migrations define schema**
2. **Seeds define data**
3. **Runtime never mutates schema**
4. **Nothing destructive runs automatically**
5. **Production is immutable by default**

---

## Database Components

### 1. Migrations

**Location**

```
src/db/migrations/
```

**Purpose**

* Define the database schema
* Create tables, indexes, constraints, functions
* Track schema state via the `migrations` table

**Rules**

* Migrations are **append-only**
* Never edit an executed migration
* Never delete a migration that ran in any environment
* Order matters (numeric prefix)

**Execution**

```bash
npm run db:migrate
```

**Behavior**

* Runs pending migrations only
* Skips already executed migrations
* Uses `migrations` table as source of truth

---

### 2. Seeds

**Location**

```
src/db/seeds/
```

Seeds populate **data**, not schema.

They are **explicit, controlled, and never automatic**.

---

#### Seed Types

##### Base Seeds

**Purpose**

* Populate static reference data
* Catalogs (currencies, movement types, etc.)

**Naming**

```
base_*.js
```

**Execution**

```bash
npm run db:seed:base
```

**Environment Flag**

```
SEED_BASE=true
```

---

##### Admin Seed

**Purpose**

* Create the initial system administrator
* Bootstrap the platform
* Never auto-run

**Naming**

```
admin_*.js
```

**Execution**

```bash
npm run db:seed:admin
```

**Environment Flag**

```
SEED_ADMIN=true
```

**Notes**

* Idempotent (safe to re-run)
* Must be executed manually
* Uses `SYSTEM_ADMIN_EMAIL` and `SYSTEM_ADMIN_PASSWORD`

---

### 3. Reset (Development Only)

**Purpose**

* Completely wipe the database
* Remove all schema and data
* Reset migration state

**Location**

```
src/db/runResetDb.js
```

**Execution**

```bash
npm run db:reset
```

**Rules**

* DEV ONLY
* Forbidden in production
* Drops the database entirely
* Recreates it empty
* Does NOT run migrations or seeds

---

## Environment Responsibilities

### Development

Allowed:

* `db:reset`
* `db:migrate`
* `db:seed:base`
* `db:seed:admin`

Typical workflow:

```bash
npm run db:reset
npm run db:migrate
npm run db:seed:base
npm run db:seed:admin
```

---

### Staging

Allowed:

* `db:migrate`
* `db:seed:base` (if required)

Forbidden:

* `db:reset`
* `db:seed:admin`

---

### Production

Allowed:

* `db:migrate` (via deploy pipeline only)

Forbidden:

* `db:reset`
* All seeds by default

Admin creation must be handled **outside automated processes**.

---

## Migration State (`migrations` table)

* Stores executed migration filenames
* Represents schema version
* Is **state**, not code

### Reset Behavior

When the database is reset:

* The `migrations` table is deleted
* Schema state returns to zero
* First migration recreates it

This is expected and correct in development.

---

## Anti-Patterns (Do NOT Do This)

* ❌ Manually deleting tables
* ❌ Editing migration files after execution
* ❌ Running seeds automatically on app start
* ❌ Allowing destructive scripts in production
* ❌ Mixing schema and data logic

---

## Summary

| Action          | Tool         | Automatic    |
| --------------- | ------------ | ------------ |
| Schema creation | Migrations   | Yes (deploy) |
| Reference data  | Base seeds   | Optional     |
| System admin    | Admin seed   | No           |
| Full reset      | Reset script | No           |

---

**Database changes are intentional, explicit, and traceable.**

This lifecycle guarantees:

* Predictability
* Safety
* Reproducibility


