# Overview — bosquejo de cómo se renderiza el frontend

Escrito el 2026-09-07, medido sobre el código de `feat/overview`, no leído de los
planes. Responde una pregunta que los documentos anteriores no responden: **para
cada bloque que dibuja la pantalla, de qué campo publicado sale, en qué endpoint
y a qué profundidad.**

Los nombres de campo van en inglés porque son identificadores del payload; el
texto va en castellano.

---

## 1. Tabla maestra — cada task de render y su estado

Una fila por bloque que el frontend tiene que construir. `estado` no dice si el
componente existe — ninguno existe todavía —, dice **si el dato que necesita está
publicado hoy**.

| # | task de render | de qué campo sale | endpoint · profundidad | estado |
|---|---|---|---|---|
| 1 | Héroe — 4 figuras de stock | `netWorth`, `liquidNetWorth`, `cashPosition`, `freeCash` | `GET /` · nivel 1 | **SERVIDO** |
| 2 | Héroe — 2 figuras de flujo | `netMonthlyFlow`, `savingsRate` | `GET /` · nivel 1 | **SERVIDO** |
| 3 | Tarjeta consolidada | `all` | `GET /` · nivel 1 | **SERVIDO** |
| 4 | Tarjeta de ingreso | `domainCards.income` | `GET /` · nivel 1 | **SERVIDO** |
| 5 | Tarjeta de gasto, con presupuesto | `domainCards.expense` + `budgetAmount`, `categorizedExpense`, `budgetVariance`, `hasUncategorizedExpense` | `GET /` · nivel 1 | **SERVIDO** |
| 6 | Tarjeta de deuda, dos piernas | `domainCards.debt` + `payable`, `receivable`, `settledCount` | `GET /` · nivel 1 | **SERVIDO** |
| 7 | Tarjeta de pocket, anillo y línea de estado | `domainCards.pocket` + `target`, `remaining`, `progress`, `fundedCount`, `overdueCount`, `uncoveredCount` | `GET /` · nivel 1 | **SERVIDO** |
| 8 | Tarjeta de resultado realizado | `domainCards.pnl` + `realizedFromInvestment` | `GET /` · nivel 1 | **SERVIDO** |
| 9 | Tarjeta de inversión | `domainCards.investment` — forma propia, **no comparte ni un campo de la forma base salvo `domain`, `currency` y `meta`** | `GET /` · nivel 1 | **SERVIDO CON TRAMPA** — ver §4.4 |
| 10 | Snapshot mensual, 3 dominios | `monthlySnapshot[]` | `GET /` · nivel 1 | **SERVIDO** |
| 11 | Metas financieras | `financialGoals` | `GET /` · nivel 1 | **SERVIDO** |
| 12 | Teaser de actividad reciente | `recentActivity.transactions` | `GET /` · nivel 1 | **SERVIDO** |
| 13 | Pareto del gasto | `charts.expenseCategories` con `rank`, `cumulativeActual`, `cumulativePercentage` | `GET /` · nivel 1 | **SERVIDO COMPLETO** |
| 14 | Líneas de tendencia, 6 puntos | `charts.trend.income`, `.expense`, `.pocket` | `GET /` · nivel 1 | **SERVIDO — sólo 3 de 6 dominios** |
| 15 | Pantalla de actividad con rango | `GET /activity` → `transactions` + `range` | `GET /activity` | **SERVIDO** |
| 16 | Listado paginado por dominio | `transactions{rows, page, pageSize, totalRows}` | `GET /:domain` · nivel 1 | **SERVIDO** |
| 17 | Serie larga, 13 puntos | `analysis.series` | `GET /:domain?analysis=derived` | **SERVIDO — 4 de 6 dominios** |
| 18 | Dona de ingreso por fuente | `analysis.bySource` + `concentration` | `?analysis=full` | **SERVIDO** |
| 19 | Dona de inversión por cuenta | `analysis.balanceByAccount` | `?analysis=full` | **SERVIDO** |
| 20 | Dona/ranking de deuda por contraparte | `analysis.byCounterparty` con `direction` | `?analysis=full` | **SERVIDO** |
| 21 | Progreso por pocket | `analysis.progressByPocket` | `?analysis=derived` | **SERVIDO CON TRAMPA** — escala 0-100, no 0-1 |
| 22 | Descomposición comprometido / libre | `analysis.committedAgainstFree` (3 términos) | `?analysis=derived` | **SERVIDO** |
| 23 | Conciliación de inversión | `analysis.reconciliation` (6 términos) | `?analysis=derived` | **SERVIDO** |
| 24 | Historial de aportes | `analysis.contributionHistory{rows, totalRows}` | `?analysis=full` | **SERVIDO** |
| 25 | Partición del resultado realizado | `analysis.byAccountType{investment, other}` | `?analysis=derived` | **SERVIDO** |
| 26 | Split categorizado / sin categorizar | `analysis.categorization` | `?analysis=derived` | **SERVIDO** |
| 27 | Dos piernas de deuda en el tiempo | `analysis.legsOverTime` | `?analysis=full` | **SERVIDO** |
| 28 | Sparkline de la tarjeta de resultado | — | — | **FALTA** — no hay `trend` en esa tarjeta |
| 29 | Línea de deuda en el tiempo | — | — | **NO EXISTE POR DECISIÓN** — se dibuja la fila 27 |
| 30 | Línea de cartera en el tiempo | — | — | **NO EXISTE** — inversión no tiene serie a ninguna profundidad |
| 31 | Selector de mes con etiqueta condicional | `window{periodStart, periodEnd}` de cada sección | `GET /` · nivel 1 | **SERVIDO — la etiqueta es trabajo de frontend** |
| 32 | Estados de fetch: skeleton, error, vacío | `meta.notices` + semántica de ausente/`null`/`0` | todos | **SERVIDO — la regla la aplica el frontend** |

