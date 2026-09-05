# OVERVIEW — registro de decisiones

**Lives in `plan-docs/ongoing/`, which `.gitignore:123` re-includes: this file is versioned.**

Rama de trabajo: `feat/overview`, creada 2026-08-20 desde `feat/budget` (`2540932`).

Este archivo es el registro vivo. Una decisión entra aquí cuando queda cerrada,
con la fecha y el motivo. Las abiertas se listan al final con su recomendación.

Fuentes: `PLAN_OVERVIEW.md` (especificación) y `PLAN_OVERVIEW_EVAL.md`
(evaluación, 2026-08-20).

---

## Estado

| bloque | estado |
|---|---|
| Fase 0 — rama y flag | en curso |
| Fase 1 — catálogo de KPI | **cerrada** — `PLAN_OVERVIEW_KPI_CATALOG.md` aprobado por el desarrollador el 2026-08-20 |
| Fase 2 — contrato | `PLAN_OVERVIEW_CONTRACT.md` borrador completo. `GET /overview` congelado salvo aprobación general del desarrollador (D16/D17 ya cerradas). `GET /overview/:domain` congelado — `trend` definido (D18), `categories` definido (D19) |
| Fase 2b — sonda de datos | bloqueada por fase 2 |
| Fase 3+ — código | **desbloqueada** por decisión del desarrollador (D13 revisada) |

### Overview se aborda al final — decisión del desarrollador, 2026-08-29

El módulo entero se retoma **cuando el resto de los módulos y sus indicadores
estén definidos**, no antes. La razón es que overview no produce dato propio:
consolida el de los demás, así que cerrarlo contra módulos todavía en
movimiento obliga a reescribirlo cada vez que uno de ellos cambia de forma.

**La rama `feat/overview` queda donde está, con ocho commits sin fundir** —
3201 líneas, 29 archivos, medido el 2026-08-29. **Aplazarla cuesta poco:**
veintisiete de esos archivos son nuevos y viven en su propio directorio
(`services/overview_services/`, más el controlador, las rutas y el validador del
módulo). Solo dos tocan terreno compartido, el montaje de rutas y el validador
de presupuesto, y el único archivo que también cambió en la rama de trabajo
desde el punto de divergencia es el montaje de rutas. El riesgo de deriva es
aditivo, no estructural.

**Pero la rama no se puede fundir tal como está, y este es el punto que no debe
perderse.** Su cálculo del dominio de bolsillo lee el modelo retirado: la lista
de cuentas de overview filtra por el tipo de cuenta `pocket_saving`, el
repositorio de la página se une a la tabla de extensión `pocket_saving_accounts`,
y el servicio del dominio define su indicador principal como el saldo mantenido
en esas cuentas. **Desde que la migración 020 corrió el 2026-08-29 no existe
ninguna de esas filas**, así que ese código ya no falla: devuelve cero y la
tarjeta declara en silencio que el usuario no ha ahorrado nada.

La especificación **ya está corregida** y no hay que rehacerla — el bolsillo como
asignación y no como custodia sustituye la lectura vieja en el catálogo de
indicadores, y la decisión que lo cerró es del 2026-08-24. Lo que quedó atrás es
el código de la rama, escrito contra el modelo anterior. Fundir sin reescribir
ese dominio contra `pockets` y `pocket_allocations` produce una tarjeta que
miente sin error.

> **Remedido 2026-08-30 — todo este bloque se confirma, y hay que sumarle dos
> cosas.**
>
> Las cifras de la rama son exactas: `feat/overview` tiene **8 commits sin
> fundir, 29 archivos, 3201 inserciones** sobre su punto de divergencia con
> `feat/budget` (`2540932`), y 24 de esos archivos viven bajo
> `services/overview_services/`. Los tres anclajes del dominio de bolsillo son
> reales y siguen ahí: la lista de cuentas filtra por `pocket_saving`
> (`overviewAccountRepository.js:62`, `:201-208`), el repositorio de la página
> une `pocket_saving_accounts` (`overviewPageRepository.js:50-58`), y el servicio
> del dominio define su indicador principal como el saldo mantenido en esas
> cuentas (`overviewPocketService.js:5`).
>
> **Primero: no es sólo el dominio de bolsillo.** La misma consulta de metas de
> ahorro (`SAVING_GOALS_QUERY`) alimenta `financialGoals` / G1-G3, que es una
> sección aparte del payload y cae por el mismo motivo. La tarjeta que miente sin
> error son dos.
>
> **Segundo: la mitad de frontend también se fue, y esta vez en la rama de
> trabajo.** El commit `b40c4b8` *fix(overview): remove every pocket read*
> (2026-08-30) borró `SavingGoals.tsx` y las tres peticiones de bolsillo de la
> pantalla actual. Así que la pantalla legacy ya dejó de leer el modelo retirado;
> la que sigue leyéndolo es sólo la rama sin fundir. El coste de aplazar no
> cambia — sigue siendo aditivo y no estructural — pero el trabajo de reescritura
> creció de un dominio a un dominio más una sección.

> ## ⛔ Superado 2026-09-04 — **la rama se fundió, y con el defecto dentro**
>
> **Todo el bloque de arriba razona sobre una rama pendiente, y no lo está.**
> `feat/overview` llegó a `main` el **2026-09-02** en el merge `d5693f1d`, y de
> ahí a la rama de trabajo actual `feat/vercel-serverless`. Su cabeza `1fb66b9`
> es ancestro de `HEAD` y `git log feat/overview ^HEAD` no devuelve nada:
> **cero commits sin fundir.** Las cifras de 8 commits, 29 archivos y 3201 líneas
> ya no describen un pendiente, describen lo que entró.
>
> **La frase que hay que releer al revés es la del bloque:** *"la rama no se
> puede fundir tal como está"*. Se fundió tal como estaba. Los tres anclajes del
> dominio de bolsillo siguen exactamente donde los dejó la medición del
> 2026-08-30, ahora en el árbol de trabajo:
>
> | qué lee el modelo retirado | dónde está hoy |
> |---|---|
> | el conjunto de cuentas reales del que sale el patrimonio | `overviewAccountRepository.js:62` |
> | el conjunto sobre el que se lee el saldo de bolsillo | `overviewAccountRepository.js:201-208` |
> | la consulta de metas de ahorro | `overviewPageRepository.js:56-58` |
>
> **Lo que impide que se vea es que nadie pregunta.** Ninguna de las dos rutas de
> Overview tiene un consumidor de frontend: la pantalla sigue armada contra los
> endpoints legacy del dashboard (`Overview.tsx:76-108` y las cinco lecturas de
> `OverviewLayout.tsx`), y ninguna palabra `fintrack/overview` de `frontend/src`
> es una URL de API — todas son rutas de navegación. Así que la tarjeta que
> *miente sin romperse* está servida y no la lee nadie.
>
> **La consecuencia práctica, y es la que ordena el trabajo:** la primera
> petición que haga el nivel 1 es lo que vuelve visible el defecto. Reescribir el
> dominio de bolsillo y la sección de metas contra `pockets` y
> `pocket_allocations` deja de ser una condición para fundir y pasa a ser una
> **condición para conectar la primera pantalla**. No es más trabajo del que ya
> estaba contado; es el mismo trabajo con otro disparador.
>
> **Y una decisión del bloque queda sin sujeto.** *"Overview se aborda al final"*
> sigue siendo la decisión del desarrollador y no se toca. Lo que ya no aplica es
> su premisa operativa: no hay una rama esperando, hay código en producción
> lógica esperando un consumidor.

---

## Decisiones cerradas

