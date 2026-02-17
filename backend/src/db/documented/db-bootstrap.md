

# Project Bootstrap Guide

This document explains **how to bootstrap the Fintrack backend from zero**.

It is intended for:

* New developers joining the project
* Fresh local setups
* CI / staging initialization

---

## Prerequisites

Before starting, ensure you have:

* Node.js (LTS recommended)
* npm
* PostgreSQL installed and running
* Access to a PostgreSQL superuser (usually `postgres`)

---

## Environment Configuration

Create a `.env` file at the root of the backend project.

### Required Variables

```
NODE_ENV=development

DATABASE_URI=postgresql://postgres:<password>@localhost:5432/fintrack_dev

SYSTEM_ADMIN_EMAIL=system_admin@fintrack.local
SYSTEM_ADMIN_PASSWORD=<strong_password_here>
```

Notes:

* `DATABASE_URI` must point to the **target database**, not `postgres`
* `SYSTEM_ADMIN_PASSWORD` is only used during admin bootstrap

---

## Step 1: Create the Database

Open a terminal and enter `psql` as a superuser:

```
psql -U postgres
```

Inside `psql`, run:

```
DROP DATABASE IF EXISTS fintrack_dev;
CREATE DATABASE fintrack_dev;
\q
```

This creates a clean database with no schema.

---

## Step 2: Run Migrations

Migrations create the entire schema.

Execute:

```
npm run db:migrate
```

This will:

* Create the `migrations` control table
* Create all base tables
* Apply migrations in correct order

Safe to run multiple times.

---

## Step 3: Seed Base Catalogs (Optional)

Base seeds populate static reference data (currencies, roles, types).

Run:

```
npm run db:seed:base
```

Notes:

* Intended for development and staging
* Idempotent (safe to re-run)

---

## Step 4: Create System Admin (Manual)

This step bootstraps the **system administrator**.

Run explicitly:

```
npm run db:seed:admin
```

Requirements:

* `SYSTEM_ADMIN_EMAIL` must be defined
* `SYSTEM_ADMIN_PASSWORD` must be defined

Behavior:

* Creates admin user if not present
* Skips if already exists
* Never auto-runs

---

## Step 5: Start the Application

Once database is ready:

```
npm run dev
```

The backend will now connect to an initialized database.

---

## Resetting the Database (Development Only)

To fully reset everything:

```
npm run db:reset
```

Then repeat:

```
npm run db:migrate
npm run db:seed:base
npm run db:seed:admin
```

⚠️ Never use reset in production.

---

## Production Notes

In production:

* Only migrations run automatically
* Seeds are disabled by default
* Admin creation is handled manually

---

## Summary Flow

```
Create DB → Migrate → Seed Base → Seed Admin → Start App
```

This ensures a predictable, safe, and reproducible setup.

---

If this file changes, review `docs/db-lifecycle.md` for lifecycle rules.
