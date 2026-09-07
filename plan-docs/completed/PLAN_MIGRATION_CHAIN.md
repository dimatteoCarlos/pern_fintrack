# PLAN_MIGRATION_CHAIN — dejar la cadena en condiciones de aplicarse

**State: closed 2026-09-06.** All six steps of section 4 have landed and section 0
names what each one produced. Written 2026-09-02 on the branch `fix/auth-screen`;
everything it asked for is on `main` today.

*Written in Spanish, before the English-prose rule of 2026-09-03. Section 0 and the
closing blocks follow the rule; the body is left as it was written rather than
translated, because a translation would restate measurements instead of preserving
them.*

Origen: sección F de `HANDOFF_AGENTES.md` y la sección 9.4.24 del plan de
retro-fechado, corregidas ambas el 2026-09-02.

---

## 0. Correction — 2026-09-06

Written in English, which superseded the Spanish-prose rule for this repository
on 2026-09-03. Three things this document states as open are closed, and reading
it without them wastes a session.

**The two runner defects are fixed.** §1 and §4 steps 2-3 describe them as live.
They are not:

- The migration and its ledger row now commit **together**. `runMigrations.js`
 opens one transaction per file, runs the file, inserts the ledger row and
 commits, rolling back both on failure. The comment above that block states the
 invariant and the reason no file in `sql_migrations/` may carry its own `BEGIN`.
- The exit code is decided **once**, after `client.release()` and `pool.end()`,
 through an `exitCode` variable. `process.exit` is no longer called from inside
 the catch.

**Production is not six files behind. It is two.** §1 and §4 paso 0 rest on the
2026-08-27 reading — 19 ledger rows, pending `019` to `024`. A later reading
supersedes it: `plan-docs/NEXT_SESSION.md` §2.1 records a read-only connection of
2026-09-03 that applied `019` through `028` and verified each one individually
against the live database, leaving **29 rows**. Pending today is `029` and `030`.

**Nothing is pending since 2026-09-06.** Both files were applied to production
that day and verified against the database: 31 ledger rows closing on
`030_add_jpy_currency.sql`, and both of `029`'s indexes present. Production and
`sql_migrations/` now hold the same chain, so the next file written is the first
one production will be missing. The run is recorded in
`PLAN_CURRENCY_TO_PRODUCTION.md` §10 and the target checks it produced are in
`db-migration-procedure.md` §5.0.

**A third defect was found on 2026-09-06 and fixed**, and it is the kind this
plan exists to prevent. `029_pocket_board_month_indexes.sql` carried its `DOWN`
block as live SQL instead of comments, so the runner — which reads the whole file
and executes it as one statement — created the two indexes and dropped them again
inside the same transaction, then reported success and wrote the ledger row.
Measured on a database built from empty through the whole chain: ledger row
present, zero indexes. It went unseen because `createTables.js:536` and `:539`
create the same two indexes on every boot, and the runtime path covered for it.
All thirty files were scanned for the same shape; `029` was the only one, and
`001`-`009` have no `DOWN` block at all, which is pre-convention rather than a
defect.

**What this adds to §3.** The reversal rule of §3 says a `DOWN` block is required
from `025` onward. It now also has a form: **commented out, and marked "run
manually"**, like every other file on the chain. A live `DOWN` is not a reversal,
it is a self-cancelling migration that reports success.

**The four remaining steps landed too, measured 2026-09-06.** Section 4 describes
steps 1, 4, 5 and 6 as pending. None is:

- **Step 1, the column the boot path did not declare.** `createTables.js:204`
 declares `opening_for_account_id INTEGER REFERENCES user_accounts(account_id) ON
 DELETE RESTRICT ON UPDATE CASCADE`, so a database built by the boot path no longer
 fails on every insert that names it.
- **Step 4, the reversal from `025` onward.** `migrations/TEMPLATE_migration.sql`
 exists and carries the form the correction above gives it: the `DOWN` block
 commented out and marked to be run by hand.
- **Step 5, parity between the two build paths.** `migrations/schemaParity.js`,
 `npm run db:parity`. It builds one throwaway database by each path and compares
 the columns, the constraints and the six seeded catalogs, refusing to run against
 a connection string that names production.
