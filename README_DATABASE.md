## 📘 FinTrack Backend – Database Administration and Maintenance Guide

This guide is dedicated **exclusively to the administration and maintenance of the FinTrack database**. Here you will find everything needed to manage the complete data lifecycle: from initial creation to production operation, including migrations, seeds, and security protocols.

> ⚠️ **Note**: This documentation covers database aspects only. For other system aspects (API, authentication, frontend), consult the specific documentation.

---

## 📊 Consolidated Summary: FinTrack Database Lifecycle

| # | Stage | Purpose | Windows (cmd) | Linux/Mac | Production? |
|---|-------|---------|---------------|-----------|-------------|
| **1** | **Create DB** | Clean database | `createdb fintrack_dev` | `createdb fintrack_dev` | ❌ No |
| **2** | **Migrations** | Structure (tables, FKs) | `npm run db:migrate` | `npm run db:migrate` | ✅ Yes |
| **3** | **Base Seeds** | Catalogs (currencies, roles) | `set SEED_BASE=true && npm run db:seed` | `SEED_BASE=true npm run db:seed` | ❌ No |
| **4** | **Admin Seeds** | System user (bootstrap) | `set SEED_ADMIN=true && npm run db:seed` | `SEED_ADMIN=true npm run db:seed` | ❌ Manual |
| **5** | **Verify** | Check data | `psql -U postgres -d fintrack_dev -c "SELECT * FROM users;"` | `psql -U postgres -d fintrack_dev -c "SELECT * FROM users;"` | ✅ Yes |
| **6** | **Start App** | Launch server | `npm run dev` | `npm run dev` | `npm start` |

### 🔄 Quick Utility Commands

| Operation | Windows (cmd) | Linux/Mac |
|-----------|---------------|-----------|
| **Full reset** | `dropdb fintrack_dev --if-exists && createdb fintrack_dev && npm run db:migrate` | `dropdb fintrack_dev --if-exists && createdb fintrack_dev && npm run db:migrate` |
| **Combined seed** | `set SEED_BASE=true && set SEED_ADMIN=true && npm run db:seed` | `SEED_BASE=true SEED_ADMIN=true npm run db:seed` |
| **View tables** | `psql -U postgres -d fintrack_dev -c "\dt"` | `psql -U postgres -d fintrack_dev -c "\dt"` |
| **Connect to PSQL** | `psql -U postgres -d fintrack_dev` | `psql -U postgres -d fintrack_dev` |

### ⚡ Quick Flow (Development)

**Windows:**
```cmd
createdb fintrack_dev && npm run db:migrate && set SEED_BASE=true && npm run db:seed
```

**Linux/Mac:**
```bash
createdb fintrack_dev && npm run db:migrate && SEED_BASE=true npm run db:seed
```

---

## 📑 Table of Contents