Cuatro filas de 32 no están servidas y **ninguna de las cuatro es un defecto**:
tres son decisiones registradas en la especificación y la cuarta tiene remedio
con los campos que ya existen. Están desarmadas en §4.

---

## 2. Estado de las fases del plan, medido en el código

Las fases son las del plan de recuperación. El estado se midió en el código, no
se leyó del plan.

| fase | qué es | estado | lo pendiente |
|---|---|---|---|
| **P0** | congelar el contrato semántico | **HECHA**, sin código | — |
| **P1a** | reanclar las cuatro lecturas de saldo | **HECHA**, commit `2f8cec3d` | — |
| **P1b** | que banco e inversión obedezcan el mes de referencia | **HECHA**, commits `4f9be6a0` y `229286df` | — |
| **P2** | reapuntar Pocket al modelo de plan | **HECHA**, commits `f4b999d9` y `f0388039` | — |
| **P3** | completar y corregir los indicadores de nivel 1 | **HECHA en el código** | el monto sin categorizar se queda en nivel 2 por orden de Carlos: esa cifra debería ser cero |
| **P4** | el contrato de la API | **HECHA**, sin comitear | 69 tests de contrato pasan; el bloque no está comiteado |
| **P5** | frontend | **NO EMPEZADA** | ningún componente importa ninguna ruta de Overview; este documento es su insumo |
| **P6** | nivel 2 | **HECHA en el backend**, sin comitear | 16 archivos modificados y 10 sin seguimiento; comitear es decisión de Carlos |

La condición de salida de P5 es la única que importa para la pantalla: **que la
pantalla viva no tenga ninguna dependencia del endpoint de saldos por tipo para
ninguna cifra de Overview.** Hoy esa pantalla hace cinco llamadas para construir
tres cifras.

Un arreglo de una línea, independiente de todo lo demás y desplegable solo: la
pantalla viva prueba el total de ingreso para decidir si el total de **gasto** es
un número, así que un gasto roto se imprime como real y un gasto válido se borra
cuando el ingreso se rompe.

---

## 3. Los tres endpoints

Los tres cuelgan de `/api/fintrack/overview`, detrás de la verificación de token
y del limitador global declarados en la app, así que ninguna ruta los repite.

| endpoint | query que acepta | qué responde | pantalla |
|---|---|---|---|
| `GET /` | `month` | la página entera en una respuesta | la página de Overview |
| `GET /:domain` | `month`, `page`, `pageSize`, `analysis` | un dominio en profundidad, con su propio listado paginado | el detalle por dominio |
| `GET /activity` | `from`, `to`, `page`, `pageSize` | movimientos sobre un rango que elige el lector | la pantalla de actividad |

Tres cosas de esto condicionan el frontend:

- **La página es una sola petición, no una por widget.** Seis tarjetas, el héroe,
  el snapshot, las metas, el teaser y los dos gráficos llegan juntos. Un
  componente que busca su propia cifra está buscando una cifra que la página ya
  tiene.
- **`/activity` es un segmento literal declarado antes de `/:domain`** y el orden
  lleva comportamiento. No es un séptimo dominio y toma un rango de fechas, no un
  mes.