- **Step 6, how the ledger receives a database built by the DDL.** Written as
 section 7 of `backend/src/db/docs/db-documented/db-migration-procedure.md`: which
 reading decides that a file may be marked, why a backfill cannot be judged from
 the schema, the rehearsal on a restored copy, and the four things that must never
 be done. **Written, not executed** — exactly as the step specifies, and
 executing it stays the developer's separate decision.

---

## 0-bis. Correction and retirement register — 2026-09-07

Written in English. Measured in the `main` working tree on 2026-09-07. Every
site below is cited by a greppable expression and not by a line number: a number
carries the branch and the commit it was read in, and `feat/overview` is not
`main`.

### Two applied migrations carry prose that is false

An applied migration is not edited, prose included (§5), so a correction is
written in the file that **causes** the change. That rule has a limit, and the
limit is why the register below exists at all.

**031's near-miss paragraph and its "reconcile by hand" were void the day 031
landed.** Its header describes a hazard — the compensation-account lookup in
`checkAndInsertAccount.js` matching the name case-insensitively, so an account
named `Slack` would be handed back as the compensation counterpart while every
read filter counted it among the owner's — and disclaims it as "not this file's
to fix". The exact-case match that closes that hazard shipped **in 031's own
commit**. The correction is written above the lookup query in
`backend/src/utils/fintrackUtils/accountManagement/checkAndInsertAccount.js`.
What survives: the `NOTICE` still fires on a case-variant row and still reports
two true things — those rows are left untouched, and the read filters do not
exclude them. What died: the reason it states, and the instruction that follows
from it.

**031's rollback ordering note is false since 033.** It states that deleting the
`account_types` row for `boundary` while an account still points at it "does not
fail: it blanks the type on that account", and cites the boot DDL declaration of
`user_accounts.account_type_id` as its authority. After `eeb5262b` that `DELETE`
raises a foreign key violation, and the cited declaration now says the opposite
of what 031 says it says. The correction is in 033's own header, which is where
it belongs.

**The rule, and the limit that produced this section.** The correction lives in
the file that causes the change, and that only works forwards. A sealed file
cannot correct itself, and it cannot correct what happens after it — 031's
rollback note could not be corrected until 033 existed to correct it. Whatever
034 seals will need 035 for the same reason, unless the correction has somewhere
amendable to go. This document is that place.

### Register — `user_accounts.account_type_id` is `NOT NULL` behind an `ON DELETE RESTRICT` foreign key

Established by `033_require_account_type.sql` on both build paths (`eeb5262b`,
2026-09-07): the migration covers the chain, and `ensureAccountTypeRequired()`
in `createTables.js`, called from `initializeDatabase()`, covers a database that
already has the table — `CREATE TABLE IF NOT EXISTS` never alters one.

Keyed by the constraint and not by the migration number, because the reader this
list exists for is someone editing a query, who has no reason to open a migration
plan. What they can reach is the constraint that made their guard dead.

**What makes a site retirable, and it is not the join keyword.** Every `LEFT
JOIN` onto `account_types` that hangs off a guaranteed account row is now
*equivalent* to an inner join, and equivalence is never a reason to touch working
code. A site is retirable when it **states something the constraint made false**.
A redundant guard costs nothing; a comment asserting that the column is nullable
costs the next reader an hour. The distinction is the overview session's and it
is the right one.

| site | the statement the constraint falsified | owner | state |
|---|---|---|---|
| `dashboardMonthlyTotalAmountByType.js` | the join was added for the nullable case | coordination session | retired, `feb33c39` |
| `getAnnulmentImpactReport.js` | the comment names the column nullable "until migration 033 enforces NOT NULL/RESTRICT" | deletion session | accepted by its owner, open |
| `overviewAccountRepository.js`, the profit-and-loss account set | the comment stated the column is `ON DELETE SET NULL` | overview session | retired, `f561f9c9`, on `feat/overview` |

**Equivalent under the constraint, and deliberately left alone.** An inner join
returns the same rows here, but none of these sites states a nullable reason and
none filters on the type — they select `account_type_name` and pass it outward.
Changing them is tidying, and tidying is its own commit if it is anything.

- `overviewTransactionRepository.js`, five occurrences of the same expression,
 one per query.
- the five-row recent-activity query in `overviewPageRepository.js`, whose join
 was already `LEFT` before that module compared the type at all. It was never
 written for the nullable case, so retiring it would be a decision the retirement
 commit did not make. Its owner left it `LEFT` with the reason on the line.

