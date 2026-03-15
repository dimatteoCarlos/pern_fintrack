# 📘 FinTrack Backend – Database Administration and Maintenance Guide

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
7. [Useful Commands (Complete Reference)](#-useful-commands-complete-reference)
8. [Troubleshooting](#-troubleshooting)

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

---

**finTrack** - Smart Financial Management © 2024