- **`analysis` es opt-in y pertenece sólo al endpoint por dominio.** Ausente
  significa que la respuesta no tiene la clave `analysis` en absoluto y es
  idéntica a la respuesta de nivel 1. El endpoint de página rechaza el parámetro.

### Las dos profundidades y lo que cuesta cada una

| profundidad | qué agrega | qué cuesta |
|---|---|---|
| ausente | nada | la respuesta de nivel 1 |
| `derived` | todo lo que ya se buscó, reformado — la serie de trece meses, el split de gasto, la partición del resultado, la conciliación de inversión, la descomposición de pockets | ninguna sentencia extra |
| `full` | ingreso por fuente, el historial de aportes y la distribución por cuenta de inversión, el ranking de contrapartes y las dos piernas de deuda mes a mes | una sentencia nueva por dominio |

Una pantalla que sólo dibuja una línea larga pide `derived`. Sólo una que dibuja
un desglose ranqueado necesita `full`.

---

## 4. Pareto, gráficas y donas — la respuesta directa

### 4.1 Pareto — servido completo, y en nivel 1

`charts.expenseCategories` ya es la serie ranqueada y acumulada. Cada fila es un
estado de categoría — `categoryName`, `currency`, `accountCount`,
`budgetAmount`, `actualSpent`, `remainingBudget`, `executionPercentage`,
`isOverBudget` — más los tres campos que el Pareto necesita:

- `rank` — base 1, gasto descendente, el nombre de la categoría rompe el empate
- `cumulativeActual` — el acumulado, redondeado con la misma regla que las filas
  que tiene debajo, así que el último valor iguala la suma que el usuario ve
- `cumulativePercentage` — una **razón 0-1 con cuatro decimales**, y `0` cuando no
  se gastó nada

El frontend dibuja las barras con `actualSpent`, la línea con
`cumulativePercentage`, y **no ordena nada**. El orden es del servidor;
reordenar en el cliente es como las barras y la línea acumulada dejan de estar de
acuerdo.

Una categoría de moneda mezclada trae `actualSpent: null`, se ranquea al final y
aporta 0 al acumulado. **La fila no se descarta** — descartarla rompería la
reconciliación del Pareto con el total de la tarjeta de gasto. Se renderiza como
guion, con el aviso como explicación.

**Esto no necesita el parámetro `analysis`.** Está en el payload de la página.

### 4.2 Gráficas de línea — seis puntos en la página, trece en el análisis

La serie de seis puntos de la tarjeta es la **cola** de la de trece del análisis,
no una segunda búsqueda, así que las dos no pueden reportar valores distintos
para un mes que ambas contienen.

| dominio | `trend` de 6 puntos | `series` de 13 puntos en el análisis |
|---|---|---|
| income | sí | sí |
| expense | sí | sí |
| pocket | sí | sí |
| pnl (resultado realizado) | **no** | sí |
| debt | **no** — la bandera `publishesTrend: false` se la niega | **no** — trae `legsOverTime` |
| investment | **no** | **no** |

La negativa de deuda es una decisión, no una omisión: una posición neta de deuda
que no se movió es exactamente lo que esconde que las dos piernas se duplicaron,
que es la lectura que el nivel 2 existe para exponer. Así que la deuda se dibuja
por contraparte y por pierna, nunca como una línea.

Un punto de serie es `{ month: 'YYYY-MM', value }`. Una serie más corta que el
corte se sirve entera y **nunca se rellena**: un dueño con tres meses de historia
tiene tres puntos, y rellenar dibujaría tres meses en los que no pasó nada.

`charts.trend` trae **sólo** los tres dominios con serie. Los otros tres **no
tienen la clave**, no un arreglo vacío — ausente dice que el dominio no tiene
serie, vacío diría que la tiene y está en blanco. El componente de gráfico
ramifica sobre la presencia de la clave.

### 4.3 Donas — cuatro distribuciones ranqueadas, todas con su porción

| dona | campo | profundidad | campo de etiqueta |
|---|---|---|---|
| ingreso por fuente | `bySource` + `concentration` | `full` | `accountName`, `null` cuando el ingreso no está atribuido |
| inversión por cuenta | `balanceByAccount` | `full` | `accountName` |
| deuda por contraparte | `byCounterparty` | `full` | `accountName`, más `direction` que nombra hacia dónde corre el dinero |
| pocket por pocket | `progressByPocket` | `derived` | `name` |