**Sites the constraint does not retire at all**, recorded so that the sweep does
not overrun into them. These are not equivalent — turning them inner drops rows:

- `transactionController.js`, the joins aliased `sat` and `dat`. They hang off
 the transfer counterpart accounts `sa` and `da`, which are legitimately absent
 on a movement that is not a transfer. The `LEFT` there is about the account,
 not about the type.
- `transactionController.js`, the join aliased `act`. It hangs off `ua`, which is
 itself `LEFT JOIN`ed from `transactions.account_id`. Whether that account is
 guaranteed is a separate constraint question, and 033 does not settle it.
- `getTransactionsForAccountById.js`, already an inner join.

**Why this list was never three entries.** 033's header names two retirable
sites. A third was created in a commit that was in flight while 033 was being
written. A migration header can only list what one author knew at one moment;
every site found later is orphaned by construction. That is the whole argument
for keeping the list here instead.

**A count of sites is a count within one checkout, and this one is `main`'s.**
Eight `LEFT JOIN`s onto `account_types` were open in `main` when this was
measured, and exactly one of them carried a statement the constraint falsified.
The site the overview session actually retired is not among the eight: it exists
only on `feat/overview`, added there by a later commit, and no grep of `main`
could see it. Two separate facts, and collapsing them loses the second: the
branch is why the site was invisible from here, and the **merge** is why it went
false. Nobody edited that comment. 033 landed on `main`, the branch merged it
hours later for an unrelated reason, and a true sentence outlived its condition
with no commit against the file to mark the moment. So the register
records the tree each entry was read in, and cites shape rather than line: the
one site that moved between branches proved the rule the same day it was written.

### Convention from 034 onward

A migration that establishes a constraint carries **one line pointing at this
register** and does not try to hold the list itself. The migration is the
pointer, the register is the list. 033 is applied and cannot gain that line,
which is the argument for the convention rather than an exception to it.

The same pointer belongs on the constraint's declaration in `createTables.js`:
that file is the live schema declaration, it is amendable, and it is what a
reader of either build path actually opens.

---

## 1. Qué está mal hoy

El proyecto tiene dos caminos para construir un esquema y ninguno de los dos es
el camino oficial.

- **La cadena de migraciones**, veinticuatro archivos en
  `backend/src/db/migrations/sql_migrations/`, corridos por `runMigrations.js`.
  Es el camino que la base de desarrollo recorrió.
- **El DDL de arranque**, `backend/src/db/run_time_db_init/createTables.js`,
  invocado por `initializeDatabase()` desde `backend/src/index.js:37` en **cada
  arranque del servidor**. Es el camino por el que se construyó producción, y su
  libro de migraciones quedó vacío.

Los dos divergen. Cuando divergen, la base construida por el segundo camino
arranca sin fallar y rompe en tiempo de ejecución, que es la peor forma de
enterarse.

Y el corredor, que debería ser la red de seguridad, no lo es: abre **una sola**
transacción para la corrida entera (`runMigrations.js:35`) y el `COMMIT;` de
`001_initial_migration.sql:47` se la lleva. Todo lo que corre después queda en
autoconfirmación, y el `ROLLBACK` de la línea 81 ya no revierte nada.

---

## 2. Lo medido, con su fecha

| medición | resultado | fecha |
|---|---|---|
| Copia local de producción: tablas, transacciones, filas del libro | 17 tablas, 785 transacciones, **libro vacío** | 2026-09-01 |
| Dónde se detiene la cadena sobre esa copia | en el segundo archivo: `002_accounts.sql` le cuelga un disparador sobre `users.timezone` a una tabla que ya existe sin esa columna | 2026-09-01 |
| Transacción del corredor tras un archivo que trae `COMMIT;` | `txid_current_if_assigned()` devuelve nulo; una tabla creada después sobrevive al `ROLLBACK` | 2026-09-02 |
| Archivo de varias sentencias sin control de transacción propio | **atómico**: Postgres lo envuelve en una transacción implícita; una falla en la segunda sentencia no deja la primera | 2026-09-02 |
| Sentencias de transacción por archivo | 001-007 traen `BEGIN;`/`COMMIT;` propios; 008-024 no traen ninguna (los `BEGIN` de 014-020 son bloques PL/pgSQL) | 2026-09-02 |
| Libro de `fintrack_dev` | 25 filas para 24 archivos; sobra `012_backfill_budget_policies.sql` (08-08) junto a la real `012_backfill_budget_allocations.sql` (08-14); nada en disco sin registrar | 2026-09-02 |
| `transactions.opening_for_account_id` en desarrollo | presente | 2026-09-02 |
| Qué es `fintrack_prod_data` | la copia de control anterior a la alineación, restaurada del volcado del 2026-08-21 23:04; producción tiene **seis** archivos pendientes, no veinticuatro | 2026-09-02 |