| # | decisión | fecha | motivo |
|---|---|---|---|
| **D13** | El refactor vive en `feat/overview`, creada desde **`feat/budget`** (`2540932`). El código **no espera** al merge de budget | 2026-08-20 | Decisión del desarrollador, que revisa en pantalla mientras se construye. La rama sale de `feat/budget` y no de `main` porque `budget_services` **no existe en `main`**: sin ella `overview_services` no tendría de dónde importar la capa KPI y tendría que duplicarla, violando §4.2. Riesgo aceptado y declarado: si `budget_services` cambia antes de su merge, `overview_services` hereda el cambio. Mitigación: todo el código nuevo va detrás del flag y en archivos nuevos |
| **D6** | Overview deja de consumir `url_get_total_account_balance_by_type` (`dashboardTotalBalanceAccountByType`) por completo. Toda cifra derivada de presupuesto la toma `overview_services` importando `budgetCalculationService` / el batch `POST /budget/accounts/status` — no una lectura nueva del endpoint legacy. Net worth se recalcula sumando las filas reales de cuenta (`bank` + `investment` + `pocket_saving` + `debtor`, `debtor.account_balance` ya viene con signo neto — préstamo la sube, deuda la baja — así que se **suma**, no se resta), nunca el `rows[0]` agregado del endpoint legacy | 2026-08-20 | Verificado con lectura de código, no sólo con el plan: el motivo vinculante **no es la fórmula de *remaining*** (Overview hoy ni siquiera lee ese campo — `OverviewLayout.tsx:52-54` pide `category_budget` y usa `total_balance`). Es que las cuatro cifras que sí lee vienen de `rows[0]` de un `GROUP BY currency_code` **sin `ORDER BY`** — ya registrado como **R202** (`Dashboard type aggregates return only the first currency group`), no es un hallazgo nuevo de esta sesión. Insalvable en el propio endpoint. Además la opción "reescribir el endpoint legacy" queda descartada porque ese endpoint resuelve *remaining* para dos tipos (`category_budget` vía presupuesto, `pocket_saving` vía meta) y `budgetCalculationService` sólo cubre el primero — delegar sería un error de categoría |
| **D7** | **Reformulada.** No existe conversión de moneda en lectura, ni para flujos ni para stocks: transacciones y saldos de cuenta ya se escriben en moneda contable en el momento de la transacción (`transactionController.js:340-375`). El campo "currency behaviour" del catálogo será `stored-in-accounting-currency` para toda métrica. La única conversión que sobrevive es de **presentación**: si el usuario pide ver el tablero en otra moneda, se convierte una vez sobre el agregado ya sumado — nunca fila por fila, y nunca usando el `exchange_rate` histórico por transacción | 2026-08-20 | La pregunta original (¿qué tasa por tipo de magnitud?) asumía que hacía falta convertir en lectura; no hace falta, ya está hecho en escritura. Usar el `exchange_rate` por fila en lectura sería activamente destructivo: la migración `009_backfill_fx_metadata.sql` rellenó las filas anteriores a la 007 con `exchange_rate = 1, source = 'identity'` — una tasa ficticia. No hay precedente de distinguir stock/flujo en el código: `budget_services` se niega a convertir y emite `MIXED_CURRENCY_NOTICE` en vez de inventar una tasa. **Confirmado por el desarrollador**: existe un campo `users.currency_id` ("Preferred Currency", `UpdateProfileForm.tsx:221`, opciones `usd/eur/cop`) que hoy coincide siempre con la moneda contable — no impulsa ninguna conversión todavía. Es la puerta que dejaría de estar cerrada si el usuario alguna vez pudiera fijar una moneda visual distinta de la contable; el día que eso ocurra, la conversión de presentación descrita arriba es exactamente lo que haría falta activar. No bloquea nada hoy: se deja anotado para cuando ese campo se conecte a algo |
| **D8** | `GET /overview` publica la procedencia de cada cifra en tres grados por sección: `live` (tasa obtenida en esta sesión), `cached` (tasa real histórica de la tabla `exchange_rates`, con `fetchedAt`), `synthetic` (fallback estático o proyección). `meta.notices` lleva `source` + `fetchedAt`; `null` + notice sólo si ninguno de los tres existe | 2026-08-20 | La caché de última tasa conocida ya existe (`exchange_rates`, `loadFXStateFromDB()`) — no hay que construirla. El escenario que planteaba la pregunta ("¿proveedor caído?") casi no ocurre: `fxProviderOrchestrator.js` termina en un fallback estático síncrono sin red que **nunca lanza**. El riesgo real es el opuesto — una tasa inventada (`cop 3500` fijo, VES con proyección exponencial) llega indistinguible de una tasa real reciente si sólo hay dos etiquetas (`live`/`stale`). Tres grados es lo mínimo para que el usuario pueda distinguir cuál está mirando |
| **D9** | La tarjeta de inversión v1 no publica porcentaje de retorno ni "valor de mercado" — ninguno es derivable hoy. Publica cinco cifras absolutas rotuladas por lo que son: **capital aportado** (apertura `movement_type_id=8` + transferencias `movement_type_id=6` cuyo origen/destino es la cuenta de inversión — **no** `movement_type_id=3`, muerto, ver **R211**), **saldo de ledger actual**, **P/L registrada** (suma de `movement_type_id=9` excluyendo las filas de anulación por borrado de cuenta, identificadas hoy sólo por el prefijo de descripción `RTA Annulment Target(`, ver **R212**), **concentración** (`MAX(balance)/SUM(balance)` entre cuentas de inversión) y **días sin aportar** (recencia del último aporte). Ganancia no realizada / valor de mercado queda `null` + notice de forma permanente hasta que exista un modelo de valuación. **No se presenta "ganancia absoluta" como cifra separada**: por identidad contable `saldo − aportado ≡ Σ pnl`, así que sería la misma cifra que P/L registrada disfrazada de una segunda medida independiente — se muestra la reconciliación (aportado + P/L = saldo), no dos tiles | 2026-08-20 | El bug de plumbing está confirmado (`account_starting_amount` se omite en el mapper de `InvestmentAccBalance.tsx`, `capital` siempre 0), pero arreglarlo no basta: `account_starting_amount` es saldo de apertura, no cost basis, y no existe tabla `investment_accounts` con unidades/precio. La fórmula actual no es "incorrecta con aportes a mitad de periodo" — no está acotada y sesga siempre al alza (con semilla 1.000 + aporte 9.000 = 10.000 reportaría +900%). Un retorno money-weighted o time-weighted correcto es **incomputable**, no sólo costoso: falta el insumo de valuación terminal, porque `account_balance` es la propia suma de los flujos que alimentarían el cálculo. Revisado como asesor financiero a pedido del desarrollador: de las cinco, sólo concentración y días-sin-aportar son genuinamente *advisory* — las otras tres son contabilidad, no consejo — y ambas son honestas porque no requieren precio de mercado |
| **D14** | El KPI antes llamado `domain_monthly_average` se cierra como **dos** KPI fijos, no uno: **`active_month_average_3m`** y **`active_month_average_12m`**. Denominador de ambos = **meses con actividad** dentro de su ventana, no meses transcurridos — se revierte la recomendación original de este mismo registro, que proponía dividir por meses transcurridos. Ventana: se evaluó también dar al usuario un selector de ventana a su elección; se descarta — pide una decisión estadística para leer una tarjeta de un vistazo, y abriría parámetro de API + control de UI + persistencia de preferencia que hoy nada más necesita. El KPI de variación (`variance_vs_average`) compara el mes en curso contra la cifra de 12 meses, no la de 3 | 2026-08-20 | El propósito del indicador, aclarado por el desarrollador, es "¿cuánto necesito disponible en un mes que sí tiene este tipo de movimiento?" — una cifra de reserva, no una tasa de flujo de caja suavizada. Diluir con meses en cero respondería una pregunta distinta y subestimaría lo que hace falta el mes en que el gasto sí ocurre. Benchmark de apps profesionales (`benchmarking_lookUp/monthly_average_kpi_benchmark.md`): ninguna app con metodología documentada excluye meses en cero del denominador — es una **elección de producto propia de FinTrack**, sin precedente externo, de ahí que el nombre cargue `active_month` en vez de `monthly_average`. La ventana dual sí tiene precedente real y verificado: Empower publica el mismo patrón, 3 meses reactivos y 12 meses estables, en vez de una ventana única o un selector. El bug que sí queda corregido sin ambigüedad, en ambas ventanas: la ventana fija enero-diciembre (`dashboardMonthlyTotalAmountByType.js:43-47`) se reemplaza por ventanas móviles — hoy el promedio de enero se reinicia al total de un solo mes cada año |
| **D15** | `Transfer` (`movement_type_id=6`) **no** cuenta en `transactionCountAll` de la tarjeta ALL | 2026-08-20 | Decisión menor, marcada "no bloquea" en el catálogo (§6) — se cierra al redactar el contrato en vez de dejarla abierta sin necesidad. D1 ya trata `Transfer` como sub-métrica de ALL sin peso de dominio propio porque no mueve patrimonio neto; contarlo en un conteo de "actividad" inflaría esa cifra con filas que la propia D1 declaró que no mueven nada. Coherencia con D1, no una fórmula nueva |
| **D16** | `ExpenseCard` incluye `budgetAmount`, `categorizedExpense`, `budgetVariance` y `hasUncategorizedExpense` (E4/E5, ampliados) | 2026-08-20 | Aprobado por el desarrollador tras pedir explicar `budgetVariance` — lo que llevó a verificar en código que **no es simétrico con `totalAmount`**: `budgetAmount`/`actualSpent` de `budgetCalculationService` sólo cuentan transacciones atadas a una cuenta `category_budget`, atadura opcional (`movementInputHandler.js:14`, `category_account_id ?? null`), mientras que `totalAmount` (E1) suma *todo* el gasto real. Comparar `budgetAmount` contra `totalAmount` habría mostrado "te pasaste del presupuesto" cuando el exceso era, en realidad, gasto nunca categorizado. Se cierra separando `categorizedExpense` de `totalAmount` y añadiendo `hasUncategorizedExpense`, en vez de aprobar el par de campos tal como los proponía el catálogo original |
| **D17** | `IncomeCard` **no** se desagrega por `income_source` (I4) | 2026-08-20 | Income ya llega al piso de 3-5 campos con I1-I3 (catálogo, §2). No existe una decisión de rama que absorba el riesgo de esta adición como D13 lo hace con E4/E5 — se abre cuando haya una razón de producto para pedirla |
| **D18** | `trend` de `GET /overview/:domain` se define como una serie mensual de la fórmula de **MS1** (`domain_monthly_actual`), aplicada mes a mes en vez de colapsada al mes en curso — un punto por mes calendario, **ventana de 6 meses**. Alcance: sólo `income` / `expense` / `pocket`, los mismos tres dominios que ya tienen MS1-MS3 — Investment (bespoke, D9), Debt y PnL no llevan sección de trend en este contrato, porque no existe una cifra mensual de flujo en el catálogo de la que partir. Meses sin actividad publican **0 real**, nunca `null`: a diferencia de MS2/MS3 (D14), que excluyen esos meses del denominador porque responden "¿cuánto necesito en un mes activo?", trend responde "¿cómo se movió esto en el tiempo?" y omitir un mes en cero falsearía la forma de la serie | 2026-08-20 | MS1-MS4 son las cuatro entradas del catálogo bajo *monthly snapshot* y las cuatro son escalares — ninguna es una serie, así que `trend` no podía ser MS2/MS3 reutilizados tal cual: ya vienen colapsados a un promedio. La única fórmula reutilizable es la de MS1, repetida mes a mes en vez de colapsada a un solo punto. Ventana de 6 meses: ni la de MS2 (3m, corta para leer una dirección visual) ni la de MS3 (12m, pensada para estabilidad estadística que una serie no necesita) — punto medio elegido por el desarrollador, sin benchmark externo citado (a diferencia de D14, que sí tuvo uno, Empower). Alcance a 3 dominios: mismo límite que el catálogo ya fija para MS1 (`PLAN_OVERVIEW_CONTRACT.md` §8) — Investment, Debt y PnL no tienen una cifra mensual de flujo definida en fase 1 de la que derivar una serie |
| **D19** | Nuevo grano `expense_category`: `GET /overview/:domain?domain=expense` gana un campo `categories: ExpenseCategoryStatus[]` — un array único, no dos (`distribution`/`pareto` separados) — que alimenta tanto el donut de distribución como el Pareto sobre el mismo dataset, sin riesgo de que ambos muestren cifras distintas para la misma categoría. Reusa `makeBudgetCategoryStatus`/`makeCategoryGroups` (`budgetCalculationService.js`) sin abrir su contrato (D6): los ocho campos base (`categoryName`, `currency`, `accountCount`, `budgetAmount`, `actualSpent`, `remainingBudget`, `executionPercentage`, `isOverBudget`) vienen tal cual. Se agregan tres campos nuevos, cálculo server-side (§4.1, no existen hoy en ningún archivo): `rank` (orden por `actualSpent` descendente — `makeCategoryGroups` ordena alfabéticamente hoy, no por gasto), `cumulativeActual` y `cumulativePercentage` (suma corrida para la línea del Pareto). Mes: mismo parámetro `month` ya congelado en `GetOverviewDomainParams` (§12) — no es un selector nuevo. Categoría con gasto y `budgetAmount=0` (nunca presupuestada): sin campo ni estado nuevo — se sirve tal cual la da `makeBudgetCategoryStatus` hoy (`budgetAmount: 0`, `executionPercentage: null`, `isOverBudget: true`); el tratamiento visual, si lo hay, es de fase 4. Categoría borrada (soft-delete) con gasto histórico: se **incluye** en los meses donde tuvo actividad real — la query del grano no hereda el filtro `deleted_at IS NULL` de `accountUtils.js:103-110` (pensado para "cuentas asignables a una transacción nueva", pregunta distinta a "qué gastó esta categoría este mes"), así que `Σ(categories[].actualSpent)` reconcilia exacto con `totalAmount` (E1). Requisito de implementación para fase 3: cuando `categorizedExpense` (D16) se implemente, su query debe seguir la misma regla — si sólo `categories` incluye categorías borradas y `categorizedExpense` no, la misma página muestra dos cifras que deberían coincidir y no coinciden | 2026-08-20 | Verificación de las diez preguntas del desarrollador contra código real, no contra el plan: período, frecuencia, categoría, presupuesto aplicable, actual y moneda ya estaban resueltos por `makeBudgetCategoryStatus`/`makeCategoryGroups`, sin cambios. Dos hallazgos nuevos de esta sesión. (1) `rank`/`cumulativeActual`/`cumulativePercentage` no existen en ningún lado — el Pareto exige una pasada de cálculo nueva (orden + suma corrida), trivial pero real, y por §4.1 vive en el servidor, no en React. (2) "Gasto sin categoría" es estructuralmente imposible al escribir la transacción (`transactionController.js:516-532`: `getAccountInfo` devuelve 404 si el destino no resuelve a una cuenta `category_budget` existente) — confirma la lectura original del desarrollador — pero **incompleta**: el borrado de cuenta es soft-delete (`deleteAccountService.js:362-372`, sólo marca `deleted_at`), así que las transacciones de una categoría borrada sobreviven mientras la cuenta desaparece de toda consulta que filtre `deleted_at IS NULL`. Sin corregir la query, el desglose por categoría perdería en silencio el gasto de cualquier categoría alguna vez borrada mientras `totalAmount`/E1 lo seguiría contando — la misma clase de inconsistencia entre dos vistas del mismo dato que D6 ya corrigió a nivel de dominio, y la razón original para elegir un array único en vez de dos. Se cierra incluyendo la categoría borrada, no documentando el gap, porque la alternativa reabre exactamente ese riesgo |

| **D20** | `ExpenseCard.totalAmount` (E1) **netea** `movement_type_id=6` (transferencia de reversión `category_budget`→banco) igual que `actualSpent` en `budgetTransactionRepository.js` (`SPENT_QUERY`, ya en producción). No se queda en el `movement_type_id=1` literal del catálogo original | 2026-08-20 | Sin netear, un gasto categorizado y luego revertido mostraría `actualSpent=0` pero `totalAmount` seguiría contando el gasto original — dos cifras que deberían reconciliar (`categorizedExpense` es un subconjunto de `totalAmount`, D16) y no lo harían, por un reembolso y no por un borrado. Mismo principio que D19 ya aplicó para categorías borradas (§4.2, "una cifra, una fórmula"), extendido al mismo `totalAmount` en el otro sentido. Aprobado por el desarrollador (Resp. A) |

| **D21** | `ExpenseCard.transactionCount` (E2) cuenta **las mismas filas de las que sale `totalAmount`**: `movement_type_id IN (1, 6)`, sin `FILTER` propio. El campo conserva el nombre `transactionCount` que §5 congeló para las cinco tarjetas genéricas, pero su significado pasa a ser "movimientos detrás de esta cifra", no "gastos registrados". **Requisito de frontend:** la etiqueta visible dice *movimientos*, nunca *gastos* — 3 de las 26 filas de agosto son reversiones y no son gastos que el usuario hizo. La regla se fija para los cinco dominios de la tarjeta genérica (I2/E2/D2/P2/PL2), no sólo para expense, porque los cuatro restantes todavía no están escritos y copiarían la forma | 2026-08-20 | El catálogo ya lo definía así y la implementación se desvió. I2 es "`COUNT(*)`, mismo filtro que I1" (`PLAN_OVERVIEW_KPI_CATALOG.md:132`) y E2 es "mismo patrón que I2" (`:151`): el conteo hereda el filtro del total, sea cual sea. D20 movió el filtro de E1 a `IN (1, 6)` y no mencionó E2, así que el código conservó el `movement_type_id = 1` literal del catálogo original en un `FILTER` que el catálogo nunca pidió. Resultado en la base local: la tarjeta de agosto publicaba `transactionCount: 23`, la lista debajo mostraba 26 filas, y `totalAmount` (267.88 = 393.20 de 23 filas tipo 1 menos 125.32 de 3 filas tipo 6) se derivaba de las 26. Tres cifras en la misma pantalla que el usuario reconcilia con la vista, y ninguna cuadraba con otra. §4.2 ("una cifra, una fórmula") se resuelve en la misma dirección que D19 (categorías borradas) y D20 (netear el reverso): las dos cifras salen del mismo conjunto de filas o no salen. El coste es la etiqueta, y se paga en el frontend —que todavía no existe— en vez de pagarlo en una discrepancia visible. Invariante que queda verificable de aquí en adelante: `card.transactionCount === transactions.totalRows` para el mes de referencia |

