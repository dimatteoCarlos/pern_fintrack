#  PLAN DE INGENIERÍA DE DATOS  🔥
Establece las reglas de cómo se construye, se llena y se protege el sistema.

# GESTIÓN DE LA ESTRUCTURA (El esqueleto)
# 1🔹 Borrar base de datos (opcional, manual)
dropdb expensetracker_dev

# 2➡️ Borra completamente la base
createdb expensetracker_dev

# 3 ➡️ Crea una DB vacía
# 📌 expensetracker_dev es el nombre de la DB, debe coincidir con:

DATABASE_URI=postgresql://user:pass@localhost:5432/expensetracker_dev

# 🔹 2. Ejecutar migraciones
npm run db:migrate

✅ Cómo se protege (simple y efectivo)
🔐 1. Variable de entorno

En .env.production:

NODE_ENV=production
ALLOW_SEEDS=false


En .env.development:

NODE_ENV=development
ALLOW_SEEDS=true

🧱 2. Bloqueo explícito en código

Antes de ejecutar seeds:

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEEDS !== 'true') {
  throw new Error('❌ Seeds are disabled in production');
}

👉 Esto es protección externa, no lógica de negocio.

🔒 3. No tocar runtime

runSeeds.js no se importa en ningún controller

Solo se ejecuta por CLI:

node src/db/runSeeds.js

3️⃣ Primer usuario admin (opcional y seguro)
❓ ¿Por qué no usar el auth normal?

Porque:

Auth depende de tablas que aún no existen

Es un bootstrap, no un flujo de usuario

👉 Es como crear el primer root en Linux.

🧠 Cómo se hace correctamente

Se crea una sola vez

Con contraseña hasheada

Usando seed manual

🔑 Importante: el hash

Esto:
import bcrypt from 'bcrypt';

const hash = await bcrypt.hash('admin123', 10);
❗ NO es manual

Se ejecuta dentro del seed

No se pega a mano en SQL

Garantiza mismo algoritmo que el auth
🧩 Flujo COMPLETO real (esto es lo importante)
🧪 En desarrollo (PC local)
# 1. Crear DB (una sola vez)
createdb fintrack_dev

# 2. Migraciones (estructura)
npm run db:migrate

# 3. Seeds base (catálogos)
SEED_BASE=true node src/db/runSeeds.js

# 4. Admin opcional
SEED_ADMIN=true node src/db/runSeeds.js

🚀 En producción
# SOLO migraciones
npm run db:migrate


❌ Nunca seeds automáticos
❌ Nunca populateDB.js
❌ Nunca createTables.js

Excelente. Vamos **en orden**, con **explicación clara** y luego **código completo**, manteniendo tus decisiones (PERN, pg, pool, sin tocar runtime).

Voy a dividir esto en **3 bloques** como pediste, pero conectados como un solo flujo real.

---

# 1️⃣ Seed runner definitivo (qué es y cómo funciona)

## 📌 Qué es un *seed* (en la vida real)

* **Migraciones** → crean *estructura* (tablas, FKs, constraints)
* **Seeds** → insertan *datos iniciales* (catálogos, admin, demo)

👉 Un seed:

* **NO** debe correr automáticamente en producción
* **NO** debe estar en runtime (no se ejecuta cuando corre la app)
* **SÍ** debe poder ejecutarse manualmente y con control

---

## 📁 Estructura correcta de seeds

```
src/db/
 ├── migrations/
 ├── seeds/
 │    ├── 001_base_catalogs.sql
 │    ├── 002_default_roles.sql
 │    ├── 003_admin_user.js   ← usa bcrypt
 ├── runMigrations.js
 ├── runSeeds.js
 └── configDB.js
```

🔑 Regla:

* **SQL puro** → catálogos
* **JS** → cuando hay lógica (hash, fechas, condiciones)

---

## 🎛️ Cómo se controla qué seed corre

Usamos **flags por variables de entorno**, NO por código:

```bash
SEED_BASE=true
SEED_ADMIN=true
```

Esto evita:

* correr seeds por accidente
* tocar producción sin querer

---

## 🧠 Filosofía clave

> *“Seeds se ejecutan conscientemente, no automáticamente.”*

---

# 2️⃣ Protección de producción (esto es CRÍTICO)

## ❌ Lo que NO debe pasar nunca

* Que alguien ejecute seeds en prod
* Que un seed borre datos reales
* Que un script esté accesible desde la app

---

## ✅ Cómo se protege (simple y efectivo)

### 🔐 1. Variable de entorno

En `.env.production`:

```env
NODE_ENV=production
ALLOW_SEEDS=false
```

En `.env.development`:

```env
NODE_ENV=development
ALLOW_SEEDS=true
```

---

### 🧱 2. Bloqueo explícito en código

Antes de ejecutar seeds:

```js
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEEDS !== 'true') {
  throw new Error('❌ Seeds are disabled in production');
}
```

👉 Esto es **protección externa**, no lógica de negocio.

---

### 🔒 3. No tocar runtime

* `runSeeds.js` **no se importa** en ningún controller
* Solo se ejecuta por CLI:

```bash
node src/db/runSeeds.js
```

---

# 3️⃣ Primer usuario admin (opcional y seguro)

## ❓ ¿Por qué no usar el auth normal?

Porque:

* Auth depende de tablas que aún no existen
* Es un **bootstrap**, no un flujo de usuario

👉 Es como crear el **primer root** en Linux.

---

## 🧠 Cómo se hace correctamente

* Se crea **una sola vez**
* Con contraseña **hasheada**
* Usando seed manual

---

## 🔑 Importante: el hash

Esto:

```js
import bcrypt from 'bcrypt';

const hash = await bcrypt.hash('admin123', 10);
```

❗ **NO es manual**

* Se ejecuta dentro del seed
* No se pega a mano en SQL
* Garantiza mismo algoritmo que el auth

---

# 🧩 Flujo COMPLETO real (esto es lo importante)

### 🧪 En desarrollo (PC local)

```bash
# 1. Crear DB (una sola vez)
createdb fintrack_dev

# 2. Migraciones (estructura)
npm run db:migrate

# 3. Seeds base (catálogos)
SEED_BASE=true node src/db/runSeeds.js

# 4. Admin opcional
SEED_ADMIN=true node src/db/runSeeds.js
```

---

### 🚀 En producción

```bash
# SOLO migraciones
npm run db:migrate
```

❌ **Nunca** seeds automáticos
❌ **Nunca** populateDB.js
❌ **Nunca** createTables.js

---

# 🧹 Qué pasa con tu código actual

| Archivo            | Estado                   |
| ------------------ | ------------------------ |
| `createTables.js`  | 🗑️ Se elimina           |
| `populateDB.js`    | 🔁 Se convierte en seeds |
| `runMigrations.js` | ✅ Canon                  |
| `runSeeds.js`      | ✅ Controlado             |
| `pool/configDB.js` | ✅ Se mantiene            |

---

# 🧠 Resumen mental (qué debes recordar)

* **Migración** = estructura (siempre segura)
* **Seed** = datos (controlados, manuales)
* **Producción** = solo migraciones
* **Admin** = seed especial, opcional
* **Auth runtime** ≠ bootstrap DB

---