**El defecto real de atomicidad**, una vez corregida la lectura anterior: el
archivo se confirma en una transacción y su fila del libro se escribe en otra
(`runMigrations.js:71`). Un corte entre las dos deja el archivo aplicado sin fila
que lo nombre, y la corrida siguiente lo repite.

---

## 3. Decisiones ya tomadas

| decisión | razón |
|---|---|
| Una transacción por archivo, y la abre el corredor; a 001-007 se les quitan las suyas | el esquema del archivo y su fila del libro tienen que confirmarse juntos, que es el invariante que hoy se rompe |
| La columna que falta entra por `createTables.js`, sin migración nueva | ese archivo construye bases vacías; agregarle una columna no toca ninguna base con datos |
| La fila fantasma del libro se deja como está | corregirla es reescribir historia sobre una base que se reconstruye, y en producción no existe |
| La regla del reverso rige **desde la 025 en adelante** | un `DOWN` escrito hoy para una migración ya aplicada es un reverso que nadie va a ejecutar y que nadie puede probar; además obligaría a tocar archivos que el límite de alcance declara intocables |

**Lo que no se decide aquí:** si al terminar se aplica la cadena a producción.
Es una operación sobre datos vivos, va con su propio ensayo contra una copia
restaurada, y la autoriza el desarrollador en persona.

---

## 4. Los pasos, en orden

El orden importa: el paso 0 decide el tamaño de todo lo demás, y el paso 1 es un
defecto vivo que no depende de ningún otro.

### Paso 0 — Medir qué es `fintrack_prod_data`

**Por qué primero.** El encabezado de
`backend/src/db/migrations/supabase/001_production_alignment.sql` dice que su
paso 9 escribió diecisiete filas en el libro y que el archivo se aplicó el
2026-08-22. La medición del 2026-09-01 encontró el libro de `fintrack_prod_data`
vacío. Las dos cosas se concilian si esa base es una restauración del volcado del
2026-08-21 23:04 y no la base viva, pero **eso no está medido**. De cuál sea la
verdad depende si lo pendiente son seis migraciones o veinticuatro.

**Qué hay que establecer.** Si el volcado del que salió `fintrack_prod_data` es
anterior a la aplicación del archivo de alineación. Se responde con la fecha del
volcado y la fecha declarada de aplicación, sin conectarse a Supabase.

**Límite.** Nada se ejecuta contra Supabase. Ninguna sesión de agente abre una
conexión a otra base del servidor reusando las credenciales del pool.

**Salida.** Un párrafo fechado en este archivo diciendo cuál de las dos es, y
cuántas migraciones quedan pendientes en consecuencia.

**Respondido el 2026-09-02, con documentos y sin abrir ninguna conexión.**
`fintrack_prod_data` es la copia de control anterior a la alineación, no la base
viva. Tres líneas independientes lo dicen y ninguna necesita credenciales:

- **El procedimiento que la crea la define así.**
  `backend/src/db/docs/db-documented/db-migration-procedure.md:157-161` la
  construye desde `prod_full.sql` como el control del ensayo, y el encabezado del
  archivo de alineación fecha ese volcado el **2026-08-21 23:04** (`:55-56`), un
  día antes de que el archivo se aplicara a Supabase el **2026-08-22** (`:68-69`).
- **El libro vacío sólo es posible antes.** El paso 9 de la alineación escribe
  diecisiete filas; una copia tomada después no podría tener cero.
- **Los datos lo confirman por su cuenta.** El plan de bolsillos anotó la cuenta
  `108` viva en `fintrack_prod_data` el 2026-08-29, cuando producción la tenía
  borrada desde el 2026-08-24. La copia es anterior a esa fecha.

**Los dos documentos nunca se contradijeron**: uno describe la base viva y el otro
una copia anterior a ella. El libro vacío es una propiedad de la copia, no de
producción.

**Lo pendiente en producción son seis archivos, no veinticuatro: 019 a 024.**