| **D22** | `IncomeCard.totalAmount` (I1) suma la pata que **entra** en la cuenta del usuario: `movement_type_id = 2` sobre el conjunto de cuentas reales (`bank`, `investment`, `debtor`, `pocket_saving`, `slack` excluida). El catálogo escribía `transaction_type_id = 1` rotulado "pata de la cuenta real", y ese filtro selecciona la pata de `income_source`. Corregido en el catálogo, entrada I1, y en el término de ingreso de H3 | 2026-08-20 | Es la **misma inversión que ya se corrigió en E1** el mismo día, que sobrevivió en I1 y H3 porque aquella corrección se anotó sólo sobre la entrada de gasto. Verificado contra `movementInputHandler.js:20-30` (`getIncomeConfig`: origen `income_source`/withdraw, destino `bank`/deposit) y contra datos locales: la pata real suma `+475.95` y la de `income_source` suma `−475.95`. No es cosmético — el filtro original habría publicado el ingreso del mes en negativo, y I3 habría heredado el signo invertido. La implementación **no filtra por `transaction_type_id`**: el conjunto de cuentas selecciona la pata, igual que ya hacía gasto, y es una condición menos que pueda desincronizarse del total (§4.2) |
| **D23** | El `trend` de `pocket` es una serie de **saldos a fin de mes**, no de flujo mensual. `trend[último].value === card.totalAmount` por construcción: la serie se reconstruye desde el saldo de hoy hacia atrás, así que el punto del mes de referencia no resta nada y **es** el saldo actual | 2026-08-20 | §12 exige `trend` presente para pocket y §8 dice que reusa la fórmula de MS1, pero P1 es un saldo, no un flujo — el catálogo no elegía entre las dos lecturas posibles. Se evaluaron ambas. Una serie de flujo pondría "entraron 80" bajo una tarjeta que dice "1.200 ahorrados": dos cifras en la misma tarjeta sin relación entre sí, que es exactamente la discrepancia que §4.2 prohíbe y que D19, D20 y D21 ya resolvieron tres veces en la misma dirección. La serie de saldos termina en la cifra de la tarjeta y responde lo que una tarjeta de ahorro pregunta: cómo creció el saldo. Coste sobre D18: el "0 real de mes vacío" pasa a ser "arrastra el saldo" — el espíritu de D18 (sin huecos, un mes plano se ve plano) se cumple entero; lo que no puede ser es 0, porque un mes en que el usuario no ahorró no le vació los bolsillos. Requiere reconstruir saldos pasados: **no hay tabla de histórico de saldos** en el esquema, verificado leyendo las migraciones, así que se deriva restando del saldo actual todo lo posterior al corte |
| **D24** | La `delta` de un dominio de stock (D3/P3) es **saldo al cierre del mes de referencia − saldo al cierre del mes anterior**. Se corrige la redacción del catálogo, que decía `D1(ahora) − D1(inicio del periodo anterior)` — un span de dos meses | 2026-08-20 | §5 declara `delta` una sola vez para las cinco tarjetas genéricas. Con la redacción original el campo habría significado "cambio en un periodo" en income, expense y pnl, y "cambio en dos periodos" en debt y pocket — el campo cambiando de sentido según el dominio es justo lo que un `DomainCardBase` compartido existe para impedir. La semántica que queda fija para las cinco: **`totalAmount` = estado al cierre del periodo, `delta` = cambio respecto al cierre anterior**. Para un flujo, "estado al cierre" es el total del periodo; para un stock, el saldo a esa fecha. Confirmado por el desarrollador. **Confirmado además por un plan independiente:** `PLAN_POCKET_ALERT.md` §9.2 llega a la misma cifra desde el diseño de la tarjeta de pocket — descarta el cambio neto acumulado por ser derivable de las otras cifras, y se queda con la cifra **acotada al periodo** (*saved this month*) porque rompe la identidad `saved = contributions − withdrawals` y por eso se gana su lugar. `PocketCard.delta` bajo D24 **es** esa cifra: cierre del mes menos cierre del mes anterior es exactamente lo ahorrado neto en el mes |

| **D29** | El alcance de la tarjeta `pocket` de Overview **no cambia** con `PLAN_POCKET_ALERT.md`: sigue siendo `totalAmount` + `transactionCount` + `delta` (+ `trend`), sin `target`, sin `desired_date`, sin porcentaje de progreso y sin bandera de estado | 2026-08-20 | Revisado a pedido del desarrollador. Los dos documentos describen dos vistas distintas del mismo tipo de cuenta, y el catálogo ya lo decía en su nota de alcance: la meta por pocket es el widget **Financial goals** (§9), no la tarjeta de dominio. `PLAN_POCKET_ALERT` gobierna la tarjeta y el hero **del módulo Pocket** — una vista por pocket, con barra, requerido/mes y cuadro de estado — y su bloque B1 propone `services/pocket_services/` para servirla. Overview agrega, no detalla: `PocketCard` responde "¿cuánto tengo ahorrado en total y cómo se mueve?", no "¿voy a llegar a esta meta?". Consecuencia registrada, no programada: cuando `pocket_services` exista, `financialGoals` (G1-G3) debe leer de ahí y no de la consulta del dashboard, para no volverse la cuarta copia de la misma cifra (§8.2 de ese plan ya registra que hoy son tres consultas solapadas) |

