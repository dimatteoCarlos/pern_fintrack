# 📘 FinTrack Backend – Guía de Administración y Mantenimiento de Base de Datos

Esta guía está dedicada **exclusivamente a la administración y mantenimiento de la base de datos** de FinTrack. Aquí encontrarás todo lo necesario para gestionar el ciclo de vida completo de los datos: desde la creación inicial hasta la operación en producción, pasando por migraciones, seeds y protocolos de seguridad.

> ⚠️ **Nota**: Esta documentación cubre únicamente aspectos de base de datos. Para otros aspectos del sistema (API, autenticación, frontend), consulta la documentación específica.

---
## 🔄 Reinicio Completo de la Base de Datos

Esta secuencia es necesaria cuando deseas empezar desde cero, después de un reset, o cuando las migraciones no se ejecutaron correctamente.

### Comandos paso a paso:

| # | Comando | Propósito |
|---|---------|-----------|
| 1 | `dropdb fintrack_dev --if-exists` | Eliminar base de datos existente |
| 2 | `createdb fintrack_dev` | Crear base de datos nueva |
| 3 | `npm run db:migrate` | Ejecutar migraciones (crea todas las tablas) |
| 4 | `node src/db/runSeeds.js base` | Ejecutar seeds base (catálogos) |
| 5 | `node src/db/runSeeds.js admin` | Ejecutar seed admin (crea usuario administrador) |
| 6 | `npm run dev` | Iniciar la aplicación |

### Verificación:

```bash
psql -U postgres -d fintrack_dev -c "SELECT id, email, role FROM users;"
---

## 📊 Resumen Consolidado: Ciclo de Vida de Base de Datos FinTrack

| # | Etapa | Propósito | Windows (cmd) | Linux/Mac | ¿Producción? |
|---|-------|-----------|---------------|-----------|--------------|
| **1** | **Crear DB** | Base de datos limpia | `createdb fintrack_dev` | `createdb fintrack_dev` | ❌ No |
| **2** | **Migraciones** | Estructura (tablas, FKs) | `npm run db:migrate` | `npm run db:migrate` | ✅ Sí |
| **3** | **Seeds Base** | Catálogos (monedas, roles) | `set SEED_BASE=true && npm run db:seed` | `SEED_BASE=true npm run db:seed` | ❌ No |
| **4** | **Seeds Admin** | Usuario sistema (bootstrap) | `set SEED_ADMIN=true && npm run db:seed` | `SEED_ADMIN=true npm run db:seed` | ❌ Manual |
| **5** | **Verificar** | Comprobar datos | `psql -U postgres -d fintrack_dev -c "SELECT * FROM users;"` | `psql -U postgres -d fintrack_dev -c "SELECT * FROM users;"` | ✅ Sí |
| **6** | **Iniciar App** | Levantar servidor | `npm run dev` | `npm run dev` | `npm start` |

### 🔄 Comandos de Utilidad Rápida

| Operación | Windows (cmd) | Linux/Mac |
|-----------|---------------|-----------|
| **Reset completo** | `dropdb fintrack_dev --if-exists && createdb fintrack_dev && npm run db:migrate` | `dropdb fintrack_dev --if-exists && createdb fintrack_dev && npm run db:migrate` |
| **Seed combinado** | `set SEED_BASE=true && set SEED_ADMIN=true && npm run db:seed` | `SEED_BASE=true SEED_ADMIN=true npm run db:seed` |
| **Ver tablas** | `psql -U postgres -d fintrack_dev -c "\dt"` | `psql -U postgres -d fintrack_dev -c "\dt"` |
| **Conectar a PSQL** | `psql -U postgres -d fintrack_dev` | `psql -U postgres -d fintrack_dev` |

### ⚡ Flujo Rápido (Desarrollo)

**Windows:**
```cmd
createdb fintrack_dev && npm run db:migrate && set SEED_BASE=true && npm run db:seed
```

**Linux/Mac:**
```bash
createdb fintrack_dev && npm run db:migrate && SEED_BASE=true npm run db:seed
```

---

## 📑 Tabla de Contenidos

1. [Arquitectura y Filosofía](#-arquitectura-y-filosofía)
2. [Requisitos Previos](#-requisitos-previos)
3. [Configuración Inicial](#-configuración-inicial)
4. [Ciclo de Vida de la Base de Datos (Detallado)](#-ciclo-de-vida-de-la-base-de-datos-detallado)
   - [Creación de Base de Datos](#-creación-de-base-de-datos)
   - [Migraciones](#-migraciones-estructura)
   - [Seeds (Datos Iniciales)](#-seeds-datos-iniciales)
   - [Usuario Administrador](#-usuario-administrador-bootstrap)
5. [Entornos](#-entornos)
6. [Protocolo de Seguridad](#-protocolo-de-seguridad)
7. [Comandos Útiles (Referencia Completa)](#-comandos-útiles-referencia-completa)
8. [Resolución de Problemas](#-resolución-de-problemas)

---

## 🏗️ Arquitectura y Filosofía

FinTrack sigue una filosofía de **separación estricta** entre estructura y datos:

| Concepto | Propósito | ¿Automático en Producción? |
|----------|-----------|---------------------------|
| **Migraciones** | Estructura (tablas, constraints) | ✅ Sí |
| **Seeds Base** | Catálogos estáticos | ❌ No |
| **Seeds Admin** | Usuario sistema | ❌ No (manual) |
| **Reset** | Desarrollo local | ❌ No |

> ⚠️ **Regla de oro**: La aplicación en runtime **nunca** modifica la estructura de la base de datos.

---

## 📋 Requisitos Previos

Antes de comenzar, asegúrate de tener:

- ✅ Node.js (versión LTS recomendada)
- ✅ npm instalado
- ✅ PostgreSQL (versión 12 o superior)
- ✅ Acceso a superusuario de PostgreSQL (generalmente `postgres`)
- ✅ Git (opcional, para clonar el repositorio)

---

## ⚙️ Configuración Inicial

### 1. Clonar el repositorio (si aplica)

```bash
git clone <url-del-repositorio>
cd fintrack-backend
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
# Entorno
NODE_ENV=development