1. [Architecture and Philosophy](#-architecture-and-philosophy)
2. [Prerequisites](#-prerequisites)
3. [Initial Configuration](#-initial-configuration)
4. [Database Lifecycle (Detailed)](#-database-lifecycle-detailed)
   - [Database Creation](#-database-creation)
   - [Migrations](#-migrations-structure)
   - [Seeds (Initial Data)](#-seeds-initial-data)
   - [Admin User](#-admin-user-bootstrap)
5. [Environments](#-environments)
6. [Security Protocol](#-security-protocol)
7. [⚠️ WARNING TABLE: Destructive Operations](#️-warning-table-destructive-operations)
8. [Useful Commands (Complete Reference)](#-useful-commands-complete-reference)
9. [Troubleshooting](#-troubleshooting)

---

## 🏗️ Architecture and Philosophy

FinTrack follows a philosophy of **strict separation** between structure and data:

| Concept | Purpose | Automatic in Production? |
|---------|---------|-------------------------|
| **Migrations** | Structure (tables, constraints) | ✅ Yes |
| **Base Seeds** | Static catalogs | ❌ No |
| **Admin Seeds** | System user | ❌ No (manual) |
| **Reset** | Local development | ❌ No |

> ⚠️ **Golden rule**: The runtime application **never** modifies the database structure.

---

## 📋 Prerequisites

Before starting, make sure you have:

- ✅ Node.js (LTS version recommended)
- ✅ npm installed
- ✅ PostgreSQL (version 12 or higher)
- ✅ Access to PostgreSQL superuser (usually `postgres`)
- ✅ Git (optional, for cloning the repository)

---

## ⚙️ Initial Configuration

### 1. Clone the repository (if applicable)

```bash
git clone <repository-url>
cd fintrack-backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
# Environment
NODE_ENV=development

# Database
DATABASE_URI=postgresql://postgres:your_password@localhost:5432/fintrack_dev

# Admin user (for bootstrap)
SYSTEM_ADMIN_EMAIL=system_admin@fintrack.local
SYSTEM_ADMIN_PASSWORD=a_very_secure_password_123

# Seed control
ALLOW_SEEDS=true
```

---

## 🔄 Database Lifecycle (Detailed)

### 🗄️ Database Creation

#### Windows (cmd):

```cmd
:: Verify PostgreSQL is running
net start postgresql-x64-15

:: Enter PostgreSQL
psql -U postgres

:: Inside psql:
DROP DATABASE IF EXISTS fintrack_dev;
CREATE DATABASE fintrack_dev;
\q
```

#### Linux/Mac:

```bash
# Enter PostgreSQL
sudo -u postgres psql

# Inside psql:
DROP DATABASE IF EXISTS fintrack_dev;
CREATE DATABASE fintrack_dev;
\q
```

#### Quick commands (alternative):

**Windows (cmd):**
```cmd
dropdb fintrack_dev --if-exists
createdb fintrack_dev
```

**Linux/Mac:**
```bash
dropdb fintrack_dev --if-exists
createdb fintrack_dev
```

---

### 📦 Migrations (Structure)

Migrations define the database **skeleton**:

- Tables
- Relationships (foreign keys)
- Indexes
- Base catalogs

**Run migrations:**

```bash
npm run db:migrate
```

**Characteristics:**
- ✅ Idempotent (can be run multiple times)
- ✅ Safe for production
- ✅ Maintains history in `migrations` table

---

### 🌱 Seeds (Initial Data)

Seeds insert **contextual data**. They are divided into two types:

#### Base Seeds (Catalogs)

**Windows (cmd):**
```cmd
set SEED_BASE=true && npm run db:seed
```

**Linux/Mac:**
```bash
SEED_BASE=true npm run db:seed
```

**Examples of base data:**
- Currencies (USD, EUR, COP)
- User roles
- Transaction types
- Predefined categories

#### Admin Seeds (System User)

**Windows (cmd):**
```cmd
set SEED_ADMIN=true && npm run db:seed
```

**Linux/Mac:**
```bash
SEED_ADMIN=true npm run db:seed
```

**Combined seed (multiple flags):**

**Windows (cmd):**
```cmd
set SEED_BASE=true && set SEED_ADMIN=true && npm run db:seed
```

**Linux/Mac:**
```bash
SEED_BASE=true SEED_ADMIN=true npm run db:seed
```

---

### 👤 Admin User (Bootstrap)

The first administrator is created **once** through manual seed.

**Requirements:**
- `SYSTEM_ADMIN_EMAIL` defined in `.env`
- `SYSTEM_ADMIN_PASSWORD` defined in `.env`

**Characteristics:**
- Password is hashed with `bcrypt` (never in plain text)
- Script checks for existing records
- Cannot be executed accidentally

---

## 🌍 Environments

| Environment | Migrations | Base Seeds | Admin Seeds | Reset |
|-------------|------------|------------|-------------|-------|
| **Development** | ✅ Manual / CI | ✅ Manual | ✅ Manual | ✅ Allowed |
| **Staging** | ✅ Automatic | ⚠️ Optional | ❌ Manual | ⚠️ Restricted |
| **Production** | ✅ Automatic | ❌ No | ❌ Manual | ❌ Prohibited |

---

## 🛡️ Security Protocol

### 1. Environment Protection

```javascript
// runSeeds.js
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEEDS !== 'true') {
  throw new Error('❌ Seeds are disabled in production');
}
```

### 2. Runtime Isolation

- Seeds are **never** imported in controllers
- Only executed via CLI
- No HTTP endpoints that trigger seeds

### 3. Control Variables

```env
# In production:
NODE_ENV=production
ALLOW_SEEDS=false

# In development:
NODE_ENV=development
ALLOW_SEEDS=true
```

---

## ⚠️ WARNING TABLE: Destructive Operations

This table documents **operations that permanently modify or delete data**. Always verify your environment before executing.

| # | Operation | Command | Destructive Level | Irreversible | Production Allowed | Precaution |
|---|-----------|---------|-------------------|--------------|-------------------|------------|
| **1** | **Drop Database** | `dropdb fintrack_dev --if-exists` | 🔴 FULL | ✅ Yes | ❌ No | Deletes ALL tables and data. No recovery. |
| **2** | **Run Reset DB** | `node src/db/runResetDb.js` | 🔴 FULL | ✅ Yes | ❌ No | Drops schema, recreates tables, runs seeds. Complete wipe. |
| **3** | **Drop Schema** | `DROP SCHEMA public CASCADE;` | 🔴 FULL | ✅ Yes | ❌ No | Removes all tables, functions, views. |
| **4** | **Truncate Tables** | `TRUNCATE TABLE users CASCADE;` | 🟠 HIGH | ⚠️ Yes (no FK check) | ❌ No | Deletes all rows. Resets sequences. |
| **5** | **Delete Records** | `DELETE FROM users WHERE id = 1;` | 🟡 MEDIUM | ⚠️ Yes (no backup) | ⚠️ With WHERE | Can delete critical admin users. |
| **6** | **Run Migrations** | `npm run db:migrate` | 🟢 LOW | ❌ No | ✅ Yes | Safe. Only adds structure. |
| **7** | **Run Base Seeds** | `SEED_BASE=true npm run db:seed` | 🟡 MEDIUM | ⚠️ Partial | ❌ No | Can duplicate catalog data if run twice. |
| **8** | **Run Admin Seeds** | `SEED_ADMIN=true npm run db:seed` | 🟡 MEDIUM | ⚠️ Partial | ❌ Manual | Creates system admin. Checks existence first. |
| **9** | **ALTER TABLE DROP COLUMN** | `ALTER TABLE users DROP COLUMN email;` | 🔴 FULL | ✅ Yes | ❌ No | Permanent column deletion. Data loss. |
| **10** | **UPDATE without WHERE** | `UPDATE users SET role = 'admin';` | 🔴 FULL | ✅ Yes | ❌ No | Updates ALL rows. Privilege escalation risk. |

### 🟢 Destructive Level Legend

| Level | Color | Meaning | Example |
|-------|-------|---------|---------|
| **LOW** | 🟢 | Safe, reversible | Adding columns, running migrations |
| **MEDIUM** | 🟡 | Potentially destructive, partially reversible | Deleting specific records, truncating tables |
| **HIGH** | 🟠 | Very destructive, difficult to reverse | Truncate cascade, bulk deletes |
| **FULL** | 🔴 | Completely destructive, irreversible | Drop database, drop schema, drop column |

### ⚡ Pre-Run Checklist

Before executing any **FULL** or **HIGH** destructive operation:

- [ ] Verify `NODE_ENV` is NOT `production` (or understand the risks)
- [ ] Create a database backup: `pg_dump fintrack_dev > backup_$(date +%Y%m%d_%H%M%S).sql`
- [ ] Confirm the command with a second person (team environment)
- [ ] Test on staging environment first
- [ ] Have a rollback plan ready

### 🛡️ Production Safety Rules

| Rule | Description |
|------|-------------|
| **Rule 1** | Never run `runResetDb.js` in production |
| **Rule 2** | Never run seeds automatically in production |
| **Rule 3** | Always backup before destructive operations |
| **Rule 4** | Use transactions for manual `DELETE`/`UPDATE` |
| **Rule 5** | Keep `ALLOW_SEEDS=false` in production `.env` |

### 🔐 Protection Mechanisms in Code

```javascript
// Example: runResetDb.js protection
if (process.env.NODE_ENV === 'production') {
  console.error('❌ This script cannot run in production!');
  process.exit(1);
}

// Example: runSeeds.js protection  
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEEDS !== 'true') {
  throw new Error('❌ Seeds are disabled in production');
}

// Example: Migration protection (PostgreSQL)
BEGIN;
  -- Your migration here
COMMIT;  -- Only commit if successful
-- ROLLBACK; -- Use if something went wrong
```

### 📝 Quick Reference: Safe vs Unsafe

| ✅ SAFE to run anytime | ❌ NEVER run automatically | ⚠️ ONLY with caution |
|----------------------|---------------------------|---------------------|
| `npm run db:migrate` | `dropdb fintrack_dev` | `node src/db/runSeeds.js` |
| `npm run dev` | `node src/db/runResetDb.js` | `DELETE FROM ...` (with WHERE) |
| `psql -c "SELECT ..."` | `DROP SCHEMA public CASCADE` | `UPDATE ... SET ...` (with WHERE) |
| View queries | `TRUNCATE TABLE ... CASCADE` | `ALTER TABLE ... DROP COLUMN` |

---

## 🚀 Useful Commands (Complete Reference)

### Full Setup (Development)

**Windows (cmd):**
```cmd
:: 1. Reset database
dropdb fintrack_dev --if-exists
createdb fintrack_dev

:: 2. Run migrations
npm run db:migrate

:: 3. Base seeds
set SEED_BASE=true && npm run db:seed

:: 4. Admin (optional)
set SEED_ADMIN=true && npm run db:seed

:: 5. Start application
npm run dev
```

**Linux/Mac:**
```bash
# 1. Reset database
dropdb fintrack_dev --if-exists
createdb fintrack_dev

# 2. Run migrations
npm run db:migrate

# 3. Base seeds
SEED_BASE=true npm run db:seed

# 4. Admin (optional)
SEED_ADMIN=true npm run db:seed

# 5. Start application
npm run dev
```

### Available NPM Scripts

| Command | Description |
|---------|-------------|
| `npm run db:migrate` | Run migrations |
| `npm run db:seed` | Run seeds (controlled by flags) |
| `npm run db:reset` | Full reset (development only) |
| `npm run dev` | Start development server |
| `npm start` | Start production server |

### Data Verification

**Windows (cmd):**
```cmd
:: Connect to database
psql -U postgres -d fintrack_dev

:: Useful commands inside psql:
\dt                    :: List tables
SELECT * FROM users;   :: View users
\q                     :: Exit
```

**Linux/Mac:**
```bash
# Connect to database
psql -U postgres -d fintrack_dev

# Useful commands inside psql:
\dt                    # List tables
SELECT * FROM users;   # View users
\q                     # Exit
```

---

## 🔧 Troubleshooting

### Error: "Database does not exist"

**Windows (cmd):**
```cmd
:: Solution: Create the database
createdb fintrack_dev
```

**Linux/Mac:**
```bash
# Solution: Create the database
createdb fintrack_dev
```

### Error: "Seeds are disabled in production"

```bash
# Check environment variables
echo %NODE_ENV%        # Windows
echo $NODE_ENV         # Linux/Mac
echo %ALLOW_SEEDS%     # Windows
echo $ALLOW_SEEDS      # Linux/Mac

# If in production, do not run seeds
# If necessary, set ALLOW_SEEDS=true with caution
```

### Error: "Relation already exists"

```bash
# Migrations have already been executed
# Check status:
psql -U postgres -d fintrack_dev -c "SELECT * FROM migrations;"
```

### PostgreSQL authentication error

**Windows (cmd):**
```cmd
:: Verify PostgreSQL is running
net start postgresql-x64-15

:: Check installed version
pg_config --version
```

**Linux/Mac:**
```bash
# Verify PostgreSQL is running
sudo systemctl status postgresql

# Check version
postgres --version
```

---

## 📚 Flow Summary

```
┌─────────────────┐
│   Create DB     │  createdb fintrack_dev
└────────┬────────┘
         ↓
┌─────────────────┐
│   Migrations    │  npm run db:migrate
└────────┬────────┘
         ↓
┌─────────────────┐
│   Base Seeds    │  Windows: set SEED_BASE=true && npm run db:seed
│                 │  Linux/Mac: SEED_BASE=true npm run db:seed
└────────┬────────┘
         ↓
┌─────────────────┐
│   Admin Seeds   │  Windows: set SEED_ADMIN=true && npm run db:seed
│                 │  Linux/Mac: SEED_ADMIN=true npm run db:seed
└────────┬────────┘
         ↓
┌─────────────────┐
│   Start App     │  npm run dev
└─────────────────┘
```

---

## 📖 Additional Notes

- **Always** verify the environment before executing destructive commands
- Admin seeds are **irreversible** but safe (they check for existence)
- In production, **only automatic migrations**
- Keep your `.env` file out of version control
- In Windows, use `&&` to chain commands and `set` for temporary environment variables
- Refer to the **Warning Table** above before running any destructive operation

---

**finTrack** - Smart Financial Management © 2024