Un primer conteo escrito aquí el mismo día dijo siete. Sumaba la
`013_normalize_category_budget_name_case.sql`, porque el paso 9 de la alineación
la deja fuera de las diecisiete filas que inserta —
`001_production_alignment.sql:586-588` lo explica — y de ahí que el archivo se
aplicara el 2026-08-22 no se sigue que la 013 haya corrido. **Sí corrió.** La
sección 1 de `plan-docs/on-hold/PLAN_DEPLOYMENT/PLAN_SUPABASE_MIGRATION.md` trae
una medición **contra la base viva**, con los dos sondeos de solo lectura de
`db_guides/`, fechada el 2026-08-27: 145 columnas, 19 tablas base y un libro de
**19 filas**, la misma cuenta que `fintrack_dev`. Diecinueve son los dieciocho
archivos de la cadena hasta la 018 más el propio archivo de alineación, y no
dejan lugar para que falte ninguno. Entre el 22 y el 27 de agosto alguien corrió
el corredor contra producción y aplicó lo que quedaba, 013 y 018.

**Lo que igual se confirma por su nombre, y cuesta una consulta.** La cuenta de
diecinueve es un argumento aritmético, no una lista. `SELECT filename FROM
migrations ORDER BY id` sobre producción la vuelve una lista, y el sondeo que ya
existe para eso es
`plan-docs/on-hold/PLAN_DEPLOYMENT/db_guides/probe_production_state.mjs`. Importa
sólo por un archivo: si la 013 no estuviera, es la única pendiente que **reescribe
datos existentes** — pasa a minúsculas los nombres de `category_budget` y las
partes de las que derivan — y correría antes que las seis de esta rama, con su
propio ensayo y huella de los nombres antes y después.

**Y ojo con qué documento se lee.** La sección 1-ter de ese mismo plan de Supabase
avisa que tres documentos describen el estado de producción de tres maneras, y que
la medición más nueva es la suya. Los otros dos —`NEXT_SESSION.md` §2.1 y
`db-migration-procedure.md` §1— siguen diciendo que la alineación nunca se
ejecutó.

**Y su encabezado cree en el invariante que no existe.** La línea 16 de esa misma
013 dice que el corredor envuelve cada archivo en una transacción junto con su
`INSERT INTO migrations`, y declara seguir la convención de la 010 a la 012. Eso
es justamente lo que el corredor no hace. El paso 2 no cambia una convención: la
construye por primera vez, y cuatro archivos ya escritos la dan por cierta.

---

### Paso 1 — La columna que el arranque no declara

**Defecto.** `022_add_transaction_opening_for_account.sql:65-66` agrega
`transactions.opening_for_account_id`. `createTables.js` no la declara en su DDL
de `transactions` (`:150-184`). `recordTransaction.js:88` y `:100` la insertan, y
`derivedBalance.js:154`, `:212` y `:237` la leen en los tres constructores de
saldo. Una base levantada por el camino de arranque falla en cada inserción de
transacción y en cada derivación de saldo.

**No es un problema de la cadena, es un problema del arranque.** Por eso va
primero y va solo: `initializeDatabase()` corre en cada arranque del servidor.

**Qué cambia.** La declaración de la columna en el DDL de `transactions` de
`createTables.js`, con la misma definición y la misma clave foránea que la 022.
Ninguna migración nueva.

**Verificación.** Una base levantada sólo por `createTables.js` acepta una
inserción de transacción y deriva un saldo. Arranque en el puerto **5078**.

**Commit.** `fix(db): boot DDL declares opening_for_account_id`.

---

### Paso 2 — Una transacción por archivo

**Defecto.** `runMigrations.js:35` abre una transacción para la corrida entera y
la confirma en `:77`. El `COMMIT;` de `001_initial_migration.sql:47` la cierra
antes de tiempo, y la fila del libro (`:71`) se escribe fuera de la transacción
del archivo que nombra.

**Qué cambia.**

- El corredor deja de abrir una transacción alrededor del bucle. Abre una **por
  archivo**, antes de leerlo, y la confirma después de escribir su fila del
  libro. Un fallo revierte el archivo y su fila juntos.
- La creación de la tabla `migrations` y la lectura del libro quedan fuera de esa
  transacción, en su propia unidad.