# Base de datos
DATABASE_URI=postgresql://postgres:tu_password@localhost:5432/fintrack_dev

# Usuario administrador (para bootstrap)
SYSTEM_ADMIN_EMAIL=system_admin@fintrack.local
SYSTEM_ADMIN_PASSWORD=una_contraseña_muy_segura_123

# Control de seeds
ALLOW_SEEDS=true
```

---

## 🔄 Ciclo de Vida de la Base de Datos (Detallado)

### 🗄️ Creación de Base de Datos

#### Windows (cmd):

```cmd
:: Verificar que PostgreSQL está corriendo
net start postgresql-x64-15

:: Entrar a PostgreSQL
psql -U postgres

:: Dentro de psql:
DROP DATABASE IF EXISTS fintrack_dev;
CREATE DATABASE fintrack_dev;
\q
```

#### Linux/Mac:

```bash
# Entrar a PostgreSQL
sudo -u postgres psql

# Dentro de psql:
DROP DATABASE IF EXISTS fintrack_dev;
CREATE DATABASE fintrack_dev;
\q
```

#### Comandos rápidos (alternativa):

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

### 📦 Migraciones (Estructura)

Las migraciones definen el **esqueleto** de la base de datos:

- Tablas
- Relaciones (claves foráneas)
- Índices
- Catálogos base

**Ejecutar migraciones:**

```bash
npm run db:migrate
```

**Características:**
- ✅ Idempotente (puede ejecutarse múltiples veces)
- ✅ Seguro para producción
- ✅ Mantiene historial en tabla `migrations`

---

### 🌱 Seeds (Datos Iniciales)

Los seeds insertan **datos contextuales**. Se dividen en dos tipos:

#### Seeds Base (Catálogos)

**Windows (cmd):**
```cmd
set SEED_BASE=true && npm run db:seed
```

**Linux/Mac:**
```bash
SEED_BASE=true npm run db:seed
```

**Ejemplos de datos base:**
- Monedas (USD, EUR, COP)
- Roles de usuario
- Tipos de transacción
- Categorías predefinidas

#### Seeds Admin (Usuario del Sistema)

**Windows (cmd):**
```cmd
set SEED_ADMIN=true && npm run db:seed
```

**Linux/Mac:**
```bash
SEED_ADMIN=true npm run db:seed
```

**Seed combinado (múltiples flags):**

**Windows (cmd):**
```cmd
set SEED_BASE=true && set SEED_ADMIN=true && npm run db:seed
```

**Linux/Mac:**
```bash
SEED_BASE=true SEED_ADMIN=true npm run db:seed
```

---

### 👤 Usuario Administrador (Bootstrap)

El primer administrador se crea **una sola vez** mediante seed manual.

**Requisitos:**
- `SYSTEM_ADMIN_EMAIL` definido en `.env`
- `SYSTEM_ADMIN_PASSWORD` definido en `.env`

**Características:**
- La contraseña se hashea con `bcrypt` (nunca en texto plano)
- El script verifica existencia previa
- No se puede ejecutar accidentalmente

---

## 🌍 Entornos

| Entorno | Migraciones | Seeds Base | Seeds Admin | Reset |
|---------|-------------|------------|-------------|-------|
| **Desarrollo** | ✅ Manual / CI | ✅ Manual | ✅ Manual | ✅ Permitido |
| **Staging** | ✅ Automático | ⚠️ Opcional | ❌ Manual | ⚠️ Restringido |
| **Producción** | ✅ Automático | ❌ No | ❌ Manual | ❌ Prohibido |

---

## 🛡️ Protocolo de Seguridad

### 1. Protección por Entorno

```javascript
// runSeeds.js
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEEDS !== 'true') {
  throw new Error('❌ Seeds están deshabilitados en producción');
}
```

### 2. Aislamiento del Runtime

- Los seeds **nunca** se importan en controladores
- Solo se ejecutan vía CLI
- No hay endpoints HTTP que activen seeds

### 3. Variables de Control

```env
# En producción:
NODE_ENV=production
ALLOW_SEEDS=false