Las tres primeras salen del constructor de distribución compartido y traen `rank`
y `share`. **`share` es una razón 0-1 con cuatro decimales, no un porcentaje**, y
es `null` — nunca 0 — cuando el total es cero: una porción de nada es una
división sin respuesta, y 0 se leería como "esta porción no aportó nada" para una
porción que es el todo de un conjunto vacío. El frontend multiplica y formatea.

`progressByPocket` es distinto en especie: son las filas del tablero de Pocket
republicadas verbatim — `pocketId`, `name`, `note`, `target`, `allocated`,
`remaining`, `progress`, `desiredDate`, `planStart`, `daysRemaining`,
`requiredMonthly`, `movedInMonth`, `committedInMonth`, `releasedInMonth`,
`funded`, `overdue`, `uncovered`. Trae `progress` como **tasa sobre 100**, no
como razón 0-1, y **sin `rank`**. Un componente que la trate como las otras tres
imprime cada pocket a 100 veces su tamaño.

La dona de gasto son las filas del Pareto leídas como partes de un todo, así que
no necesita una quinta sentencia.

### 4.4 Los cuatro huecos, dichos como huecos

| hueco | consecuencia en pantalla | el remedio que ya existe |
|---|---|---|
| la tarjeta de resultado realizado no tiene `trend` de 6 puntos | esa tarjeta no puede dibujar sparkline desde el payload de la página | pedir `analysis=derived` al endpoint por dominio y cortar los últimos seis puntos, o dejar la tarjeta sólo con cifras |
| deuda no tiene serie a ninguna profundidad | no hay línea de "deuda en el tiempo" de un solo campo | dibujar `legsOverTime` como dos líneas positivas en `full` |
| inversión no tiene serie a ninguna profundidad | no hay línea de cartera en el tiempo | la conciliación, `balanceByAccount` y `contributionHistory` son lo que esa tarjeta tiene; una serie temporal necesita una sentencia nueva y no está en este plan |
| la tarjeta de inversión no comparte la forma base | un componente de tarjeta compartido rompe **sólo** en esa tarjeta, en cuatro campos a la vez | necesita su propio componente, no el compartido con excepciones; el período sale del héroe o de `all` |

**El cuarto es el que falla peor y hay que decirlo con precisión.** La tarjeta de
inversión publica diez claves y **ninguna** de `totalAmount`,
`transactionCount`, `delta` ni `window`. Lo único que comparte con las otras
cinco es `domain`, `currency` y `meta`. Lo que publica en su lugar es
`accountCount`, `capitalContributed`, `ledgerBalance`, `realizedPnl`,
`closureAdjustment`, `concentration` y `daysSinceLastContribution`.

El motivo está escrito en el propio constructor: sus cifras **no son** un total,
un conteo y un delta — son posiciones a hoy, no un flujo de un período. Por eso
tampoco lleva ventana: no hay período que etiquetar.

Dos consecuencias que un componente compartido no perdona:

- Cinco tarjetas renderizan y la sexta imprime `undefined` en cuatro lugares o
  revienta, que es la forma de falla que sobrevive a una revisión.
- `all.transactionCountAll` suma **cinco** conteos, no seis: ingreso, gasto,
  deuda, pocket y resultado realizado. Inversión no aporta ninguno, porque no
  tiene. Un lector que espere seis va a buscar el que falta.

El esquema de nivel 1 ya anticipó parte de esto —dice que inversión es la
excepción de forma y que no lleva total, delta ni ventana— y **acertó en los
tres**. Lo que no dice es que tampoco lleva conteo.

---

## 5. La página, bloque por bloque

### 5.1 El héroe

| se renderiza | campo | semántica de nulo |
|---|---|---|
| lo que se posee | `netWorth` | nunca nulo |
| lo que se posee y es líquido | `liquidNetWorth` | `null` cuando la pierna por pagar no llegó; un aviso lo dice |
| cuánto de eso es efectivo | `cashPosition` | nunca nulo — cuentas de banco **y** de efectivo, una cifra |
| cuánto de ese efectivo está sin prometer | `freeCash` | nunca nulo y nunca negativo |
| si el mes avanzó o retrocedió | `netMonthlyFlow` | nunca nulo; negativo es una respuesta real |
| ese mismo movimiento como porción del ingreso | `savingsRate` | `null` cuando el ingreso no puede ser denominador, **nunca 0** |