- A los siete archivos que traen `BEGIN;`/`COMMIT;` propios (001-007) se les
  quitan esas dos líneas. **Es la única excepción al límite de "no se toca ningún
  archivo ya aplicado"**, y está acotada a esas dos líneas: no se altera ninguna
  sentencia de esquema.

**Por qué no al revés.** Dejar que cada archivo maneje su transacción y que el
corredor no abra nada deja la fila del libro fuera, y reproduce el mismo defecto
en pequeño.

**Verificación.**

1. Contra una base descartable construida desde vacío, la cadena entera corre y
   el libro queda con veinticuatro filas y ninguna más.
2. Con una falla forzada en medio de un archivo, ni su DDL ni su fila del libro
   sobreviven, y una segunda corrida arranca desde ese archivo. **Esta prueba
   sola no demuestra nada**: hoy ya pasa para 008-024, porque el archivo es
   atómico por sí mismo.
3. **La prueba que sí lo demuestra:** cortar el proceso entre la aplicación del
   archivo y la escritura de su fila, y comprobar que el esquema del archivo
   tampoco sobrevivió. Es el único escenario que hoy falla.

**Commit.** `fix(db): one transaction per migration file`.

---

### Paso 3 — El código de salida

**Defecto.** El `catch` sale con código 1 (`runMigrations.js:83`) y el `finally`
sale con código 0 (`:86`). Hoy el código de salida es correcto por accidente:
`process.exit` no ejecuta el `finally`. El día que alguien saque ese `exit` del
`catch` para liberar el cliente como corresponde, toda falla se reporta como
éxito y el paso de despliegue la lee como buena.

**Por qué va aquí.** Quien haga el paso 2 se topa con esto en la misma función, y
el paso 2 hace exactamente lo que dispara la trampa: mover la liberación del
cliente.

**Qué cambia.** El código de salida se decide en una variable y se aplica una
sola vez, después de liberar el cliente. Nada de `process.exit` dentro del
`catch`.

**Verificación.** Una corrida con falla forzada devuelve código de salida 1. Una
corrida limpia devuelve 0.

**Commit.** puede ir dentro del paso 2 si el diff es el mismo bloque; si no,
`fix(db): migration runner exits on the real outcome`.

---

### Paso 4 — El reverso, de la 025 en adelante

**Qué cambia.** Una plantilla de migración con `-- UP` y `-- DOWN` explícitos, y
la regla escrita en el documento de reglas del proyecto acotada a los archivos
nuevos. Las veinticuatro ya aplicadas quedan sin reverso **por decisión
declarada**, no por olvido: eso se anota en el encabezado de la plantilla para
que el próximo lector no lo lea como una omisión.

**Lo que no incluye.** Un corredor de reversos. Escribir el `DOWN` y ejecutarlo
son dos trabajos; este plan sólo obliga a escribirlo.

**Commit.** `docs(db): migrations declare an explicit reverse`.

---

### Paso 5 — La paridad entre los dos caminos

**Por qué.** El paso 1 cierra **un** punto de divergencia entre `createTables.js`
y la cadena. El registro de observaciones tiene medida una divergencia de treinta
y siete puntos entre los dos. Sin una comprobación, el punto siguiente se
descubre igual que este: en producción, en tiempo de ejecución.

**Qué cambia.** Una comprobación que levanta dos bases descartables —una por la
cadena, otra por `createTables.js`— y compara tabla por tabla y columna por
columna, con una lista explícita de diferencias aceptadas y su razón. No corrige
nada: reporta.

**Verificación.** La comprobación corre y su salida es una lista vacía, o una
lista cuyas entradas están todas justificadas.

**Commit.** `test(db): schema parity between the two build paths`.

**Aplicado y medido el 2026-09-02.** `npm run db:parity` levanta una base por
cada camino, las compara columna por columna y reporta; no corrige nada y se
niega a correr contra una cadena de conexión que nombre producción. La lista de
diferencias aceptadas lleva la razón de cada una: el libro de la cadena, la
bandera del arranque, y la tabla de respaldo que la 013 deja a propósito.

**Primera corrida: seis diferencias, todas anteriores a este plan.**