| **D32** | `GET /overview` publica los **datasets de gráfico** que ya calcula: `charts.trend` para income, expense y pocket, y `charts.expenseCategories` para el Pareto de D19. Vienen de las calculadoras **tal cual**, sin fórmula nueva, igual que las tarjetas | 2026-08-21 | El servicio de página ya invoca las seis calculadoras y **descarta** `trend` y `categories` antes de responder: el trabajo se paga y se tira. La alternativa era que el Overview llamara además a `GET /overview/expense` sólo para dibujar dos gráficos, lo que arrastra la paginación de filas de un endpoint de detalle a una pantalla que por contrato no carga filas — y obliga a dos peticiones donde una alcanza. Publicar el dataset no toca §11.1: la página sigue sin calcular ninguna cifra de dominio, sólo deja de descartar lo que la calculadora que la posee ya produjo. No contradice la prohibición de filas de transacción, porque un punto de serie y una fila de categoría son agregados. El coste es tamaño de payload: 6 puntos × 3 dominios + una fila por categoría de presupuesto, verificado local en 5 categorías. Confirmado por el desarrollador |
| **D33** | `GET /overview` gana un dataset más: `charts.expenseYtdDistribution` — el gasto **acumulado del año en curso agrupado por categoría**, ventana 1 de enero → cierre del mes de referencia. Eje **categoría, no cuenta**: el nivel 1 agrupa por categoría y el grano por cuenta de gasto se difiere al drill-down de la página de dominio de expense, donde hay sitio para desplegarlo. Filas: `categoryName`, `actualSpentYtd`, `share` (0-1) y `rank` por `actualSpentYtd` descendente. `share` se publica —no se deriva en el navegador— porque el donut imprime el porcentaje como cifra y §4.1 pone toda cifra financiera en el servidor; el arco en sí es geometría y eso sí lo dibuja el frontend. Hereda la regla de categoría borrada de **D19**: se incluye en los meses con actividad real, así que `Σ(share) = 1` y el desglose reconcilia con el gasto del año. **No** reusa `makeCategoryBreakdown`: esa función acumula sobre `actualSpent` del mes y el acumulado de Pareto es una suma corrida, no una participación por fila | 2026-08-21 | Propuesto en la evaluación externa del 2026-08-21 y es la **única** pieza de ese documento que no existía ya: todo lo demás que proponía (hero de tres cifras, tarjeta ALL, `GET /overview/:domain`, datos semánticos del Pareto, backend calcula y frontend representa) estaba construido y pusheado. Se acepta porque responde una pregunta distinta de la del Pareto y no una versión más de la misma: el Pareto dice *qué categorías dominan **este mes** y cómo van contra su presupuesto*, la distribución dice *dónde se fue el dinero **en el año***. Misma ventana habría sido D19 dibujado en otra forma. Eje decidido por el desarrollador: por categoría el donut comparte leyenda e identificador visual con el Pareto —la conexión Pareto ↔ distribución ↔ budget sale gratis— mientras que por cuenta la rompe, porque una categoría agrupa varias cuentas (`ExpenseCategoryStatus.accountCount`). Coste: una consulta nueva de doce meses; no hay tabla de agregados mensuales, así que se suma sobre transacciones con el mismo filtro neteado de **D20** (`movement_type_id IN (1, 6)`), o el acumulado del año contaría reversiones como gasto |
| **D34** | El nombre `ExpenseAnalytics` se adopta **sólo como componente de frontend** —la sección del nivel 1 que agrupa el Pareto mensual y la distribución YTD—. La llave del payload sigue siendo `charts`, y los campos siguen siendo `actualSpent`, `budgetAmount`, `categoryName`, `cumulativeActual`, `cumulativePercentage`. Ningún rename de contrato | 2026-08-21 | El argumento de la evaluación externa es correcto —un gráfico es una representación, no el modelo de dominio— pero apunta a la capa equivocada. `charts` ya está commiteado y pusheado en `GET /overview` (D32), y la regla del módulo es que el contrato se enmienda **antes** de los commits, nunca después. Un rename no cambia ninguna cifra, ninguna nullabilidad y ningún consumidor: paga el coste de romper el contrato para comprar una etiqueta. Donde el nombre sí gana algo es en el árbol de componentes, que todavía no existe y no le debe nada a nadie. Se registra además que su boceto proponía `categoryCode` y un `share` por fila del Pareto: `categoryCode` no existe en el esquema y el `share` por fila del **Pareto** sigue sin publicarse —§8 sólo pide el acumulado— mientras que el de la **distribución YTD** sí, por D33 |
| **D31** | `transactionCountAll` (§7) es la **suma de los cinco conteos de dominio**, no un `COUNT(*)` sobre `transactions` | 2026-08-20 | Un `COUNT(*)` sobre las cuentas del usuario **duplica todo movimiento de dos patas**: un gasto escribe un retiro en el banco y un depósito en la categoría, y las dos filas están en cuentas no-slack que el usuario posee. Cada dominio ya evita eso acotando su conteo a las cuentas de un solo lado, así que sumar los cinco hereda la corrección en vez de reinventarla — y es §7 al pie de la letra, que prohíbe a ALL recalcular. Cumple D15 sin cláusula: no hay dominio Transfer que aporte conteo, así que las transferencias quedan fuera porque no hay consulta que las incluya. Investment tampoco aporta: §6 no le da conteo a su tarjeta, y sus movimientos son transferencias, que D15 excluye igual. Verificado local: `34 = 2 + 26 + 2 + 2 + 2` |
| **D30** | `financialGoals` (G1-G3) suma **sólo targets reales**: un `target` en `0.00` no entra en `goalsTotalTarget` ni en `goalsTotalRemaining` | 2026-08-20 | R59 (`accountCreationController.js:985-988`) convierte un target ausente en `0.00`, y una fila así es indistinguible de un cero deliberado. Sumarla no cambia `goalsTotalTarget` — sumar cero no mueve un total — pero sí cambia el **denominador de cualquier lectura de progreso** y hace que un pocket sin meta cuente como meta alcanzada, que es el defecto que R59 describe. La regla se escribe ahora porque la base local **no tiene ninguna fila dañada** (verificado: 3 pockets, 3 targets reales, 0 nulos, 0 ceros), así que sin dejarla anotada el día que aparezca una nadie sabría que la decisión ya se había tomado. `goalsTotalTarget` es `null` —nunca `0`— cuando ningún pocket tiene meta real, que es lo que §9 del contrato ya exige |
| **D35** | La mezcla temporal del hero se registra como **defecto abierto**, no se parchea en la vista. `netWorth` suma banco e inversión, que son *a hoy*, con deuda y pocket, que son cierres del mes; `cashPosition` hace lo mismo con banco y pocket. Sólo `netMonthlyFlow` es puramente del mes elegido | 2026-08-21 | Con el mes en curso las dos lecturas coinciden y el defecto es invisible; **al seleccionar un mes pasado las dos cifras quedan híbridas**. Se registra ahora porque el selector de mes del nivel 1 es precisamente lo que lo va a exponer. Dos salidas posibles, ninguna elegida todavía: que el hero declare *a hoy* en pantalla, o que `getBankBalance` acepte la ventana y devuelva el cierre del mes — lo segundo es correcto pero toca backend y contrato. Lo que **no** se hace es corregirlo en el componente: sería una segunda vía de cálculo, que es R202 |
| **D36** | La etiqueta del promedio es **`Promedio mensual · 3M`** / **`· 12M`**, con el conteo real debajo: *sobre N de 3 meses con movimiento*. **Adoptada por recomendación, pendiente de confirmación explícita del desarrollador** | 2026-08-21 | El divisor son los meses **activos**, no los del calendario: si en dos de los tres no hubo movimiento, el promedio es de uno. `3M Avg` a secas afirmaría algo que la cifra no cumple. La objeción del desarrollador es correcta —`activo` no se entiende solo— pero la salida es explicar el divisor en una línea, no borrarlo del nombre y dejar la cifra sin la advertencia que el campo lleva a propósito |
| **D37** | ~~El nivel 1 son los seis dominios servidos; no hay Bank ni Savings~~ — **REVOCADA por el desarrollador el 2026-08-21.** Bank y Savings se agregan al nivel 1. Ver **D41** | 2026-08-21 | La decisión era una recomendación mía, nunca confirmada, y el desarrollador la revirtió. El riesgo de R202 que la motivaba **no desaparece pero sí se neutraliza**: una card de Bank publica el mismo `bankBalance` que el hero ya compone, no una segunda consulta, igual que D27 hace con las cifras del hero |
| **D41** | **Bank** entra como card del nivel 1 reusando el `bankBalance` ya cargado, **no una consulta nueva**. **Savings NO es un tipo de cuenta**: el esquema tiene `bank`, `category_budget`, `debtor`, `investment` y `pocket_saving`, y `pocket_saving` **es** la cuenta de ahorro. Queda por decidir qué card es Savings | 2026-08-21 | Medido, no supuesto: `SAVING_GOALS_QUERY` une `pocket_saving_accounts` filtrando `account_type_name = 'pocket_saving'`, las mismas filas que alimentan la card de Pocket. Una card de Savings separada de Pocket sería la misma cuenta contada dos veces salvo que sea una **lectura distinta de las mismas filas** — saldo disponible en una, avance hacia la meta en la otra. Bank sí es un tipo real sin card, así que su caso es directo |
| **D38** | **Ninguna card del nivel 1 lleva barra, progreso ni mini gráfico.** Los charts se quedan **en el nivel 1**, como sección propia fuera de las cards. El hero de dominio del **nivel 2** sí puede llevar progreso, comparación y mini tendencia. **Confirmada por el desarrollador el 2026-08-21** | 2026-08-21 | Card es estado; chart es comportamiento. Una barra dentro de la card la convierte en un mini dashboard, que es lo que el nivel 1 no debe ser — su trabajo es *reconocer*, no *entender*. Sacar los charts del nivel entero era la otra lectura posible y se descartó: contradiría D32, ya commiteado y pusheado, y dejaría `charts.trend` y `charts.expenseCategories` sirviéndose sin consumidor hasta la fase 5. La barra de ejecución de budget sí tiene sentido, pero en el hero de la página de Expense |
| **D39** | La card de debt publica **las dos piernas por separado** — `receivable` y `payable` — y no sólo el neto con signo | 2026-08-21 | Un neto de −$550 no distingue entre *debes 550* y *te deben 1,750 y debes 2,300*, que son situaciones opuestas. El `SUM` de `dashboardController.js:216` **no se puede copiar**: lee `ua.account_balance`, o sea a hoy, mientras que la card publica el cierre del mes, que `getMonthlyBalance` reconstruye **agregando todas las cuentas antes de restar** (`overviewBalanceRepository.js:41-56`) y por eso no admite corte por signo. Las piernas al cierre exigen reconstruir **por cuenta** y recién ahí agrupar por signo — una consulta nueva, no un `CASE` copiado. La estimación de *coste bajo* que acompañó a esta decisión era falsa y queda corregida aquí. **Corrección del 2026-08-21, señalada por el desarrollador:** una versión anterior de esta decisión nombraba las piernas `you owe` / `you're owed`. Es falso y la medición lo desmiente: `DebtsLayout.tsx:66` es un ternario sobre el signo de `total_debt_balance` que elige un **rótulo** para una sola cifra — un flag, no un par de campos. Las dos magnitudes ya existen en esa misma pantalla y ya tienen nombre: `debt_receivable` y `debt_payable` (`:44`, `:48`), rotuladas `receivable` y `payable`. Se tomó la etiqueta del neto y se le puso a las piernas. El contrato usa los nombres de la pantalla; el rótulo lo sigue derivando la vista del signo de `totalAmount`, y el backend no publica rótulos. Cerrado por el desarrollador el 2026-08-21: las piernas viajan como **magnitudes positivas** con la identidad `totalAmount = receivable - payable` como comprobación, `totalAmount` **no se recalcula en el cliente**, y el neto **no se pinta** como tercera cifra en la card del nivel 1 — sigue en el contrato porque lo consumen el hero, ALL y el nivel 2 |
| **D42** | **"Al cierre del mes" queda definido normativamente** en §5.1 del contrato: saldo actual menos toda transacción cuya `transaction_actual_date` sea igual o posterior al inicio del mes siguiente **en la zona IANA del titular**. Descarta explícitamente el último `transaction_actual_date`, `account_balance_after_tr`, el cierre en UTC y `ua.account_balance` a secas | 2026-08-21 | Exigido por el desarrollador al aprobar la Puerta 1. Decir "mensual" no basta: cuatro lecturas distintas son todas defendibles y producen cifras distintas. La zona horaria no es un detalle — una transacción del 31 a las 21:00 en America/Bogota pertenece al mes que cierra y en UTC ya es del siguiente. El mes de referencia es el caso límite y es intencional: su cierre puede estar en el futuro, no resta nada, y por eso el saldo de cierre **es** el saldo actual, que es la razón por la que la consulta se escribe desde hoy hacia atrás |
| **D43** | **`settledCount` queda definido normativamente** en §5.2: cuentas del **mismo conjunto que `totalAmount`** con saldo de cierre exactamente 0 **y** al menos una transacción anterior a ese cierre. Va al read model; **no se pinta en la card del nivel 1** | 2026-08-21 | Exigido por el desarrollador al aprobar la Puerta 1, y la ambigüedad era real. El conjunto es el de `getDebtAccountIds`: tipo `debtor`, `slack` fuera, **borradas lógicamente adentro** — contar sobre otro conjunto pondría dos universos en la misma card. La condición de movimiento previo existe porque una cuenta de deudor recién creada tiene saldo 0 y **no es un deudor saldado**; sin ella, crear cuentas infla la cifra. Una cuenta cerrada **sí** cuenta: R212 escribe la fila de anulación, así que llegó a 0 habiendo tenido movimiento. Y **no coincide con `debtors_without_debt` legacy** ni hoy: aquella lee a hoy y además hace `JOIN debtor_accounts`, que descarta toda cuenta de tipo `debtor` sin fila de detalle |
| **D40** | **YTD es Acumulación y lo sirve el backend.** No entra en el nivel 1 hasta que el payload lo publique, y **nunca se calcula sumando meses en el cliente**. Se descubre en el nivel 2 | 2026-08-21 | El YTD contesta *cuánto llevo acumulado este año*, que es una cuarta naturaleza junto a Posición, Flujo y Tendencia — no una variante del mes. Sumarlo en pantalla es exactamente R202: un consolidado calculado por una segunda vía que puede discrepar del detalle que tiene al lado, y ya existe un precedente vivo de eso en `feat/accountingDashboard`. Poner MTD, YTD y promedio en las seis cards a la vez convertiría el nivel 1 en un dashboard corporativo y rompería su regla: un KPI principal más contexto mínimo |
| **D25** | La lista `transactions` de `investment` incluye **todo movimiento** que tocó una cuenta de inversión en el mes, sin filtro de `movement_type_id` | 2026-08-20 | Los KPI de un dominio y la actividad de sus cuentas no son el mismo conjunto, y no tienen por qué serlo. Una transferencia entre dos cuentas de inversión puede no mover ninguna cifra de la tarjeta y sigue siendo actividad que pertenece al historial de esas cuentas: ocultarla haría que la misma cuenta mostrara dos historiales distintos en dos pantallas. D21 no aplica aquí porque §6 no le da `transactionCount` a la tarjeta de inversión — no hay conteo con el que la lista pueda estar en desacuerdo. Regla general que queda fijada: **`transactions` representa actividad del dominio, no el subconjunto exacto que alimenta cada KPI**. Confirmado por el desarrollador |
| **D27** | El `hero` de §11 **se compone de las tarjetas de dominio**, no de fórmulas propias. `netWorth` (H1) = saldo de banco/efectivo + `investment.ledgerBalance` + `debt.totalAmount` + `pocket.totalAmount`; `cashPosition` (H2) = banco + `pocket.totalAmount`; `netMonthlyFlow` (H3) = `income.totalAmount − expense.totalAmount`. La **única lectura nueva** es el saldo de banco, el único stock que ninguna tarjeta de dominio publica | 2026-08-20 | El catálogo da a H1-H3 fórmulas propias, y ejecutarlas literalmente pondría el patrimonio del hero y las cifras de las tarjetas en dos caminos distintos sobre la misma pantalla — el usuario suma cuatro tarjetas, no le da el hero, y no hay forma de saber cuál miente. §4.2 aplicado al nivel que le corresponde: ALL ya tenía prohibido recalcular (§7 del contrato) y el hero estaba fuera de esa prohibición sin motivo. Beneficio adicional: H3 compuesto hereda la corrección de D22 en vez de repetir la inversión de pata que el catálogo tenía escrita en sus dos términos |
| **D28** | En el `monthlySnapshot` de §8, `domainMonthlyActual` (MS1) de **pocket** es el **neto ahorrado del mes** — el mismo número que `PocketCard.delta` — no el saldo total | 2026-08-20 | Con MS1 = saldo, MS4 (`MS1 − MS3`) restaría un promedio de flujo a un stock: una cifra sin significado en la única tarjeta donde el catálogo la define para los tres dominios por igual. Las cuatro entradas del snapshot responden "¿cuánto muevo en un mes típico y este mes es inusual?", y esa pregunta sólo se contesta si las cuatro son de la misma naturaleza. Confirmado por un segundo camino: `PLAN_POCKET_ALERT.md` §9.2 llega a la misma cifra desde el diseño de la tarjeta de pocket — *saved this month* no es derivable de `saved` y `withdrawals`, así que se gana su lugar, mientras que el acumulado no. El neto del mes y `PocketCard.delta` son el mismo número por construcción (cierre del mes menos cierre del anterior = lo aportado neto en el mes), así que sigue siendo una cifra y una fórmula |
| **D26** | V5 (`days_since_last_contribution`) lee **sólo `movement_type_id = 6`** con `amount > 0`, no `IN (6, 8)`. V1 (`capital_contributed`) sí incluye 8 | 2026-08-20 | La entrada V5 del catálogo se contradecía consigo misma: la fórmula incluía el tipo 8 (apertura) y la regla de null decía "sin aportes **más allá de la apertura**, `null` + notice". Con el tipo 8 dentro, esa regla era inalcanzable — siempre habría respondido con la fecha de apertura. V5 es una señal de constancia, y abrir una cuenta una vez no es un hábito. V1 es distinto y sí incluye la apertura: el dinero puesto al crear la cuenta es capital que el usuario aportó. Verificado en datos locales: la identidad contable de §6 se cumple exacta, `−0.16 + 2.30 = 2.14` |
| **D45** | **Una cuenta de efectivo es una cuenta bancaria.** A todos los efectos de lectura, `account_type_id = 7` (`cash`) se lee como `bank`: entra en el patrimonio neto (H1), en la posición de efectivo (H2), en el conjunto de cuentas reales del que ingreso y gasto toman su pata, y en el conjunto elegible de PA1/PA2. **Toda fórmula que nombre `bank` incluye `cash`; ninguna las distingue.** No se propone ninguna migración que funda los dos tipos del catálogo: la distinción se conserva en el esquema, donde describe de dónde salió el dinero, y desaparece en la lectura, donde no cambia ninguna respuesta | 2026-09-01 | **Decisión del desarrollador.** Cierra la única pregunta que la sonda de fase 2b tenía sobre este tipo, y la cierra por el lado correcto: la pregunta era si el tipo tenía datos reales, y la respuesta la da el modelo, no el conteo — haya una cuenta de efectivo o ninguna, se lee como banco, así que la cifra deja de depender de una medición pendiente. El código ya lo asumía en el único sitio que clasifica los dos tipos juntos: `ELIGIBLE_SOURCE_TYPES = ['bank', 'cash']` en `pocketAllocationService.js:45` y `accountAllocationService.js:23`, que es exactamente el conjunto que PA1 y PA2 declaran elegible. La decisión alinea el catálogo con eso en vez de dejar dos clasificaciones vivas. **Consecuencia pendiente en código, no resuelta por esta decisión:** el conjunto de cuentas reales de `overviewAccountRepository.js:62` (rama `feat/overview`) enumera `('bank', 'investment', 'debtor', 'pocket_saving')` sin `cash`, y `dashboardTotalBalanceAccountByType` filtra por nombre exacto de tipo — hoy una cuenta de efectivo no aparece en la cifra de banco de ninguno de los dos |
| **D46** | **Overview owns its month selector. The month is NOT delegated to the domain screens.** The reference month is chosen on the Overview page itself, travels as `?month=YYYY-MM` in the URL, is absent for the current month, and is refused with 422 when it is later than the current month — the same convention the pocket board and the budget board already implement, through the same shared `MonthPicker`. The domain screens keep their own selectors; the two are independent and neither reads the other. **The selector does not ship until every hero input reports on the same time base** — see the cost column | 2026-09-03 | **Asked by the developer: should Overview show results for a selected month, or delegate that to each domain?** Three measurements decide it. First, the backend already implements it end to end: `overviewController.js:98-112` resolves the window or answers 422, `overviewValidators.js:65` accepts a past month only, and all six calculators receive that window — delegating would mean withdrawing a parameter that already works. Second, the page exists to answer one window across six domains; delegating forces the reader to open six screens to reconstruct what one screen was built to show, and the six answers would each carry their own month. Third, the control costs nothing new: five screens already carry the shared `MonthPicker` with the month in the URL. **The cost, stated and not hidden: two of the six hero inputs ignore the month today.** The bank balance is read by `getBankBalance(pool, userId)` (`overviewPageRepository.js:101`), which takes no month argument, and the investment card declares itself as of now through `AS_OF_NOW_NOTICE` (`overviewInvestmentService.js:27`). Debt, pocket, income and expense do respect the window. So `netWorth` for a past month adds two current balances to two closing ones and corresponds to no instant, and `cashPosition` does the same with one of each. Exposing a selector over that publishes a figure whose label is a lie. **Both must be reconstructed at the month close first**, with the technique `stockDomainCalculator` already uses for debt and pocket. The investment notice keeps excusing the investment CARD, whose own figures stand alone, but it stops excusing the hero: a sum cannot carry two time bases, and a notice on an addition does not repair the addition |

### Anclajes de la tabla de arriba, remedidos 2026-08-30

Sólo se corrige **dónde** está el código que cada decisión cita. **Ninguna
decisión, ningún motivo y ninguna conclusión se tocaron**, y el fondo de las
doce entradas revisadas se sostiene entero.

