# PLAN_MIGRATION_CHAIN — dejar la cadena en condiciones de aplicarse

Estado: abierto. Escrito el 2026-09-02.
Rama de trabajo: `fix/auth-screen`.
Origen: sección F de `HANDOFF_AGENTES.md` y la sección 9.4.24 del plan de
retro-fechado, corregidas ambas el 2026-09-02.

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

| diferencia | cadena | arranque |
|---|---|---|
| `pocket_saving_accounts.currency_id` | presente | **ausente** |
| `currencies.currency_name` | `VARCHAR(25)` | `VARCHAR(10)` |
| `transactions.status` | `TEXT` | `VARCHAR(50)` |
| `users.auth_method` | `VARCHAR(255)` | `VARCHAR(50)` |
| `category_nature_types.category_nature_type_id` | entero llano | `SERIAL` |
| `transaction_types.transaction_type_id` | entero llano | `SERIAL` |

La primera es del mismo tipo que el paso 1 y es la más grave: la moneda contable
del bolsillo, que la 020 declara `NOT NULL`, no existe en una base levantada por
el arranque. Las tres de ancho son truncamientos silenciosos en un sentido y
espacio de más en el otro. Las dos últimas dejan la clave primaria de dos
catálogos sin secuencia por el camino de la cadena, así que un `INSERT` que
omita el id falla ahí y funciona en el otro.

**No se corrigen aquí.** Cada una obliga a elegir un lado, y elegirlo es una
decisión sobre datos: cuál ancho es el correcto, y qué pasa con las filas que ya
existen del lado que se achica. Es trabajo propio, no residuo de este plan.

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