`netWorth` tiene tres términos — banco, inversión, deuda — y deliberadamente no
cuatro. Un pocket es un plan, así que el total comprometido ya está dentro del
saldo bancario y sumarlo contaba el mismo dinero dos veces. La pantalla viva
nunca lo sumó tampoco, así que la jerarquía que publica el héroe es la que la
pantalla adopta entera, no una cuarta cifra atornillada a la tríada existente.

`meta.notices` es siempre un arreglo, nunca ausente y nunca una cadena suelta,
así que un componente que lo recorre no necesita chequeo de nulo.

### 5.2 La tarjeta consolidada

`all` trae `domain: 'all'`, `netWorth`, `totalIncomePeriod`,
`totalExpensePeriod`, `netDebtPosition`, `totalPocketBalance`,
`transactionCountAll`, `currency`, `window` y `meta`. Su patrimonio es el valor
del propio héroe pasado tal cual, no una segunda suma de los mismos tres números.

### 5.3 Las seis tarjetas de dominio

`domainCards` es un objeto llaveado por dominio — `income`, `expense`,
`investment`, `debt`, `pocket`, `pnl` —, no un arreglo. Cinco de las seis
comparten la forma base: `domain`, `totalAmount`, `transactionCount`, `delta`,
luego los campos propios del dominio, luego `currency`, `window`,
`meta{notices, provenance}`.

`delta` es `null` cuando no existe un período anterior completo — ese es el caso
de skeleton o guion, no un cero.

La tarjeta de inversión es la excepción y su forma está en la fila 9 de la tabla
maestra y en el cuarto hueco de §4.4.

### 5.4 El snapshot mensual

`monthlySnapshot` es un arreglo de exactamente tres entradas, para `income`,
`expense` y `pocket` — los únicos tres dominios a los que la especificación le da
el widget. Cada entrada trae `domain`, `domainMonthlyActual`,
`activeMonthAverage3m`, `activeMonthAverage12m`, `varianceVsAverage`, `currency`,
`meta`.

La varianza se mide contra el promedio de **doce** meses, no contra el de tres, y
ambos son promedios sobre meses **activos**. Un dueño sin historia trae `null` en
los dos promedios y en la varianza — tres guiones, no tres ceros.

### 5.5 Metas financieras

`goalsTotalBalance`, `goalsTotalTarget`, `goalsTotalRemaining`, `currency`,
`meta`. Objetivo y restante son `null` juntos cuando ningún pocket tiene
objetivo, y el aviso dice cuál de los dos casos es: ningún objetivo, o sólo
algunos pockets con uno. El progreso contra un objetivo nulo se renderiza como
guion.

### 5.6 Actividad reciente

`recentActivity.transactions` — un arreglo de filas y nada más. Sin moneda propia,
porque cada fila trae la suya. Cada fila es la forma que comparten los seis
listados de transacciones del módulo, veinticuatro columnas nombradas incluida
`transaction_local_date`, que es la fecha estampada en la zona del dueño y la que
el listado ordena y agrupa.

---

## 6. El detalle por dominio

Toda respuesta por dominio es `card`, `transactions{rows, page, pageSize,
totalRows}`, opcionalmente `trend`, opcionalmente `analysis`.

| dominio | en `derived` | se agrega en `full` |
|---|---|---|
| income | `series` | `bySource` (ranqueado, con `share`), `concentration` |
| expense | `series`, `categorization{categorized, uncategorized}` | — |
| pnl | `series`, `byAccountType{investment, other}` | — |
| pocket | `series`, `progressByPocket`, `committedAgainstFree{bankBalance, committed, freeCash, flooredShortfall}` | — |
| investment | `reconciliation{capitalContributed, realizedPnl, closureAdjustment, ledgerBalance, difference, tolerance}` | `balanceByAccount` (ranqueado, con `share`), `contributionHistory{rows, totalRows}` |
| debt | — | `byCounterparty` (ranqueado, con `direction`), `legsOverTime` |

Dos formas que vale nombrar, porque un componente que las dibuje con la lectura
equivocada queda mal de una manera que igual parece plausible:

- **`committedAgainstFree` tiene tres términos y no suman**, a propósito. El
  efectivo libre se pisa por cuenta antes de sumar, así que el excedente de una
  cuenta no puede absorber el faltante de otra. `flooredShortfall` es exactamente
  lo que costó ese piso y es el campo que explica la brecha. Un cliente al que le
  den dos de los tres y calcule el tercero queda mal justo para el dueño que más
  necesita que esté bien.