| decisión | anclaje que citaba | dónde está hoy |
|---|---|---|
| **D6** | `OverviewLayout.tsx:52-54` pide `category_budget` y usa `total_balance` | la petición está en `:51-52` y `total_balance` se lee en `:118`. R202 sigue en pie: los `GROUP BY ct.currency_code` de `dashboardController.js` (`:185`, `:201`, `:217`, `:236`) siguen sin `ORDER BY` y el controlador sigue tomando `rows[0]` (`:256`, `:278`) |
| **D7** | `transactionController.js:340-375` escribe en moneda contable | la conversión está en `:382-410`, con la llamada a `currencyAmountConversion` en `:400-405`. **Y ahora acepta un día pasado**: `asOfDay` se calcula en `:382-383` y viaja como cuarto argumento, así que la conversión histórica que D7 descartaba para *lectura* existe hoy para *escritura* — sin contradecir la decisión, que habla de lectura |
| **D7** | `UpdateProfileForm.tsx:221`, "Preferred Currency" | `:256` y `:273` |
| **D14** | ventana fija enero-diciembre en `dashboardMonthlyTotalAmountByType.js:43-47` | `:102-105`; el controlador se reescribió y va de `:61` a `:230` |
| **D16 / D19 / D20** | `movementInputHandler.js:14`, `budgetTransactionRepository.js` `SPENT_QUERY` | los dos exactos: `:14` (`category_account_id ?? null`) y el filtro `movement_type_id IN (1, 6)` en `:35`; `SPENT_QUERY` en `:187` |
| **D19** | `transactionController.js:516-532`: `getAccountInfo` devuelve 404 si el destino no resuelve | `:551-566` (origen) y `:568-584` (destino); `getAccountInfo` se define en `:94-119`. El razonamiento no cambia |
| **D19** | borrado lógico en `deleteAccountService.js:362-372` | `:388-398` |
| **D19** | filtro `deleted_at IS NULL` de `accountUtils.js:103-110` | la consulta va de `:96` a `:109` y el filtro está en `:107` |
| **D22** | `movementInputHandler.js:20-30` (`getIncomeConfig`) | exacto, sin cambios |
| **D30** | `accountCreationController.js:985-988` convierte un target ausente en `0.00` | **ya no existe.** El archivo tiene 986 líneas y no asigna ningún `target`; la ruta que creaba la cuenta del tipo retirado fue retirada (`accountRoutes.js:57-60`). La conclusión de D44 se confirma en el esquema: `target_amount` es `NOT NULL CHECK (> 0)` en `020_create_pocket_tables.sql:89` |
| **D39** | el `SUM` de `dashboardController.js:216` lee `ua.account_balance` | está en `:224` y **ya no lee esa columna**: `:23` define `DERIVED_BALANCE = derivedAccountBalanceSql('ua')` y las tres cifras legacy se calculan sobre esa expresión. La mitad que D39 necesita —que es un saldo *a hoy*— sigue siendo cierta, así que la decisión no cambia |
| **D39** | `overviewBalanceRepository.js:41-56` agrega antes de restar | exacto en `feat/overview` (`MONTHLY_BALANCE_QUERY`), con la salvedad de que ancla en `SUM(ua.account_balance)` (`:47`), la columna almacenada |
| **D39** | `DebtsLayout.tsx:66` es un ternario sobre el signo; `:44` y `:48` son las dos magnitudes | `:75-79` el ternario, `:50` `debt_payable`, `:54` `debt_receivable`, y los rótulos literales en `:83` y `:91`. El archivo está modificado sin commitear |
| **D42 / D43** | `overviewBalanceRepository.js:16-21`, `overviewAccountRepository.js:92-106` | los dos exactos en `feat/overview` |
| **D21** (propuesta) | `dashboardController.js:682-698`: `JOIN user_accounts ua` da el saldo en vivo | el alias `account_balance` de esas filas sale hoy de `${DERIVED_BALANCE}` (`:569`, `:624` y siguientes), no de una columna leída del join. Sigue siendo el mismo número en cada fila de la cuenta y sigue sin ser un saldo histórico por fila, así que el argumento de la decisión no cambia |

**Nota de alcance.** D6-D9 fueron revisadas por un segundo agente (modelo Opus, sólo lectura) antes de cerrarse: verificó cada anclaje contra el código en vez de aceptar la recomendación del evaluador tal cual. Corrigió tres cosas que el evaluador no vio: (1) son **tres** copias vivas de *remaining*, no cuatro — `getAccountDataById.js:59` es código muerto no ejecutable (import roto, sin ruta enrutada); (2) el fallback FX estático nunca falla, así que el escenario de D8 tal como se planteó casi no ocurre — el riesgo real es la tasa sintética silenciosa; (3) D7 tal como estaba formulada no aplicaba: no hay conversión en lectura que decidir. Pendiente de registro aparte: si `getAccountDataById.js` se documenta como remark nuevo o se anexa a R73 — se decide en la fase de limpieza de código muerto, no bloquea nada aquí.

---

## Decisiones propuestas, a la espera del desarrollador

Plan y evaluación coinciden en las cinco primeras. Se aplican salvo veto.

| # | decisión propuesta | motivo |
|---|---|---|
| D1 | `Transfer` es sub-métrica de ALL, no tarjeta propia | No mueve net worth; darle peso de dominio miente sobre su importancia |
| D2 | El catálogo de KPI vive en un `overview_services` nuevo, que importa de `budget_services` | Extender budget acopla dos dominios con ciclos de vida distintos |
| D3 | `USE_NEW_BUDGET_SYSTEM` se **crea** en `feat/overview` | El flag no existe en el código: sólo aparece en documentación |
| D4 | `ListContent` se mueve, no se generaliza | Un solo consumidor; generalizar es trabajo sin segundo llamador |

> **Medido 2026-08-30 sobre estas dos filas.**
>
> - **D3.** El flag sigue sin aparecer en ningún archivo de `backend/src` ni
>   `frontend/src`. Sólo existe en `spec.md:11` y `:29`. La fila sigue siendo
>   exacta.
> - **D4.** El "un solo consumidor" sigue siendo cierto: `ListContent` tiene
>   exactamente un importador, `LastMovements.tsx:4`. Lo que ya no existe es el
>   segundo consumidor **pendiente** con el que `PLAN_OVERVIEW.md` §8 argumentó
>   el aplazamiento el 2026-08-29: `PocketDetail.tsx` no contiene ninguna
>   referencia a `ListContent`, ni viva ni comentada, y es uno de los trece
>   archivos de frontend del módulo de bolsillo reconstruido que hoy están sin
>   commitear. El aplazamiento perdió el hecho que lo sostenía; nada aquí se
>   cierra, se registra.
| D5 | El envelope de `getTransactionById` se registra y se difiere | Defecto del módulo de transacciones: es otro cambio lógico |
| D21 | `rows`/`transactions` de `GET /overview/:domain` reusa `MovementTransactionDataType` tal cual, incluido su campo `account_balance` con el significado que ya tiene en todo el resto del código (`dashboardController.js:682-698`: `JOIN user_accounts ua` → saldo **actual/en vivo** de la cuenta, el mismo número en cada fila de esa cuenta sin importar la fecha de la transacción — no es un saldo histórico por fila). No se introduce aquí un campo nuevo tipo `account_balance_after_tr` (el que sí usa `AccountDetail`, columna real `transactions.account_balance_after_tr`, inmutable por fila) | Cambiarle el significado a `account_balance` bajo el mismo nombre rompería a todo consumidor existente de `MovementTransactionDataType` (Income.tsx, Debts.tsx, PnL.tsx, Expense.tsx, Transfer.tsx). Añadir un campo nuevo con semántica de "saldo después de esta transacción" es una decisión de contrato aparte, para cuando exista la fase que construye la fila visual de Overview — no bloquea fase 3, que sólo debe servir el tipo ya congelado con fidelidad |

---

---

## Decisiones abiertas que bloqueaban la fase 1

**Cerradas 2026-08-20 — ver la tabla de arriba.** D6, D7 y D9 cerraron con la
conclusión del evaluador confirmada por revisión de código (D7 con la pregunta
reformulada). D8 cerró con una corrección: tres grados de procedencia, no dos.

## Decisiones abiertas que no bloquean la fase 1

| # | pregunta | recomendación | bloquea |
|---|---|---|---|
| D10 | ¿Qué vocabulario de tokens usa el CSS nuevo? | `--color-*` de `tokens.css`, sin tocar el CSS vecino | fase 4 |
| D11 | ¿Se corrigen `--crems`/`--cremse`? | Mueren con el archivo si se reemplaza en fase 4 | — |
| D12 | ¿"1 request" se mide en dev o en producción? | En build de producción; en dev `StrictMode` duplica todo efecto | aceptación de fase 4 |

## D44 — **CERRADA 2026-08-24: un bolsillo es una asignación**

| # | pregunta | resuelta | alcance |
|---|---|---|---|
| D44 | ¿Un bolsillo es una cuenta de custodia o una asignación sobre dinero que sigue en el banco? | **Una asignación.** Congelado en `PLAN_POCKET/POCKET_MODULE_SPEC.md` §2, del que este documento es consumidor y no autor | fases 1 a 4: alcanza al catálogo, al contrato y al hero |

Los seis puntos que la mantenían abierta están los seis cerrados en ese spec, y
ninguno quedó donde este documento suponía:

| punto abierto en D44 | resuelto |
|---|---|
| arrastre de asignaciones en transferencias entre bancos | no hay arrastre: transferencia real, luego Release en A y Allocate en B (§4) |
| consumo de fondos reservados al gastar | el gasto nunca se rechaza ni debita un bolsillo; la cuenta queda sobreasignada y lo dice (§2.5) |
| elegibilidad de inversión como origen | no: banco y efectivo solamente (§4) |
| saldo de apertura histórico sin origen recuperable | no existe: la migración no convierte movimientos en asignaciones (`Q4b`, §9.1) |
| tratamiento de la sobreasignación | es un estado válido, se muestra, no se reparte entre bolsillos (§2.6) |
| materialización o derivación del saldo | derivado siempre: `SUM(pocket_allocations.amount)`. No hay columna de saldo (§3) |

**Y hay un séptimo hecho que ninguna de las dos ramas de D44 preveía: el
desarrollador borró la última cuenta `pocket_saving` de producción el 2026-08-24.**
No es que la premisa vaya a cambiar en fase 3 — ya cambió, y hoy toda cifra de
este catálogo que lea `account_type_id = 4` devuelve vacío.

### Qué invalida, entrada por entrada

| entrada | qué decía | qué pasa |
|---|---|---|
| **P1** `total_pocket_balance` | `SUM(account_balance) WHERE account_type_id = 4` | **muere.** No hay cuentas de ese tipo y no volverá a haberlas. Su sucesora no es un saldo — ver el catálogo, §3bis |
| **P2** `pocket_transaction_count` | `COUNT(*) WHERE movement_type_id = 5` | **muere.** Un bolsillo no genera transacciones; `movement_type_id = 5` deja de escribirse |
| **P3** `pocket_delta_vs_prior_period` | diferencia de saldos, leída además como *lo ahorrado neto en el mes* | **muere como cifra de bolsillo, y su pregunta sobrevive en otro dominio.** Lo ahorrado en el mes es un hecho de `transactions`, no de intenciones — ver *Savings* en el catálogo |
| **P4** `trend` de pocket | serie de saldos a fin de mes (D23) | **muere.** No hay saldo del que hacer serie |
| **D23** · **D24** · **D28** | delta y MS1 de pocket como stock | quedan sin sujeto. El razonamiento sobre *lo ahorrado en el mes* se conserva y se muda al dominio Savings |
| **D27** `cashPosition = banco + pocket.totalAmount` | suma de custodia | **doble conteo.** El dinero del bolsillo ya está dentro del saldo del banco. `cashPosition` pasa a ser banco + efectivo, y se acompaña de comprometido y libre |
| **D27** / **D6** `netWorth` (H1) | suma `pocket_saving` entre las cuentas reales | el término se elimina, no se repunta. Sumar asignaciones al patrimonio es contar dos veces el mismo dinero |
| **D41** *"Savings NO es un tipo de cuenta: `pocket_saving` **es** la cuenta de ahorro"* | **invalidada.** `pocket_saving` no es ninguna cuenta ya. Savings deja de ser un tipo de cuenta y pasa a ser una conducta medida sobre un periodo | |
| **D30** · **G1-G3** `financialGoals` | leen `pocket_saving_accounts` | **se repuntan**, no mueren: las metas siguen existiendo, ahora en `pockets`. `G1 goals_total_balance` pasa a ser `totalAllocated`, y la regla de D30 (un `target` en `0.00` no entra) queda sin caso: `target_amount` es `NOT NULL CHECK (> 0)` en el esquema nuevo |
| **D29** alcance de la tarjeta pocket | sin `target`, sin `desired_date`, sin progreso | **sigue en pie**, y con mejor argumento que antes: agregar es del overview, detallar es del módulo |

### Qué no cambia

Los tipos y la nulabilidad del contrato de fase 2, tal como D44 ya anticipaba.
Y la regla de que el overview no calcula ninguna cifra de dominio: las nuevas se
sirven ya plegadas, igual que las que sustituyen.

> **Remedido 2026-08-30 sobre la tabla "qué invalida, entrada por entrada".**
> Las nueve filas siguen describiendo el código y sólo se confirman:
> `pocket_saving_accounts` sobrevive **vacía y a propósito**
> (`020_create_pocket_tables.sql:33-40` deja escrito que no se renombra ni se
> borra porque tres endpoints todavía la unen), `pocket_saving` sigue en el
> catálogo de tipos (`005_base_catalogs.sql:40`) y `movement_type_id = 5` sigue
> en el suyo (`:64`) — las dos cosas conservadas para no reescribir el historial,
> no porque se sigan escribiendo. `target_amount` es efectivamente
> `NOT NULL CHECK (> 0)` (`020:89`) y `pocket_allocations.source_account_id` es
> `NOT NULL` con `RESTRICT` (`020:149`), tal como la fila de D30/G1-G3 asume.
>
> **Lo que hay que añadir a la fila de `financialGoals`.** Dice que G1-G3 "se
> repuntan, no mueren". Sigue siendo la decisión, pero desde el 2026-08-30 no hay
> de dónde repuntar en la rama de trabajo: `SavingGoals.tsx` fue borrado por
> `b40c4b8` junto con su petición, y la consulta que servía las tres cifras sólo
> existe en `feat/overview` (`overviewPageRepository.js:50-58`), leyendo la tabla
> vacía. La decisión se conserva; el trabajo que implica creció.