| diferencia | cadena | arranque | estado |
|---|---|---|---|
| `pocket_saving_accounts.currency_id` | presente | **ausente** | **cerrada** el 2026-09-02 |
| `currencies.currency_name` | `VARCHAR(25)` | `VARCHAR(10)` | **cerrada** el 2026-09-02 |
| `transactions.status` | `TEXT` | `VARCHAR(50)` | **cerrada** el 2026-09-02 |
| `users.auth_method` | `VARCHAR(50)` | `VARCHAR(255)` | **cerrada** el 2026-09-02 |
| `category_nature_types.category_nature_type_id` | entero llano | `SERIAL` | **cerrada** el 2026-09-02 |
| `transaction_types.transaction_type_id` | entero llano | `SERIAL` | **cerrada** el 2026-09-02 |

**La primera se cerró el mismo día, por ser del mismo tipo que el paso 1.** La
columna viene de `002_accounts.sql:198-200`, no de la 020 — el `NOT NULL` de la
020 es de `pockets`, otra tabla — y es **anulable**, con `ON DELETE SET NULL`.
Al no ser obligatoria no hay nada que rellenar: entra a `createTables.js` con la
definición textual de la 002 y ninguna base con datos se toca. Producción ya la
tiene, porque la 002 está entre las diecisiete filas que sembró la alineación;
la falta sólo existía en bases levantadas desde vacío por el arranque. Y a
diferencia de `opening_for_account_id`, ningún archivo bajo `fintrack_api` ni
`utils` la lee, así que era divergencia latente y no una vía rota.

**Las otras cinco se cerraron el 2026-09-02, y el criterio es uno solo: manda la
cadena.** Es la historia versionada del esquema; el DDL de arranque la sigue, que
es la misma regla que ya gobierna este paquete. El temor de que elegir un lado
truncara filas existentes no aplica: `createTables.js` y `populateDB.js`
construyen con `CREATE TABLE IF NOT EXISTS` y **nunca alteran una tabla que ya
existe**, así que ninguna base con datos se toca al cambiarles la declaración.

- `users.auth_method` pasa a `VARCHAR(50)` y `transactions.status` a `TEXT`, como
  los declaran la 002 y la 003. `currencies.currency_name` pasa a `VARCHAR(25)`,
  como la 001.
- Las dos claves primarias pierden su `SERIAL` en el arranque. La 001 declara
  **cuatro** de los cinco catálogos como `INT PRIMARY KEY` a propósito: sus ids
  son fijos, los escribe la siembra y las consultas los leen como literales
  — `movement_type_id IN (1, 6)` es uno—. Una secuencia sobre ellos invita a
  insertar sin id y repartir uno que ninguna consulta conoce. `user_roles` es la
  única `SERIAL`, en los dos caminos. La realineación de secuencias de
  `populateDB.js` ya tolera un catálogo sin secuencia: su propio comentario dice
  que `pg_get_serial_sequence` devuelve nulo ahí.

**`npm run db:parity` reporta cero diferencias de columnas.** Hasta aquí la
comprobación solo leía `information_schema.columns`.

**Segunda corrida, 2026-09-02: la comprobación aprendió a leer restricciones y
aparecieron diez diferencias más.** `schemaParity.js` consulta ahora también
`pg_constraint` — clave primaria, unicidad y clave foránea con su acción de
borrado y de actualización — y compara cada regla por sus columnas y su tabla
referenciada, no por el nombre: el que Postgres genera no es comparable entre dos
bases construidas por caminos distintos.

| diferencia | cadena | arranque | cierre |
|---|---|---|---|
| FK `transactions.movement_type_id` | presente | **ausente** | `createTables.js`, `09a5e310` |
| FK `transactions.transaction_type_id` | presente | **ausente** | `createTables.js`, `09a5e310` |
| FK `transactions.currency_id` | presente | **ausente** | `createTables.js`, `09a5e310` |
| FK `debtor_accounts.selected_account_id` | presente | **ausente** | `createTables.js`, `09a5e310` |
| UNIQUE en el nombre de los cinco catálogos | presente | **ausente** | `populateDB.js`, `09a5e310` |
| `category_budget_accounts.currency_id` al borrar | `SET NULL` | `RESTRICT` | migración `026`, `18232221` |

**Las nueve primeras las tenía mal el arranque y se corrigieron ahí.** Una base
levantada desde vacío aceptaba una transacción que apunta a un tipo de movimiento
inexistente y dos filas de catálogo con el mismo nombre. Cambiar la declaración
no arriesga ninguna base con datos: `createTables.js` construye con
`CREATE TABLE IF NOT EXISTS` y los sembradores de `populateDB.js` crean su tabla
solo cuando falta, así que el cambio alcanza únicamente a bases nuevas.