- **`legsOverTime`** es `{ month, receivable, payable }` por mes, las dos piernas
  **positivas**, así que quien grafique las dos líneas nunca tiene que invertir
  una. Un mes sin deudores reporta 0 en ambas en vez de desaparecer — un mes
  faltante dobla la línea entre sus vecinos.

---

## 7. Reglas que el payload le impone a los componentes

No son preferencias de estilo. Cada una es una forma que el backend eligió a
propósito, y un componente que la ignora imprime un número equivocado, no algo
feo.

- **Ausente, `null` y `0` son tres afirmaciones distintas.** Ausente significa
  que la pregunta no se hizo — la profundidad no lo buscó. `null` significa que se
  hizo y no tiene respuesta. `0` significa que la respuesta es cero. Una cifra
  faltante se renderiza como skeleton o guion, nunca como `0` ni `NaN`.
- **Nunca reordenar, nunca resumar.** `rank` se asigna en el servidor con un
  desempate explícito, así que dos peticiones idénticas no pueden intercambiar dos
  porciones iguales. Toda porción se toma contra la cifra que la tarjeta publicó,
  nunca contra una segunda suma sobre las filas.
- **Toda razón es 0-1 con cuatro decimales** — `share`, `cumulativePercentage` —
  **excepto** `progress` del tablero de Pocket y `executionPercentage` del
  presupuesto, que son tasas sobre 100.
- **`window` es `{periodStart, periodEnd}` y se lee de la respuesta**, nunca se
  reconstruye del mes. El mes en curso termina en la fecha de referencia, así que
  un período rearmado en el cliente pondría dos finales distintos en una pantalla.
- **La etiqueta del mes es condicional al mes elegido.** Un mes cerrado se lee
  como el mes; el mes en curso se lee como mes a la fecha. El selector elige un
  mes entero en los dos casos — ese argumento del bosquejo es correcto, y el
  arreglo es a la etiqueta, no al control.
- **La moneda vive en la sección, no en la app.** Cada tarjeta, el héroe, el
  snapshot y las metas publican su propio `currency`. Las filas de un listado
  traen la suya individualmente.
- **`meta.notices` es la frase al lado de la cifra.** Ahí ya están escritas "no
  hay ingreso contra el que tomar una tasa", "hay más comprometido que lo que
  tienen las cuentas" y "la pierna por pagar no llegó". Una tarjeta que renderiza
  cifras y descarta avisos pierde la explicación de cada guion que muestra.

---

## 8. Qué corrige este documento de la propuesta del 2026-09-04

Esa propuesta decidió **qué debe mostrar la página** y sigue siendo la autoridad
de diseño para el layout y para el argumento de tarjeta-contra-página. Dos de sus
afirmaciones se volvieron falsas y se corrigen acá, porque la corrección es una
medición del payload de hoy:

| la propuesta dice | medido hoy |
|---|---|
| las figuras de stock del encabezado no están implementadas | `netWorth`, `liquidNetWorth`, `cashPosition` y `freeCash` los publica el constructor del héroe |
| las piernas de deuda están declaradas en el contrato y nunca emitidas | la tarjeta de deuda trae `payable`, `receivable` y `settledCount`, buscados por `getDebtDomainFields` y pasados por los `domainFields` de la tarjeta compartida |

Los tres bosquejos HTML — el esquema de nivel 1, la propuesta de distribución del
gasto y la propuesta de snapshot mensual — siguen siendo la referencia visual.
Las desviaciones entre ellos y las resoluciones congeladas ya están catalogadas
en la etapa de frontend del plan de recuperación y no se repiten acá.

Este documento no agrega ningún requerimiento al backend. Todo lo de arriba es un
campo que existe.

---

## 9. Abierto para la etapa de frontend

- **Qué tarjeta es dueña del Pareto.** Está en el payload de la página y podría
  renderizar dentro de la tarjeta de gasto, o rutear a su propia pantalla. La
  propuesta del 2026-09-04 argumentó las dos lecturas y no lo cerró.
- **Si las seis tarjetas rutean a seis pantallas o a tres.** Inversión, deuda y
  pocket ya tienen módulo propio; ingreso, gasto y resultado realizado no.
- **Los tokens de color que los tres bosquejos no tienen.** Traen valores hex
  crudos, lo que se permite en un bosquejo y no en una hoja de estilos. Quien
  construya estos bloques pide los tokens que falten en vez de arrastrar los
  literales.

Ninguno de los tres impide construir un componente; los dos primeros deciden
dónde se monta un bloque, y el tercero se acuerda después del diseño, nunca
antes.