---

## Registro de correcciones — 2026-08-30

Sólo mediciones. **No se cerró, borró ni reescribió ninguna decisión**, y no se
reordenó ninguna unidad de trabajo. Medido en `fix/auth-screen`, `e919a89`,
árbol de trabajo incluido.

| bloque | qué se corrigió |
|---|---|
| "Overview se aborda al final" | las cifras de la rama se confirman (8 commits, 29 archivos, 3201 líneas) y los tres anclajes del dominio de bolsillo también; se añade que la sección de metas de ahorro cae por el mismo motivo, y que la pantalla legacy ya dejó de leer el modelo retirado desde `b40c4b8` |
| Decisiones cerradas | tabla nueva de anclajes: D6, D7 (dos), D14, D19 (tres), D30, D39 (tres) y la propuesta D21 se reanclan; D16/D20/D22/D42/D43 se reverifican sin cambio |
| Decisiones propuestas | D3 reverificada (el flag sigue ausente); **D4 marcada** — el segundo consumidor pendiente de `ListContent` ya no existe en `PocketDetail.tsx` |
| D44 | la tabla de invalidación se confirma entera contra el esquema; se añade que G1-G3 se quedó sin origen en la rama de trabajo |

**Verificado y dejado como estaba:** la nota de alcance sobre D6-D9 —
`getAccountDataById.js` sigue siendo código muerto no ejecutable: su import es
`../../src/db/configDB` desde `backend/src/utils/fintrackUtils/accountDataRetrieval/`,
que no resuelve, y su único llamador, `getAccountByIdController.js:5`, no está
enrutado en ninguna parte. El fallback FX estático sigue sin lanzar.

**Sin resolver:** ninguna de las cifras de base de datos de D26, D30, D31 ni de
la nota de D44 (los conteos locales y de producción) se recomprobó — no se leyó
ninguna base de datos en esta sesión, así que se dejaron intactas.

---

## Material para analizar cuando se retome Overview — anotado 2026-08-31

**Esto no es una decisión ni una propuesta. Es material que el desarrollador
pidió dejar registrado para analizarlo cuando llegue el turno del módulo.**

### Qué es

La pantalla principal de bolsillos tal como estaba antes de que se rehiciera su
bloque de indicadores, congelada como página navegable:

`plan-docs/playwright/shots/pocket/original.html`

No es una reconstrucción de memoria. La hoja de estilos del módulo se extrajo
del commit anterior al cambio y quedó guardada al lado, como
`pocket-styles.before.css`, y la página enlaza a esa copia y no a la hoja viva.
Las otras tres hojas que consume — los tokens, la hoja raíz y la hoja general —
sí son las vivas, porque no cambiaron. Comprobado leyendo un valor de vuelta: la
banda del encabezado de grupo mide 0px de borde en esta página y 1px en la hoja
actual, así que la copia congelada es la que manda.

Se abre con doble clic. No necesita servidor ni la aplicación levantada.

### Por qué le sirve a Overview

Overview no produce dato propio: consolida el de los demás módulos, así que la
forma en que un módulo presenta su partición de estados es exactamente el
problema que Overview va a tener multiplicado por cinco dominios. Esta página
es el caso medido de esa forma, con sus defectos a la vista.

Cuatro cosas concretas para mirar ahí, todas visibles sin abrir código:

1. **Una partición que cuenta algo que nunca nombra.** El encabezado dice
   `FUNDED 3` y la única lectura debajo dice `2 ABOVE TARGET`. El tercer
   bolsillo — el que llegó exacto a su objetivo — está contado y no está
   escrito en ninguna parte: existe sólo como la resta entre dos cifras. Es el
   defecto que más importa para Overview, porque un tablero que consolida
   dominios va a heredar todos los encabezados agregados de todos ellos.

2. **La lista apilada contra la tira de dos filas.** El reemplazo pone una
   columna por grupo, con la banda del encabezado abarcando sus lecturas, y eso
   es lo que abrió sitio para el nivel que faltaba. La comparación está en
   `status-strip.html`, misma carpeta, con las mismas cifras para que se lean
   renglón por renglón.

3. **El dibujo se lleva una fila entera para él solo**, arriba de la etiqueta,
   en las dos tarjetas. No se notaba mientras los SVG no se renderizaban en el
   banco de pruebas. Hay un candidato con el dibujo al costado, como riel
   izquierdo, en la misma página.

4. **La grilla de dos tarjetas iguala alturas y deja una vacía por abajo.** La
   tarjeta de próximo objetivo tiene tres líneas y un tercio de tarjeta en
   blanco debajo, porque la vecina es más alta. Overview va a tener más de dos
   bloques por fila, así que este efecto se le multiplica.

### Lo que falta decidir y es del desarrollador

**No está dicho si esta página es el modelo a seguir o el contraejemplo.** Se
registró tal cual la pidió, sin veredicto. La pregunta concreta para cuando se
retome el módulo: si Overview adopta el idioma de banda que abarca sus lecturas
para presentar cada dominio, o si conserva la lista apilada por dominio.

### Material relacionado, misma carpeta

- `status-strip.html` — el bloque de estados rehecho, con ~~los cinco niveles~~
  **siete niveles desde el 2026-09-04** y seis casos borde: tablero vacío, todo
  vencido, nada que atender, cifras de tres dígitos, y el servidor reteniendo
  las cifras. La escala vigente está dibujada en
  `plan-docs/design-refs/pocket-status-scale.html` y definida en
  `PLAN_POCKET/POCKET_LEVELS_REFERENCE.md`.
- `next-target.html` — dos formas de poner en fila la tarjeta de próximo
  objetivo, con su caso vacío, pendientes de que el desarrollador elija una.

---

## Qué le llega a Overview del trabajo de bolsillos — medido 2026-08-31

Cabeza `fb4dc01` sobre `fix/auth-screen`, más lectura del árbol de `feat/overview`
en `C:/AA1-WEB_DEVELOPER/REACT/apps/FINTRACK/pern_fintrack_overview`, cabeza
`1fb66b9`. Todo en lectura; no se tocó código de ninguna de las dos.

Overview no produce dato propio: consolida el de los demás módulos. Así que la
pregunta útil no es *qué cambió en bolsillos* sino **qué de lo que cambió altera
lo que Overview va a tener que consumir o presentar**. Se separa en tres, porque
las tres tienen consecuencias distintas.

### 1. Del vocabulario, nada — y se verificó antes de decirlo

**Overview no consume ni una palabra del vocabulario de bolsillos hoy.** No es una
suposición por ausencia de importaciones evidentes; se contó:

- El mapa compartido de niveles y sus dos ayudantes de presentación
  (`frontend/src/fintrack/helpers/pocketStatus.ts`) tienen **seis importadores en
  todo el frontend, y los seis viven dentro del módulo de bolsillos**: la ficha de
  detalle, su ícono de lectura, la tarjeta de la lista, el encabezado del tablero,
  la barra de herramientas y el hook del filtro. **Cero fuera del módulo.**
- En `frontend/src/fintrack/pages/overview/` la palabra *pocket* aparece en **dos
  líneas, las dos comentadas** (`overviewFetchAll.ts:67` y `:72`), restos de dos
  claves de KPI que se quitaron del agregador.
- Y la sección de metas del contrato congelado
  (`PLAN_OVERVIEW_CONTRACT.md:377-380`) son **tres importes y ninguna palabra de
  nivel**: saldo total, meta total y faltante total.

**Consecuencia.** El cambio del nivel `funded` a *At target*, el faltante unificado
en *Still to allocate*, la partición en dos bandas y la fila de excepciones **no
rompen nada de Overview y no obligan a ningún cambio hoy**. Lo que hacen es fijar
el idioma que Overview tendrá que adoptar el día que presente bolsillos: si teclea
sus propias palabras, será el tercer sitio que nombra el mismo nivel de una tercera
manera, que es exactamente lo que el mapa compartido se escribió para impedir.

> **Remedido 2026-09-04 — la conclusión se sostiene y el idioma que fija creció.**
>
> **Overview sigue sin consumir una sola palabra del vocabulario de bolsillos**, y
> ahora hay una razón estructural además del conteo de importadores: el dominio de
> bolsillo de Overview **no lee el tablero**. `overviewPocketService.js:45-47`
> delega en `readStockDomain`, que produce saldo, conteo de movimientos, delta y
> serie — ninguna clasificación. Los niveles viven en
> `pocketBoardService.js`, que Overview no importa.
>
> **Pero el idioma que Overview heredará el día que presente metas pasó de cinco
> palabras a siete.** La clasificación se decide en un solo sitio del servidor,
> `pocketLevel.js:53-111`, y publica uno de siete valores en el orden de lectura
> que `POCKET_LEVELS` congela (`:123-132`): meta alcanzada, meta superada, por
> delante del plan, en línea con él, por detrás, necesitando el doble del ritmo
> fijado, y con la fecha vencida sin cubrir.
>
> **Dos cifras del encabezado del tablero cambiaron, y las dos importan para un
> encabezado consolidado.** El conteo de bolsillos por delante de su plan
> **desapareció** — era un conteo de nivel menos un redondeo, así que
> `levelCounts.ahead` lo responde entero — y la **suma de esa holgura se acotó a
> los bolsillos que leen ese nivel** (`pocketBoardService.js:233-239`), porque un
> conteo sobre una población junto a una suma sobre otra más ancha es una fila que
> no cuadra.
>
> **Y esa segunda corrección es exactamente la lección que el material congelado
> de arriba pedía mirar**, resuelta por el módulo antes de que Overview la
> heredara: una partición que cuenta algo que nunca nombra. La regla que sale de
> ahí, y que un tablero que consolida cinco dominios va a necesitar cinco veces:
> **una cifra agregada se publica sobre la misma población que el conteo impreso a
> su lado, o no se publica al lado.**

### 2. De las definiciones, una — y es un choque de verdad

**El faltante de una meta se calcula de dos maneras incompatibles, y las dos están
argumentadas por escrito.**

- **Bolsillos recorta por bolsillo antes de sumar**, y hace viajar el excedente por
  separado en `totalExcess`. La razón está escrita en
  `pages/pocket/components/PocketBigBoxResult.tsx:201-209`: para que un bolsillo
  sobrefinanciado **no cancele** a otro atrasado. Por eso la identidad que el
  encabezado imprime es `comprometido − excedente + restante = meta` y no una resta.
- **Overview suma plano.** `overview_services/core/makeFinancialGoals.js` documenta
  que `goalsTotalRemaining` es una resta simple, que una meta ya superada aporta
  negativo y baja el total, y que **recortar informaría más trabajo pendiente del
  que hay**.

Para la misma cartera devuelven cifras distintas. No es un detalle de redondeo: con
un bolsillo excedido en 500 y otro atrasado en 500, bolsillos informa 500 por
asignar y Overview informa 0. **Un dueño que mire las dos pantallas ve dos
respuestas a la misma pregunta.**

**Decisión abierta, y es del desarrollador.** No se cierra aquí y no se recomienda a
la ligera, porque las dos posturas responden preguntas legítimamente distintas: el
recorte responde *cuánto falta poner*, la resta plana responde *cuánto falta en
neto*. Lo que no puede sostenerse es que las dos se llamen igual en pantalla.

### 3. De la forma, la que ya estaba anotada — y una parte se resolvió sola

La página de referencia congelada de arriba, `plan-docs/playwright/shots/pocket/original.html`,
sigue siendo válida **como fotografía**, pero hay que leerla sabiendo que **tres de
sus cuatro defectos ya no existen en el módulo vivo**. Se dice aquí para que nadie
diseñe Overview esquivando un problema que ya fue resuelto:

| defecto anotado en la página congelada | estado en el módulo vivo, medido 2026-08-31 |
|---|---|
| La partición cuenta algo que nunca nombra: `FUNDED 3` sobre una sola lectura `2 ABOVE TARGET` | **Resuelto.** El bolsillo que aterriza exacto tiene lectura propia, `PocketBigBoxResult.tsx:313-323`, y va marcada con un tic en vez de un cuadro por ser el único nivel terminado |
| La lista apilada contra la tira de dos filas | **Resuelto en favor de la tira**: una columna por grupo, con la banda abarcando sus lecturas (`:296-367`) |
| El dibujo se lleva una fila entera arriba de la etiqueta, en las dos tarjetas | **Sin remedir en este pase.** Es una medición de navegador y este pase no levanta la aplicación |
| La grilla de dos tarjetas iguala alturas y deja una vacía por abajo | **Resuelto por otra vía.** Las tarjetas ya no comparten fila: `pocket-styles.css:515-517` deja una sola columna, y la de próximo objetivo pasó a fila (`pocketHero__card--row`) y está **ausente**, no vacía, cuando no hay nada que señalar |

**Lo que sigue abierto de esa página es la única pregunta que traía**, y no la mueve
nada de esto: si Overview adopta el idioma de banda que abarca sus lecturas para
presentar cada dominio, o conserva la lista apilada por dominio. Sigue sin veredicto.

**Y hay una pieza nueva que la página no tiene y que Overview va a necesitar más que
bolsillos:** la **fila de excepciones sin conteo en su encabezado**
(`PocketBigBoxResult.tsx:386-429`). Es para lo que ya está contado arriba y hay que
volver a mirar; el conteo se omite a propósito, porque un número ahí invitaría a una
suma que no cierra. Overview consolida cinco dominios, así que va a tener cinco
particiones y un solo sitio donde levantar lo urgente de todas: es el mismo problema,
multiplicado.

---

## Tres hechos medidos en la rama de Overview que ningún documento de este plan dice

Medidos el 2026-08-31 sobre `pern_fintrack_overview`, cabeza `1fb66b9`.