# En desarrollo:
NODE_ENV=development
ALLOW_SEEDS=true
```

---

## 🚀 Comandos Útiles (Referencia Completa)

### Configuración Completa (Desarrollo)

**Windows (cmd):**
```cmd
:: 1. Resetear base de datos
dropdb fintrack_dev --if-exists
createdb fintrack_dev

:: 2. Ejecutar migraciones
npm run db:migrate

:: 3. Seeds base
set SEED_BASE=true && npm run db:seed

:: 4. Admin (opcional)
set SEED_ADMIN=true && npm run db:seed

:: 5. Iniciar aplicación
npm run dev
```

**Linux/Mac:**
```bash
# 1. Resetear base de datos
dropdb fintrack_dev --if-exists
createdb fintrack_dev

# 2. Ejecutar migraciones
npm run db:migrate

# 3. Seeds base
SEED_BASE=true npm run db:seed

# 4. Admin (opcional)
SEED_ADMIN=true npm run db:seed

# 5. Iniciar aplicación
npm run dev
```

### Scripts NPM Disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run db:migrate` | Ejecuta migraciones |
| `npm run db:seed` | Ejecuta seeds (controlado por flags) |
| `npm run db:reset` | Reset completo (solo desarrollo) |
| `npm run dev` | Inicia servidor de desarrollo |
| `npm start` | Inicia servidor en producción |

### Verificación de Datos

**Windows (cmd):**
```cmd
:: Conectar a la base de datos
psql -U postgres -d fintrack_dev

:: Comandos útiles dentro de psql:
\dt                    :: Listar tablas
SELECT * FROM users;   :: Ver usuarios
\q                     :: Salir
```

**Linux/Mac:**
```bash
# Conectar a la base de datos
psql -U postgres -d fintrack_dev

# Comandos útiles dentro de psql:
\dt                    # Listar tablas
SELECT * FROM users;   # Ver usuarios
\q                     # Salir
```

---

## 🔧 Resolución de Problemas

### Error: "Database does not exist"

**Windows (cmd):**
```cmd
:: Solución: Crear la base de datos
createdb fintrack_dev
```

**Linux/Mac:**
```bash
# Solución: Crear la base de datos
createdb fintrack_dev
```

### Error: "Seeds are disabled in production"

```bash
# Verificar variables de entorno
echo %NODE_ENV%        # Windows
echo $NODE_ENV         # Linux/Mac
echo %ALLOW_SEEDS%     # Windows
echo $ALLOW_SEEDS      # Linux/Mac

# Si es producción, no ejecutar seeds
# Si es necesario, establecer ALLOW_SEEDS=true con precaución
```

### Error: "Relation already exists"

```bash
# Las migraciones ya se ejecutaron
# Verificar estado:
psql -U postgres -d fintrack_dev -c "SELECT * FROM migrations;"
```

### Error de autenticación en PostgreSQL

**Windows (cmd):**
```cmd
:: Verificar que PostgreSQL está corriendo
net start postgresql-x64-15

:: Verificar versión instalada
pg_config --version
```

**Linux/Mac:**
```bash
# Verificar que PostgreSQL está corriendo
sudo systemctl status postgresql

# Verificar versión
postgres --version
```

---

## 📚 Resumen del Flujo

```
┌─────────────────┐
│   Crear DB      │  createdb fintrack_dev
└────────┬────────┘
         ↓
┌─────────────────┐
│  Migraciones    │  npm run db:migrate
└────────┬────────┘
         ↓
┌─────────────────┐
│  Seeds Base     │  Windows: set SEED_BASE=true && npm run db:seed
│                 │  Linux/Mac: SEED_BASE=true npm run db:seed
└────────┬────────┘
         ↓
┌─────────────────┐
│  Seeds Admin    │  Windows: set SEED_ADMIN=true && npm run db:seed
│                 │  Linux/Mac: SEED_ADMIN=true npm run db:seed
└────────┬────────┘
         ↓
┌─────────────────┐
│  Iniciar App    │  npm run dev
└─────────────────┘
```

---

## 📖 Notas Adicionales

- **Siempre** verificar el entorno antes de ejecutar comandos destructivos
- Los seeds admin son **irreversibles** pero seguros (verifican existencia)
- En producción, **solo migraciones automáticas**
- Mantén tu archivo `.env` fuera del control de versiones
- En Windows, usa `&&` para encadenar comandos y `set` para variables de entorno temporales

---

**finTrack** - Gestión financiera inteligente © 2024