**La décima la tenía mal la cadena, y es la excepción a la regla de que manda la
cadena.** La `002` declara `category_budget_accounts.currency_id` con
`ON DELETE SET NULL` y la `011` la vuelve `NOT NULL`. Las dos no pueden cumplirse:
borrar una moneda que un presupuesto referencia falla dentro de la acción de la
clave foránea, nombrando una restricción que quien borra nunca mencionó. El
arranque ya decía `RESTRICT` y tenía razón, así que la migración `026` lleva la
cadena hasta donde el arranque ya estaba, y no al revés.

**`npm run db:parity` reporta cero diferencias: mismas columnas y mismas
restricciones de clave primaria, unicidad y clave foránea en los dos caminos.**
La enumeración es la del párrafo anterior y el resumen tiene que repetirla: un
lector que llega aquí y lee «mismas restricciones» entiende todas, y la
comprobación no leía las de tipo `CHECK`.

**Corregido el 2026-09-06, medido en el árbol de trabajo de `main`.** Dos cosas
que este cierre daba por ciertas dejaron de serlo:

- Las filas sembradas sí se comparan. `SEEDED_CATALOGS` declara los catálogos y
  el mensaje de éxito dice «same columns, same constraints and same seeded rows
  on both paths». La frase de arriba sobre lo que «sigue sin mirar» quedó vieja
  cuando esa comparación entró.
- Las restricciones `CHECK` no se comparaban. `readConstraints` filtraba
  `contype IN ('f','u','p')` y nunca `'c'`, así que cualquier divergencia de
  `CHECK` entre los dos caminos era invisible para la herramienta hecha para
  verla. Había exactamente una, en `movement_types`, y es la que reconcilia
  `032_add_account_closure_movement_type.sql`. La consulta lee ahora también
  `'c'`, con `pg_get_constraintdef` como valor comparado.

**Y una advertencia sobre cómo se cita una corrida verde.** La herramienta
compara la cadena contra el arranque — los dos caminos entre sí, nunca contra un
esquema de referencia — y ambos salen del checkout donde se ejecuta. En
`feat/overview`, donde la cadena se detiene en 030 y el sembrador no trae el tipo
de cuenta `boundary`, la corrida reporta verde: los dos caminos coinciden y
ninguno está al día. Verde significa consistencia interna dentro de un checkout,
no que el checkout esté al día. Toda medición registrada aquí dice en qué árbol
se tomó.

---

### Paso 6 — Cómo recibe el libro una base construida por el DDL

**El problema que queda abierto después de todo lo anterior.** Si producción se
levantó por `createTables.js` con el libro vacío, correr la cadena desde 001
falla en el segundo archivo. Ya está medido. Arreglar el corredor no lo resuelve:
lo que falta es marcar como aplicadas las migraciones cuyo efecto el esquema ya
tiene, que es exactamente lo que hizo el archivo de alineación con sus diecisiete
filas.

**Qué cambia.** El procedimiento escrito: qué se mide sobre la base destino para
decidir qué filas se marcan, cómo se ensaya contra una copia restaurada, y qué se
verifica después. **Escrito, no ejecutado.**

**Lo que no cambia.** Nada se aplica a producción en este plan. Ejecutar el
procedimiento es la decisión aparte, y la autoriza el desarrollador.

**Commit.** `docs(db): the ledger seeding procedure for production`.

> **Closed 2026-09-06.** The procedure is section 7 of
> `backend/src/db/docs/db-documented/db-migration-procedure.md`. It is written and
> not executed, which is what this step asked for. Its schema half leans on the
> parity check step 5 produced; its data half deliberately does not, because a
> backfill leaves nothing in the schema to read and
> `012_backfill_budget_policies.sql` is the file that proves it.

---

## 5. Lo que este plan no toca

- Ningún `sql_migrations/*.sql` ya aplicado, salvo las dos líneas de transacción
  de 001-007 que el paso 2 nombra explícitamente.
- `backend/src/db/migrations/supabase/001_production_alignment.sql`, que ya se
  aplicó.
- `.env`, que comparten tres sesiones y que no debe apuntar nunca a
  `fintrack_prod_data` ni a Supabase.
- Producción. Nada se ejecuta contra Supabase en ningún paso.

## 6. Verificación transversal

El servidor arranca en el puerto **5078**. Nunca el 5000, que lo usa el
desarrollador.