**Primero, y es el que decide si la tarjeta de metas puede embarcar: la consulta lee
el modelo de bolsillo retirado.** `overview_services/db/overviewPageRepository.js:50-61`
une `pocket_saving_accounts` y filtra por `account_type_name = 'pocket_saving'`,
leyendo `ua.account_balance` como saldo. El repositorio de cuentas filtra por el
mismo tipo en `overviewAccountRepository.js:62` y `:208`.

**El mecanismo importa, porque el diagnóstico corriente es erróneo.** No es que una
migración haya retirado esa tabla. `020_create_pocket_tables.sql` declara por escrito
en su cabecera (`:32-40`) que **no la borra ni la renombra** —tres endpoints vivos
todavía la unen— y que **no quita `pocket_saving` del catálogo de tipos**, porque
todo registro anterior lleva ese id significando *bolsillo*. La tabla sigue creada y
el tipo sigue en el catálogo. Lo que la migración hace es **vaciarla**: el paso 5
(`:360-392`) borra las cuentas de bolsillo de `user_accounts`, y la tabla de
extensión cuelga de ahí con `ON DELETE CASCADE`.

**Y de ahí sale la cifra exacta que la tarjeta va a mostrar.** Con cero filas,
`makeFinancialGoals.js` devuelve saldo **0**, meta **null** y faltante **null**, y
empuja el aviso `NO_GOAL_SET_NOTICE`, que dice *No saving goal has a target set*.
Sobre un dueño con bolsillos, metas y compromisos escritos en `pockets` y
`pocket_allocations`, la tarjeta informa **cero ahorrado y ninguna meta fijada, sin
lanzar un solo error**. Miente y no se rompe, que es el peor de los dos modos de
fallar.

**Segundo: el código cita un plan que no existe.** `makeFinancialGoals.js:5-6` remite
a `PLAN_POCKET_ALERT.md` para *the per-pocket card and hero*. Ese archivo no está en
`plan-docs/` ni en ninguno de los tres árboles de trabajo. Lo que gobierna esa
pantalla es `PLAN_POCKET/POCKET_MODULE_SPEC.md` con `POCKET_DECISIONS.md`. La
referencia hay que corregirla cuando se toque el archivo; **no se corrige aquí porque
está en código y este pase no escribe código**.

**Tercero: el componente de metas de ahorro diverge entre ramas, y la fusión tiene que
resolverlo.** En `fix/auth-screen` está **borrado** —`pages/overview/components/`
tiene cinco archivos y ninguno es `SavingGoals.tsx`, y las dos claves de bolsillo del
agregador están comentadas—. En `feat/overview` está **vivo y montado**: importado en
`Overview.tsx:10`, pedido en `:83` y renderizado en `:424`, contra el endpoint viejo
del dashboard. ~~Las dos ramas no pueden ganar.~~

> **Resuelto por los hechos 2026-09-04 — y los otros dos hay que releerlos.**
>
> **El tercero ya no está abierto: ganó el borrado.** La fusión ocurrió el
> 2026-09-02 y en el árbol de trabajo `frontend/src/fintrack/pages/overview/`
> **no contiene ningún `SavingGoals.tsx`**, ni en `components/` ni en ninguna
> parte del repositorio. Las dos claves de bolsillo del agregador siguen
> comentadas (`overviewFetchAll.ts:67` y `:72`). La pregunta *cuál rama gana con
> el componente de metas de ahorro* está contestada por el merge, no por una
> decisión: **no hay componente.** El nivel 1 lo construye de cero o no lo tiene.
>
> **El primero sigue entero y cambió de gravedad.** La consulta que lee el modelo
> de bolsillo retirado está hoy en la rama de trabajo
> (`overviewPageRepository.js:56-58`), servida y sin consumidor. Sigue devolviendo
> saldo cero, meta nula y faltante nulo con el aviso de *ninguna meta fijada*,
> sobre un dueño que sí tiene bolsillos, metas y compromisos escritos en `pockets`
> y `pocket_allocations`. Nadie lo ve porque nadie llama a la ruta.
>
> **El segundo se sostiene sin cambio:** el código sigue citando un plan que no
> existe. `makeFinancialGoals.js:6-8` remite a `PLAN_POCKET_ALERT.md` para la
> tarjeta y el hero por bolsillo, y ese archivo no está en `plan-docs/`. Lo que
> gobierna esa pantalla es `PLAN_POCKET/POCKET_MODULE_SPEC.md` con
> `POCKET_DECISIONS.md`, y la escala de niveles es
> `PLAN_POCKET/POCKET_LEVELS_REFERENCE.md`. **Sigue sin corregirse aquí porque
> está en código y este pase tampoco escribe código**; se corrige el día que se
> reescriba esa sección contra el modelo nuevo, que es el mismo día.

### Las tres decisiones que esto abre, y ninguna se cierra aquí

1. **Cómo se suma el faltante de las metas**: recortado por bolsillo con el excedente
   aparte, o resta plana.
2. **Qué se hace con la consulta de metas** antes de fusionar: reescribirla contra
   `pockets` y `pocket_allocations`, o dejar la tarjeta fuera de la primera entrega.
3. ~~**Cuál rama gana con el componente de metas de ahorro.**~~ **Cerrada por el
   merge del 2026-09-02: ganó el borrado, no hay componente.**

Las tres están además anotadas en `ongoing/ESTADO_PLANES.md`, secciones 8 y 10.

---

# Registro único de decisiones abiertas — consolidado 2026-09-04

**Por qué existe.** Hasta hoy las decisiones abiertas de este módulo estaban
repartidas entre seis documentos, y varias aparecían en dos con redacciones
distintas. Ésta es la lista única. **Agrupada por lo que bloquea, no por
prioridad**: una decisión importa por lo que impide empezar, no por una etiqueta.

Una fila deja este registro sólo de dos maneras: el desarrollador la cierra, o
una medición demuestra que la pregunta ya no tiene sujeto. Lo segundo no es
cerrar una decisión — es descubrir que no había ninguna.

## Grupo A — bloquean la primera pantalla del nivel 1

Nada de esto se puede empezar sin resolverlo, porque decide qué se dibuja.

| decisión | qué está en juego | quién decide | recomendación |
|---|---|---|---|
| Dónde viven los gráficos de distribución del gasto — el de barras ordenadas con su curva acumulada y el de anillo | Si el nivel 1 lleva una sección de análisis o si es sólo reconocimiento, y si hace falta un entorno nuevo de tablero | desarrollador | **D47**, abajo |
| Qué muestra el nivel 1 | La lista de bloques de la primera pantalla. Declarado abierto por el desarrollador el 2026-09-03 y nada lo cerró desde entonces | desarrollador | **D50**, abajo |
| Si Overview adopta el idioma de banda que abarca sus lecturas, o conserva la lista apilada por dominio | La forma de presentar la partición de estados de cada dominio, multiplicada por cinco | desarrollador | **D50** la absorbe: el nivel 1 no lleva particiones de estado |
| Cómo se suma el faltante de las metas: recortado por bolsillo con el excedente aparte, o resta plana | Dos pantallas de la misma app informan cifras distintas para la misma cartera. Con un bolsillo excedido en 500 y otro atrasado en 500, el módulo de bolsillos informa 500 por asignar y Overview informa 0 | desarrollador | **recortar y publicar el excedente al lado**, igual que el tablero de bolsillos. La resta plana contesta *cuánto falta en neto*, que es una pregunta legítima y no es la que un dueño hace mirando metas; y de las dos, sólo el recorte permite que la cifra de Overview y la del módulo sean la misma cifra. Coste de backend: reescribir la sección de metas, que **hay que reescribir igual** por la fila del Grupo B |

## Grupo B — decididas, sin implementar: no falta decisión, falta trabajo

Estas no van a una reunión. Están cerradas por escrito y el código no las tiene.
Se listan aquí porque cinco documentos las citan como si estuvieran servidas.

| qué falta | decisión que la cerró | dónde debería estar y no está |
|---|---|---|
| La sección de metas de ahorro leída contra el modelo vivo de bolsillos | D44 (2026-08-24): las metas se repuntan, no mueren | `overviewPageRepository.js:56-58` sigue uniendo la tabla vaciada por la migración `020`. **Es la primera pieza que hay que arreglar**: es la que empieza a mentir en voz alta el día que el nivel 1 haga su primera petición |
| El saldo de bolsillo de la tarjeta de dominio y su serie | D44, misma fecha | `overviewAccountRepository.js:201-208` lee el tipo de cuenta retirado |
| Las dos piernas de la posición de deuda y el conteo de deudores saldados | D39 y D43 (2026-08-21), definidas normativamente en el contrato §5.1 y §5.2 | `overviewDebtService.js:37-39` delega en la tarjeta base y no las produce. Cuesta **una consulta nueva**: el total al cierre agrega antes de restar, así que no admite corte por signo |
| La distribución del gasto acumulado del año por categoría | D33 (2026-08-21), tipo escrito en el contrato §11 | El servicio de página publica dos llaves de gráfico y no tres (`overviewPageService.js:183-190`) |
| Que las cuentas de efectivo entren donde entra el banco | D45 (2026-09-01): una cuenta de efectivo **es** una cuenta bancaria en toda lectura | `overviewAccountRepository.js:62` enumera cuatro tipos y ninguno es `cash` |
| Que el patrimonio y la posición de efectivo se lean en una sola base temporal | D46 (2026-09-03) lo declara defecto y condiciona el selector de mes a que se corrija | El saldo de banco no acepta mes y la cifra de inversión se declara *a hoy*. **Bloquea el selector de mes del nivel 1**, no el nivel 1 |

## Grupo C — bloquean la fase de estilos, no el diseño

| decisión | bloquea |
|---|---|
| Qué vocabulario de tokens usa el CSS nuevo (D10) | la fase de estilos |
| Si se corrigen los dos tokens mal escritos del CSS vecino (D11) | nada: mueren con el archivo si se reemplaza |
| Si el criterio de "una petición" se mide en build de desarrollo o de producción (D12) | la aceptación de la fase de estilos, no su construcción |
| La etiqueta del promedio mensual y su divisor de meses con movimiento (D36) | **adoptada por recomendación, sin confirmación explícita.** No bloquea: si el nivel 1 no lleva el promedio, la pregunta se difiere entera |

## Grupo D — cerradas por medición, no por decisión

Se registran porque cinco documentos todavía las listan como abiertas.

| pregunta | por qué ya no tiene sujeto |
|---|---|
| Cuál rama gana con el componente de metas de ahorro | El merge del 2026-09-02 la contestó: **no hay componente**. `SavingGoals.tsx` no existe en el repositorio |
| Dónde vive el catálogo de KPI: extender presupuesto o un módulo nuevo (D2) | `services/overview_services/` existe, con sus tres capas y sus dos rutas montadas. La decisión se ejecutó |
| Qué se hace con la consulta de metas **antes de fusionar** | Ya se fusionó. La pregunta sobrevive con otro disparador y está en el Grupo B |
| Si `ListContent` se mueve al árbol de Overview o se generaliza (D4) | Sigue abierta como decisión, pero **su premisa murió**: el aplazamiento se argumentó desde un segundo consumidor pendiente dentro del módulo de bolsillos, y el detalle de bolsillo reconstruido se escribió sin él. Hoy tiene exactamente un importador. No bloquea el nivel 1 |

---

# Decisiones propuestas — las cuatro preguntas del informe del 2026-09-04

**Estado: recomendaciones, no decisiones.** Entran a la tabla de cerradas cuando
el desarrollador las apruebe. Cada una lleva su coste de backend.

**Tres de las cuatro cuestan cero de backend**, y la cuarta no cuesta un campo
nuevo: cuesta la reescritura de la sección de metas de ahorro, que hay que hacer
igual porque hoy miente. Ninguna de las cuatro pide una migración.

## D47 — Los gráficos de distribución del gasto viven en el nivel 1, en una sección propia fuera de las tarjetas

**Recomendación.** El de barras ordenadas con su curva acumulada y el de anillo
se quedan en la primera pantalla, en una sección propia debajo de las tarjetas.
Ni entorno nuevo de tablero, ni escondidos dentro del dominio de gasto.

**Coste de backend: cero.** Las filas ya viajan en el payload de la página. El
servicio de página publica el mismo arreglo que alimenta los dos gráficos
(`overviewPageService.js:189`), producido por la calculadora de gasto
(`overviewExpenseService.js:132`) y ordenado por gasto descendente con el nombre
de la categoría rompiendo el empate, de modo que el orden no puede cambiar entre
dos peticiones idénticas. **Un solo arreglo para los dos gráficos**, así que no
pueden mostrar cifras distintas para la misma categoría.

**Por qué el nivel 1 y no un entorno nuevo.** Un entorno nuevo es una pantalla
más que mantener para dibujar datos que ya llegan en una petición que la primera
pantalla hace igual. Y la regla que ya está cerrada dice que las tarjetas no
llevan barra ni gráfico y que los gráficos se quedan en el nivel 1 como sección
aparte — una tarjeta es estado, un gráfico es comportamiento. Esa regla ya
distingue las dos cosas dentro de la misma pantalla; un entorno nuevo resuelve
otra vez un problema resuelto.

**Por qué no dentro del dominio de gasto.** Ahí obliga a dos peticiones donde
alcanza una, y arrastra la paginación de filas de un endpoint de detalle a una
pantalla que por contrato no carga filas. El drill-down del gasto **también**
los tendrá, con el grano por cuenta que el nivel 1 no muestra; no es lo mismo
dibujado dos veces.

**Lo que esta decisión no cierra:** la distribución del año acumulado sigue
declarada y sin servir. La sección arranca con lo que existe.

## D48 — El gasto sin categoría es un aviso, nunca una porción del anillo

**Recomendación.** Se muestra como una línea de aviso debajo del gráfico, con su
importe, y **no** como una categoría más.

**Coste de backend: cero.** La bandera y el aviso ya viajan en la tarjeta de
gasto: `makeExpenseCard.js` la levanta comparando el gasto total contra el gasto
que sigue resolviendo a una categoría viva, y anexa la frase que la explica en la
misma comparación que la levanta, para que la bandera y su explicación no puedan
discrepar.

**Por qué un aviso y no una porción.** Porque no es una categoría de gasto: es
historia huérfana. Un gasto **no se puede registrar sin categoría** — el destino
de un gasto *es* una cuenta de categoría, y el controlador de transacciones
rechaza la escritura cuyo destino no resuelve a una. La cifra sólo aparece cuando
una categoría fue borrada o perdió su fila de presupuesto. **En un juego de datos
sano vale cero.** Un valor distinto de cero es una señal de integridad de datos,
y pintarlo como porción lo pone a competir por área con categorías reales,
sugiriendo que el dueño "gastó" ahí. Un anillo con una porción llamada *sin
categoría* invita a preguntar en qué se fue ese dinero; el aviso contesta la
pregunta correcta, que es **qué categoría desapareció**.

**Y hay una razón de aritmética además de la de significado:** el arreglo del
anillo se construye sobre las categorías del presupuesto e incluye a propósito
las borradas con gasto real, para que la suma de las porciones reconcilie exacto
con el total de la tarjeta. Añadir una porción sintética con la diferencia
rompería esa reconciliación por doble conteo.

## D49 — No se construye ninguna regla de inactividad de deudores

**Recomendación.** Se retira del boceto de agosto y no se propone como trabajo.

**Coste de backend: cero, y ése es el punto** — construirla cuesta un módulo que
no existe.

**Por qué.** La regla **no existe en ninguna parte del código**: no hay directorio
de servicios de deuda y no hay ninguna constante de días para ella. La única cifra
de *días desde* que el repositorio calcula es la de la tarjeta de inversión, días
desde el último aporte, y su definición es deliberadamente estrecha — cuenta sólo
las transferencias de aporte y excluye la apertura de la cuenta, porque abrir una
cuenta una vez no es un hábito. Un boceto que muestre *60 días sin movimiento*
sobre un deudor **está inventando una regla**, no reflejando una que exista.

**Y la pregunta que la abriría se hizo y nunca se contestó:** si sería una
constante fija o una banda con nombre, como los siete niveles del módulo de
bolsillos. Ésa es la que decide el coste. Una constante es un número en un
archivo; una banda con nombre es una clasificación, y una clasificación exige
decidir sus cortes, sus palabras, sus colores y dónde se calcula — el módulo de
bolsillos acaba de pagar ese precio entero y llevó semanas.

**Lo que sí se recomienda en su lugar, y ya está decidido y sin construir:** el
conteo de contrapartes saldadas al cierre. Contesta una pregunta cercana — *quién
ya no me debe nada* — está definido normativamente, no inventa ninguna regla, y
su coste está contado en el Grupo B.

## D50 — El nivel 1 son ocho bloques y ninguno de ellos es un gráfico dentro de una tarjeta

**Recomendación.** Ver la propuesta desarrollada y el boceto navegable en
`plan-docs/design-refs/overview-level-1/overview-level-1.html`.

**Coste de backend: cero para siete de los ocho bloques.** Todos salen del payload
que `GET /api/fintrack/overview` ya devuelve. El octavo — el bloque de metas de
ahorro — **no cuesta un campo nuevo sino una reescritura**: la que el Grupo B pone
primera en la fila.

**El bloque que no se propone, y hay que decirlo antes que los ocho:** el
**selector de mes no embarca con el nivel 1**. Está decidido que Overview es dueño
de su mes, y en la misma decisión está escrito por qué no puede embarcar todavía:
dos de los cuatro términos del patrimonio ignoran el mes pedido, así que un mes
pasado suma dos saldos de hoy con dos saldos al cierre y produce una cifra que no
corresponde a ningún instante. **Un control que reetiqueta una cifra que no mueve
es peor que no tener control.** El nivel 1 arranca en el mes en curso, sin
selector, y lo gana cuando esos dos términos se reconstruyan al cierre.

### Los ocho bloques, y de dónde sale cada uno

| # | bloque | qué contesta | de dónde sale |
|---|---|---|---|
| 1 | **Encabezado de tres cifras** — patrimonio, efectivo disponible, flujo neto del mes | Cuánto tengo, cuánto puedo gastar hoy, y si el mes fue hacia adelante o hacia atrás | `hero`, servido |
| 2 | **Cinco tarjetas de dominio** — ingreso, gasto, deuda, bolsillo, resultado | El estado de cada dominio en tres cifras: total del periodo, movimientos detrás de ese total, y cambio contra el cierre anterior | `domainCards`, servido. **Sin barra, sin progreso y sin mini gráfico**, por la regla ya cerrada: una tarjeta es estado |
| 3 | **Tarjeta de inversión, con forma propia** | Capital aportado, saldo en libros, resultado registrado, peso de la mayor posición y días desde el último aporte | `domainCards.investment`, servido. **No comparte la forma de las otras cinco y el boceto no se la impone**: cinco cifras absolutas no son un total, un conteo y una delta, y el código lo declara por escrito |
| 4 | **Distribución del gasto** — barras ordenadas con curva acumulada, y anillo | Qué categorías dominan el mes y cómo van contra su presupuesto | `charts.expenseCategories`, servido. **D47** |
| 5 | **Tres series de seis meses** — ingreso, gasto, bolsillo | Cómo se movió cada uno en el tiempo | `charts.trend`, servido |
| 6 | **Instantánea mensual** de esos tres dominios | Si este mes es inusual comparado con un mes con movimiento | `monthlySnapshot`, servido. Su etiqueta depende de **D36**, sin confirmar; si no se confirma, el bloque se difiere sin tocar nada más |
| 7 | **Metas de ahorro** | Cuánto hay guardado en total y cuánto falta | `financialGoals`, **servido y mintiendo**. Único bloque con coste: la reescritura del Grupo B |
| 8 | **Últimos cinco movimientos** | Qué pasó por último | `recentActivity`, servido. **No se acota al mes**: contesta *qué pasó por último*, no *qué pasó en el mes que estoy mirando* |

### Las tres reglas de forma que el nivel 1 no puede romper

1. **Los tres estados de carga son tres cosas distintas.** Esqueleto mientras
   llega, mensaje con reintento si falla, y vacío cuando no hay nada que mostrar.
   Con cinco dominios en una pantalla, ésta es la parte difícil, no un detalle.
2. **Una cifra que el servidor retuvo se dibuja como guion**, nunca como `0` ni
   como `NaN`. El contrato distingue las dos cosas a propósito en varios campos:
   *no hay meta fijada* es `null` y *la meta es cero* es un cero, y sólo el
   segundo es una cifra.
3. **Una cifra agregada se publica sobre la misma población que el conteo impreso
   a su lado, o no se publica al lado.** Es la lección que el módulo de bolsillos
   acaba de pagar dos veces, y un tablero que consolida cinco dominios la va a
   necesitar cinco veces.

---

## Registro de correcciones — 2026-09-04

Medido en `feat/vercel-serverless`, árbol de trabajo incluido. No se leyó ninguna
base de datos y no se escribió ninguna línea de código.

**Ninguna decisión cerrada se borró, se reescribió ni se reordenó.** Lo que se
corrigió son mediciones que envejecieron, y una de ellas cambia el estado del
módulo entero.

| bloque | qué se corrigió |
|---|---|
| "Overview se aborda al final" | **la rama se fundió.** Ocho commits sin fundir pasaron a cero: el merge del 2026-09-02 llevó todo a `main` y de ahí a la rama de trabajo. La frase *"la rama no se puede fundir tal como está"* hay que leerla al revés — se fundió tal como estaba, con los tres anclajes del modelo retirado dentro. La decisión del desarrollador no se toca; lo que ya no aplica es su premisa operativa |
| Material de bolsillos, primera parte | **son siete niveles y no cinco.** La escala se rehízo el 2026-09-04 y se anotan las dos cifras del encabezado que cambiaron: el conteo de bolsillos por delante del plan desapareció por ser un conteo de nivel menos un redondeo, y la suma de esa holgura se acotó a los bolsillos que leen ese nivel |
| Material de bolsillos, segunda parte | se confirma que **Overview no consume una sola palabra** de ese vocabulario, ahora con una razón estructural: su dominio de bolsillo no lee el tablero, lee saldo y serie |
| Tres hechos medidos en la rama | **el tercero está cerrado por el merge**: ganó el borrado, el componente de metas de ahorro no existe en el repositorio. El primero sigue entero y con más gravedad; el segundo —el código citando un plan inexistente— sigue sin tocarse porque está en código |
| Nuevo | **registro único de decisiones abiertas**, agrupado por lo que bloquea cada una, sustituyendo a las tres tablas repartidas entre este archivo, el plan y la evaluación |
| Nuevo | **D47 a D50**, las cuatro recomendaciones del informe del 2026-09-04, cada una con su coste de backend. Son propuestas, no decisiones |

**Verificado y dejado como estaba:** las cuarenta y seis decisiones cerradas, sus
motivos y sus fechas; la tabla de anclajes del 2026-08-30; y la invalidación
entrada por entrada que dejó la decisión de que un bolsillo es una asignación.

**Sin resolver:** los conteos sobre la base local que este archivo arrastra desde
agosto. Ninguno se recomprobó.

**Encontrado y no corregido aquí, porque pertenece a otro plan:** la cabecera de
`PLAN_POCKET/POCKET_LEVELS_REFERENCE.md` se declara *especificación congelada,
todavía sin implementar*, y dice que el clasificador embarcado lleva seis niveles
y ninguna banda de tolerancia. **Las dos afirmaciones son falsas hoy**: el
clasificador tiene los siete niveles y la banda, y la lista congelada de niveles
tiene siete entradas. Ese documento es de la sesión del módulo de bolsillos y se
le reporta en vez de editarlo, para no escribir dos sesiones sobre el mismo
archivo.


---

## D51 — The expense distribution block carries the budget, per category and accumulated

**Asked for by the developer on 2026-09-04**, while reading the level-1 mockup.
Two additions to the ranked expense bars: the planned amount of each category
shown against its own bar, and a second cumulative curve accumulating the budget
beside the one accumulating the spend.

**Why it is worth the field.** The block answers *where the month went*. With the
plan drawn beside the spend it also answers *where the month was supposed to go*,
and the gap between the two curves is the only place on level 1 where the reader
sees whether spending concentrates faster than the plan does. Neither figure
answers that alone: a category over its budget is visible on the card as a
variance, but a portfolio whose overspend is concentrated in its two largest
categories is a different situation from one whose overspend is spread across
six, and only the two curves side by side distinguish them.

### Backend cost — one of the two is free, the other is two fields

| addition | cost | where |
|---|---|---|
| The planned amount per category | **zero.** Already served. Every row of the expense distribution arrives from the budget module carrying the planned amount, the spend, what remains, the execution rate and an over-budget flag (`makeBudgetCategoryStatus.js:82-89`); the Overview module only decorates those rows with a rank and the running spend | nothing to write |
| The accumulated budget and its share | **two fields.** The running total in `makeCategoryBreakdown.js:66-82` accumulates spend only — there is no running budget and no budget share. Add them next to the two that exist, at the same four-decimal scale the spend share already uses and for the same reason: two decimals is one-percent resolution, and a long tail would put several categories on the same point | `makeCategoryBreakdown.js` |

**Why the two fields go on the server and not in the component.** The guard rule
of this plan is that every financial figure is computed on the server and that one
indicator has one formula and one implementation. A running sum written in a React
component is a second implementation of an arithmetic the same module already
performs one line above, and the two would drift the first time either changed.

### Three rules the reading cannot break

1. **The rows are ranked by spend, and the budget curve inherits that order.** It
   is therefore the budget accumulated in spend rank, not a ranking of budget, and
   it is not guaranteed to bend the way an accumulation of its own ranking bends —
   a category small in spend and large in plan makes it rise steeply at a step
   where the spend curve is already flat. The ordering has to be stated on the
   block, because a reader who assumes two comparable curves misreads exactly that
   step. **Re-ranking to make the curve look like a Pareto is forbidden:** it would
   give the same screen two orderings of the same rows, which is the class of
   defect this plan exists to prevent.
2. **A category with no planned amount cannot enter the accumulation**, and the
   figure renders as a dash and never as a zero. The planned amount is legitimately
   absent for a category whose budget row does not exist and for one holding more
   than one currency — the second already carries a null spend and ranks last by
   the rule that governs it. **The running budget skips such a row and the curve
   continues**, rather than ending at it: the block exists to compare the shape of
   two accumulations, and a curve truncated at the first category without a plan
   compares nothing from that row on. The cost is that the final point then means
   *the plan for the categories that have one*, which is not the total budget, so
   the end of the curve carries that wording whenever a row was skipped. This was
   the only open question the decision left and it is now closed; the design states
   the rule in words because no row in the mockup data can demonstrate it.
3. **Over budget is a state and not only a position.** The flag is served per
   category. It cannot be signalled by colour alone: the bars are already colour
   coded by rank, so a colour signal would collide with the identity signal the
   ring and the bars share.

**Where the design of it lives:** the ranked bars of
`plan-docs/design-refs/overview-level-1/overview-level-1.html`, the section headed
*Where August went*.

**What it does not change.** The block still stays in level 1 rather than moving to
a new environment, and it is still not a chart inside a card. It gains a reading;
it does not gain a home.
