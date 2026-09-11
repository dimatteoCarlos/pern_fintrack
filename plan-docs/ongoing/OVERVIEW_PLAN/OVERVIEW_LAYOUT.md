# Overview — layout y contrato de render

**Documento único de presentación, escrito el 2026-09-07.** Su compañero es
`OVERVIEW_INDICATORS.md`, que dice qué se mide y por qué. Éste dice **cómo se
dibuja**: para cada bloque de la pantalla, de qué campo publicado sale, en qué
endpoint y a qué profundidad, con la forma exacta del payload.

> **Pendiente, fijado el 2026-09-09.** Este archivo pasa a inglés y absorbe
> `OVERVIEW_CHART_TECHNIQUE.md` (cómo se dibuja un gráfico) y `OVERVIEW_LEVEL3.md`
> (a qué entidad navega cada fila). Los dos siguen existiendo hasta que su
> contenido aterrice acá. Es lo último que le falta a la consolidación de la
> carpeta.

Todo está medido sobre el código de `feat/overview`. Los nombres de campo van en
inglés porque son identificadores del payload; el texto va en castellano.

---

## 1. Los tres endpoints

Los tres cuelgan de `/api/fintrack/overview`, detrás de la verificación de token
y del limitador global declarados en la app, así que ninguna ruta los repite.

| endpoint | query que acepta | qué responde | pantalla |
|---|---|---|---|
| `GET /` | `month` | la página entera en una respuesta | la página de Overview |
| `GET /:domain` | `month`, `page`, `pageSize`, `analysis` | un dominio en profundidad, con su propio listado paginado | el detalle por dominio |
| `GET /activity` | `from`, `to`, `search`, `movementType`, `page`, `pageSize` | movimientos sobre un rango que elige el lector | la pantalla de actividad |

Tres cosas de esto condicionan el frontend:

- **La página es una sola petición, no una por widget.** Seis tarjetas, el héroe,
  el snapshot, las metas, el teaser y los dos gráficos llegan juntos.
- **`/activity` es un segmento literal declarado antes de `/:domain`** y el orden
  lleva comportamiento. No es un séptimo dominio y toma un rango de fechas, no un
  mes. Sus dos cotas son opcionales y el default es **sin cota**.
- **`analysis` es opt-in y pertenece sólo al endpoint por dominio.** El endpoint
  de página **rechaza** el parámetro con 400 nombrando la clave, porque su esquema
  es estricto.

### 1.1 Los dos esquemas de query, exactos

```ts
// GET /overview — estricto. Ni page, ni pageSize, ni analysis:
// la página no lleva listado paginado, así que pedir la página 2 de ella
// responde 400 nombrando la clave.
type GetOverviewPageParams = {
 month?: string; // YYYY-MM, sólo pasado o el mes en curso
};

// GET /overview/:domain — estricto.
type GetOverviewDomainParams = {
 domain: 'income' | 'expense' | 'investment' | 'debt' | 'pocket' | 'pnl';
 month?: string;
 page?: number;     // default 1
 pageSize?: number; // default del servidor, con un tope
 // Opt-in y el único parámetro sin default. Ausente significa que la
 // respuesta NO TIENE la clave `analysis` en absoluto y es idéntica a la
 // respuesta de nivel 1 previa a que el parámetro existiera.
 //
 // Un valor no reconocido responde 400 nombrando la clave, nunca se lee
 // como "sin análisis": pedir una profundidad que el servidor no tiene es un
 // error, y servir en silencio un payload más pobre parecería un resultado
 // vacío.
 analysis?: 'derived' | 'full';
};

// GET /overview/activity — estricto.
type GetOverviewActivityParams = {
 from?: string;     // sin cota por defecto
 to?: string;       // sin cota por defecto
 page?: number;
 pageSize?: number;
};
```

`page` y `pageSize` llevan default en vez de ser opcionales: la respuesta siempre
informa la ventana que sirvió, así que un cliente que no mandó ninguno igual
recibe la página que está mirando en vez de tener que asumirla.

### 1.2 Las dos profundidades y lo que cuesta cada una

| profundidad | qué agrega | qué cuesta |
|---|---|---|
| ausente | nada | la respuesta de nivel 1 |
| `derived` | todo lo que ya se buscó, reformado — la serie de trece meses, el split de gasto, la partición del resultado, la conciliación de inversión, el progreso por pocket | **ninguna sentencia extra** |
| `full` | ingreso por fuente, el historial de aportes y la distribución por cuenta de inversión, el ranking de contrapartes, las dos piernas mes a mes, y la descomposición de comprometido contra libre | una sentencia nueva por dominio |

**Una pantalla que sólo dibuja una línea larga pide `derived`. Sólo una que dibuja
un desglose ranqueado necesita `full`.**

### 1.3 El envelope, igual para los tres

```ts
type ApiEnvelope<T> = { status: number; message: string; data: T };

type ApiErrorEnvelope = {
 status: number;
 message: string;
 errors?: { field: string; message: string; code: string }[]; // sólo en errores de validación
};

// Presente en toda sección. notices SIEMPRE es un arreglo, nunca ausente y
// nunca una cadena suelta, así que un componente que lo recorre no necesita
// chequeo de nulo. provenance es null hoy, siempre.
type SectionMeta = {
 notices: string[];
 provenance: { grade: 'live' | 'cached' | 'synthetic'; source: string; fetchedAt: string | null } | null;
};

// La ventana se LEE de la respuesta, nunca se rearma del mes. El servidor
// nombra el mes que efectivamente sirvió, porque una petición que no manda mes
// se responde con el mes en curso del calendario del dueño y sólo la respuesta
// sabe cuál es.
type PeriodWindow = {
 referenceMonth: string;  // YYYY-MM-01 — el mes servido, presente aunque la petición no lo nombre
 periodStart: string;     // YYYY-MM-DD
 periodEnd: string;       // YYYY-MM-DD — en el mes en curso es HOY, no el fin de mes
 isCurrentMonth: boolean; // lo que decide la etiqueta condicional del selector
};
```

---

## 2. La página de nivel 1, bloque por bloque

Un solo `GET /` devuelve todo lo de esta sección.

```
┌──────────────────────────────────────────────────────────────────────┐
│  SELECTOR DE MES        [ ‹ ]  agosto 2026  [ › ]                    │
├──────────────────────────────────────────────────────────────────────┤
│  HÉROE                                                                │
│    lo que se posee · cuánto es líquido · cuánto es efectivo ·        │
│    cuánto de ese efectivo está sin prometer                           │
│    ───────────────────────────────────────────────                    │
│    flujo del mes  ·  tasa de ahorro                                   │
├──────────────────────────────────────────────────────────────────────┤
│  TARJETA CONSOLIDADA                                                  │
├───────────────────────────────┬──────────────────────────────────────┤
│  ingreso   │  gasto           │  inversión  (FORMA PROPIA)           │
│  deuda     │  pocket          │  resultado realizado                 │
├───────────────────────────────┴──────────────────────────────────────┤
│  DISTRIBUCIÓN DEL GASTO — barras + curva acumulada (Pareto)          │
├──────────────────────────────────────────────────────────────────────┤
│  SNAPSHOT MENSUAL — ingreso · gasto · pocket                          │
├───────────────────────────────┬──────────────────────────────────────┤
│  METAS FINANCIERAS            │  ACTIVIDAD RECIENTE (≤5)             │
└───────────────────────────────┴──────────────────────────────────────┘
```

### 2.1 El selector de mes

Sale de `window` de cualquier sección, y **el campo que lee es
`referenceMonth`, no el mes que el componente envió**: la petición puede no
nombrar ninguno, y entonces sólo la respuesta sabe cuál se sirvió. **La etiqueta
es trabajo de frontend y es condicional**, y lo que la decide es
`isCurrentMonth`: en falso se lee `agosto 2026`, en verdadero se lee como **mes
a la fecha**, terminando en `periodEnd` — que en el mes en curso es hoy y no el
fin de mes, así que un componente que imprimiera el fin de mes declararía un
período distinto de aquel al que se cortaron las cifras. El control elige un mes
entero en los dos casos — el arreglo es a la etiqueta, no al control.

El mes es opcional, sólo pasado o el mes en curso, y por defecto es el mes en
curso en el calendario del dueño de la cuenta.

### 2.2 El héroe — `hero`

```ts
type HeroSection = {
 netWorth: number;              // nunca null; banco + inversión + deuda. TRES términos, no cuatro
 liquidNetWorth: number | null; // null + aviso sólo si la pierna por pagar no llegó
 cashPosition: number;          // nunca null; banco Y efectivo, una cifra
 freeCash: number;              // nunca null y nunca negativo
 netMonthlyFlow: number;        // nunca null; negativo es una respuesta real
 savingsRate: number | null;    // null + aviso cuando el ingreso no puede ser denominador, NUNCA 0
 currency: string;
 meta: SectionMeta;
};
```

| se renderiza | campo | cómo se lee un vacío |
|---|---|---|
| lo que se posee | `netWorth` | nunca vacío |
| lo que se posee y es líquido | `liquidNetWorth` | guion + el aviso que lo explica |
| cuánto de eso es efectivo | `cashPosition` | nunca vacío |
| cuánto de ese efectivo está sin prometer | `freeCash` | nunca vacío |
| si el mes avanzó o retrocedió | `netMonthlyFlow` | nunca vacío; negativo se pinta como negativo |
| ese movimiento como porción del ingreso | `savingsRate` | guion, **jamás 0%** |

**La jerarquía nueva se adopta entera.** No es la tríada vieja —patrimonio,
efectivo, flujo— con una cuarta cifra atornillada: son cuatro posiciones que
responden una pregunta que se estrecha (*qué tengo · cuánto de eso es líquido ·
cuánto es efectivo · cuánto de ese efectivo está libre*) y dos flujos debajo,
separados por una regla, porque movimiento y posición son dos clases y la
pantalla tiene que decirlo.

### 2.3 La tarjeta consolidada — `all`

```ts
type AllCard = {
 domain: 'all';
 netWorth: number;            // el valor del propio héroe, pasado tal cual
 totalIncomePeriod: number;
 totalExpensePeriod: number;
 netDebtPosition: number;
 totalPocketBalance: number;
 transactionCountAll: number; // suma CINCO conteos, no seis
 currency: string;
 window: PeriodWindow;
 meta: SectionMeta;
};
```

### 2.4 Las seis tarjetas — `domainCards`

`domainCards` es un **objeto llaveado por dominio**, no un arreglo:
`income`, `expense`, `investment`, `debt`, `pocket`, `pnl`.

**Cinco de las seis comparten la forma base:**

```ts
type DomainCardBase = {
 domain: string;
 totalAmount: number;      // nunca null — 0 es actividad real en cero
 transactionCount: number;
 delta: number | null;     // null + aviso cuando no hay período anterior completo
 // ...aquí van los campos propios del dominio...
 currency: string;
 window: PeriodWindow;
 meta: SectionMeta;
};
```

| tarjeta | campos propios además de la base |
|---|---|
| **income** | ninguno |
| **expense** | `budgetAmount`, `categorizedExpense`, `budgetVariance` (los tres `number \| null`), `hasUncategorizedExpense: boolean` |
| **debt** | `payable: number`, `receivable: number` (**ambos ≥ 0**), `settledCount: number` |
| **pocket** | `target`, `remaining`, `progress` (`number \| null`), `fundedCount`, `overdueCount`, `uncoveredCount` |
| **pnl** | `realizedFromInvestment: number` y `realizedFromBank: number` — **dos líneas subordinadas bajo el total, nunca cifras del mismo peso**. Las dos están medidas por su propio `FILTER` (2026-09-09): la de banco no es el total menos la de inversión, porque ese remanente incluye deudores y bolsillos. No están obligadas a sumar el total y no se dibuja un total debajo de ellas; una pata en cero se omite en vez de imprimirse |

**`delta` es `null` cuando no existe un período anterior completo** — ése es el
caso de skeleton o guion, no un cero.

**La línea de estado de pockets es una línea, no tres cifras:**
`5 financiados · 2 vencidos · 1 sin cobertura`.

**`progress` de pocket es una tasa sobre 100, no una razón 0-1.**

#### La sexta tarjeta — inversión, forma propia

```ts
type InvestmentCard = {
 domain: 'investment';
 accountCount: number;
 capitalContributed: number;
 ledgerBalance: number;
 realizedPnl: number;
 closureAdjustment: number;
 concentration: number | null;
 daysSinceLastContribution: number | null;
 currency: string;
 meta: SectionMeta;
};
```

**Diez claves, y NINGUNA de `totalAmount`, `transactionCount`, `delta` ni
`window`.** Lo único que comparte con las otras cinco es `domain`, `currency` y
`meta`.

El motivo está escrito en el propio constructor: sus cifras **no son** un total,
un conteo y un delta — son posiciones a hoy, no un flujo de un período. Por eso
tampoco lleva ventana: no hay período que etiquetar.

**Necesita su propio componente, no el compartido con excepciones.** Un
componente compartido rompe **sólo** en esa tarjeta y **en cuatro campos a la
vez**: cinco tarjetas renderizan y la sexta imprime `undefined` en cuatro lugares
o revienta, que es la forma de falla que sobrevive a una revisión. Si necesita
mostrar un período, lo toma del héroe o de la tarjeta consolidada.

### 2.5 El snapshot mensual — `monthlySnapshot`

Un arreglo de **exactamente tres** entradas: `income`, `expense` y `pocket`.

```ts
type MonthlySnapshotEntry = {
 domain: 'income' | 'expense' | 'pocket';
 domainMonthlyActual: number;
 activeMonthAverage3m: number | null;
 activeMonthAverage12m: number | null;
 activeMonths3m: number;             // el denominador del promedio de tres
 activeMonths12m: number;            // el denominador del promedio de doce
 varianceVsAverage: number | null;   // contra el de DOCE, no contra el de tres
 yearToDate: number;                 // ano calendario corrido, todos los meses
 currency: string;
 meta: SectionMeta;
};
```

Un dueño sin historia trae `null` en los dos promedios y en la varianza: **tres
guiones, no tres ceros.**

### 2.6 Metas financieras — `financialGoals`

```ts
type FinancialGoals = {
 goalsTotalBalance: number;
 goalsTotalTarget: number | null;
 goalsTotalRemaining: number | null;
 currency: string;
 meta: SectionMeta;
};
```

Objetivo y restante son `null` **juntos** cuando ningún pocket tiene objetivo, y
el aviso dice cuál de los dos casos es: ningún objetivo, o sólo algunos pockets
con uno. El progreso contra un objetivo nulo se renderiza como guion.

### 2.7 Actividad reciente — `recentActivity`

`recentActivity.transactions` — un arreglo de filas y nada más. **Sin moneda
propia**, porque cada fila trae la suya.

Cada fila es la forma que comparten los seis listados de transacciones del
módulo, veinticuatro columnas nombradas incluida `transaction_local_date`, que es
la fecha estampada en la zona del dueño y **la que el listado ordena y agrupa**.

No se acota al mes pedido: responde "qué pasó por último", no "qué pasó en el mes
que estoy estudiando".

### 2.8 Los dos gráficos de la página — `charts`

```ts
type Charts = {
 trend: {
  income?: MonthlyTrendPoint[];
  expense?: MonthlyTrendPoint[];
  pocket?: MonthlyTrendPoint[];
 };
 expenseCategories: ExpenseCategoryStatus[];
};

type MonthlyTrendPoint = { month: string; value: number }; // month es 'YYYY-MM'
```

`charts.trend` trae **sólo** los tres dominios con serie. Los otros tres **no
tienen la clave**, no un arreglo vacío — ausente dice que el dominio no tiene
serie, vacío diría que la tiene y está en blanco. **El componente de gráfico
ramifica sobre la presencia de la clave.**

---

## 3. Las gráficas — Pareto, líneas y donas

### 3.1 El Pareto de gasto — servido completo, y en nivel 1

`charts.expenseCategories` **ya es** la serie ranqueada y acumulada. No necesita
el parámetro de profundidad ni una segunda petición.

```ts
type ExpenseCategoryStatus = {
 // los ocho que vienen del módulo de presupuesto, tal cual
 categoryName: string;
 currency: string | null;           // null + aviso si la categoría mezcla monedas
 accountCount: number;
 budgetAmount: number | null;       // 0 si nunca se presupuestó
 actualSpent: number | null;
 remainingBudget: number | null;
 executionPercentage: number | null; // TASA SOBRE 100. null cuando el plan es 0
 isOverBudget: boolean | null;

 // los tres que el Pareto necesita
 rank: number;                 // base 1, gasto descendente, el nombre rompe el empate
 cumulativeActual: number;     // el acumulado, con la misma regla de redondeo que las filas
 cumulativePercentage: number; // RAZÓN 0-1 con cuatro decimales

 // el plan dibujado junto al gasto
 cumulativeBudget: number;
 cumulativeBudgetPercentage: number; // RAZÓN 0-1
 hasSkippedBudget: boolean;          // true si alguna fila anterior no tenía plan
};
```

**Cómo se dibuja:**

- Barras con `actualSpent`. **Dos barras por categoría**, no una: la del gasto y
  la del plan (`budgetAmount`) al lado, con el mismo origen y la misma escala, de
  modo que pasarse del plan se lea como una diferencia de longitud.
- Curva acumulada con `cumulativePercentage`; la segunda curva con
  `cumulativeBudgetPercentage`. **Las dos curvas se distinguen por color y por
  textura a la vez**, no sólo por el patrón de trazo.
- **El frontend no ordena nada.** El orden es del servidor. Reordenar en el
  cliente es exactamente cómo las barras y la línea acumulada dejan de estar de
  acuerdo.
- **La regla que ordena a las dos curvas es el gasto, y el bloque tiene que
  decirlo.** Una categoría pequeña en gasto y grande en plan hace subir la curva
  del plan justo donde la del gasto ya está plana. **Reordenar para que la curva
  del plan parezca un Pareto queda prohibido**: serían dos ordenaciones de las
  mismas filas en una pantalla.
- **Una fila sin plan no entra a la acumulación** y arrastra la cifra corrida sin
  cambio. Su último punto significa "el plan de las categorías que tienen uno", y
  `hasSkippedBudget` dice si eso pasó.
- Una categoría de moneda mezclada trae `actualSpent: null`, se ranquea al final
  y aporta 0 al acumulado. **La fila no se descarta** — descartarla rompería la
  reconciliación del Pareto con el total de la tarjeta de gasto. Se renderiza como
  guion, con el aviso como explicación.
- Incluye categorías borradas con gasto real en el mes, para que la suma de
  `actualSpent` reconcilie exacto con el total de la tarjeta.

**Servidos desde el 2026-09-08.** `cumulativeBudget`,
`cumulativeBudgetPercentage` y `hasSkippedBudget` los construye
`makeCategoryBreakdown.js` en la misma pasada que los dos del gasto, sobre la
misma ordenación. El bloque de dos curvas ya se puede construir.

**Una precisión sobre la bandera, porque el contrato la dice más suelta.**
`hasSkippedBudget` es verdadera **incluyendo la fila que se salta**, no sólo a
partir de la siguiente. La bandera existe para decir si la cifra corrida impresa
a su lado cubre todas las filas hasta ese punto, así que la fila que la rompe es
la que tiene que levantarla.

**Una fila con plan de 0 no se salta.** `budgetAmount` es nulo únicamente cuando
la categoría mezcla monedas; un plan de cero es una decisión y entra a la
acumulación aportando 0.

### 3.2 Líneas de tendencia — seis puntos en la página, trece en el análisis

La serie de seis puntos de la tarjeta es la **cola** de la de trece del análisis,
no una segunda búsqueda, así que las dos **no pueden reportar valores distintos
para un mes que ambas contienen**.

| dominio | `trend` de 6 puntos (página) | `analysis.series` de 13 puntos |
|---|---|---|
| income | sí | sí |
| expense | sí | sí |
| pocket | sí | sí |
| pnl | **no** | sí |
| debt | **no** — la bandera `publishesTrend: false` se la niega | **no** — trae `legsOverTime` |
| investment | **no** | **no** |

**La serie de pocket es de POSICIONES, no de flujos**: el saldo comprometido a
cada cierre de mes. El último punto es exactamente la cifra de la tarjeta. Una
serie de flujo pondría "80 comprometido" debajo de una tarjeta que dice "1.200
comprometido en total": dos números en una tarjeta sin relación entre sí.

**Una serie más corta que el corte se sirve entera y nunca se rellena**: un dueño
con tres meses de historia tiene tres puntos, y rellenar dibujaría tres meses en
los que no pasó nada.

Para ingreso y gasto un mes sin actividad **sí** publica `0`, porque para un
flujo el cero es real. Para pocket, que es un stock, el equivalente es arrastrar
el saldo y no dejar huecos.

### 3.3 Donas — cuatro distribuciones ranqueadas

| dona | campo | profundidad | etiqueta de cada parte |
|---|---|---|---|
| ingreso por fuente | `bySource` + `concentration` | `full` | `accountName`, `null` cuando el ingreso no está atribuido |
| inversión por cuenta | `balanceByAccount` | `full` | `accountName` |
| deuda por contraparte | `byCounterparty` | `full` | `accountName`, más `direction` |
| pocket por pocket | `progressByPocket` | `derived` | `name` |

**Las tres primeras salen del constructor de distribución compartido:**

```ts
type DistributionPart = {
 accountId: number | null;
 accountName: string | null;
 label: string;          // el desempate del orden
 amount: number;
 rank: number;           // base 1
 share: number | null;   // RAZÓN 0-1 con cuatro decimales
};
```

**`share` es una razón 0-1 con cuatro decimales, no un porcentaje.** Cuatro y no
dos: con dos decimales toda fuente que aporta menos de medio por ciento redondea
a `0.00` y se lee como una parte que no aportó nada, que es lo único que una
distribución no puede decir de una fila que está publicando. El frontend
multiplica y formatea.

**`share` es `null` — nunca 0 — cuando el total es cero:** una porción de nada es
una división sin respuesta, y 0 se leería como "esta porción no aportó nada" para
una porción que es el todo de un conjunto vacío.

**Excepción 1 — deuda por contraparte no usa ese constructor.** Trae `rank` pero
**no trae `share`**, porque se ordena por **magnitud absoluta** del saldo: una
deuda por cobrar de 500 y una por pagar de 500 pesan igual en el ranking. Su
forma es `{accountId, accountName, balance, direction, rank}`, y `direction`
nombra hacia dónde corre el dinero.

**Excepción 2 — el progreso por pocket es distinto en especie.** Son las filas del
tablero de Pocket republicadas verbatim: `pocketId`, `name`, `note`, `target`,
`allocated`, `remaining`, `progress`, `desiredDate`, `planStart`,
`daysRemaining`, `requiredMonthly`, `movedInMonth`, `committedInMonth`,
`releasedInMonth`, `funded`, `overdue`, y la clasificación de estado. Trae
`progress` como **tasa sobre 100** y **sin `rank`**. Un componente que la trate
como a las otras tres imprime cada pocket a **cien veces** su tamaño.

**La dona de gasto son las filas del Pareto leídas como partes de un todo**, así
que no necesita una quinta sentencia.

---

## 4. El detalle por dominio — nivel 2

Toda respuesta por dominio tiene esta forma:

```ts
type GetOverviewDomainData = {
 card: DomainCardBase | InvestmentCard;
 transactions: {
  rows: MovementTransactionRow[];
  page: number;
  pageSize: number;
  totalRows: number;
 };
 trend?: MonthlyTrendPoint[];            // sólo income, expense, pocket
 categories?: ExpenseCategoryStatus[];   // sólo expense
 analysis?: DomainAnalysis;              // AUSENTE si no se pidió profundidad
};

// Los tres campos que toda sección de análisis comparte.
type AnalysisBase = {
 domain: string;
 level: 'derived' | 'full';
 meta: { notices: string[] };
};
```

### 4.1 Qué trae cada dominio, por profundidad

| dominio | en `derived` | se agrega en `full` |
|---|---|---|
| **income** | `series` (13 pts) | `bySource` (ranqueado, con `share`), `concentration` |
| **expense** | `series`, `categorization` | — |
| **pnl** | `series`, `byAccountType` | — |
| **pocket** | `series`, `progressByPocket` | `committedAgainstFree` |
| **investment** | `reconciliation` | `balanceByAccount` (ranqueado, con `share`), `contributionHistory` |
| **debt** | — *(sólo el envoltorio con su aviso)* | `byCounterparty`, `legsOverTime` |

**Deuda en `derived` publica sólo `domain`, `level` y un aviso que dice que este
análisis necesita la profundidad completa.** No es un error: es la respuesta
honesta de un dominio cuyos dos análisis son los dos caros.

### 4.2 Las formas de cada análisis

```ts
// income
type IncomeAnalysis = AnalysisBase & {
 series: MonthlyTrendPoint[];       // 13 puntos
 bySource?: DistributionPart[];     // full
 concentration?: number | null;     // full — la porción de la fuente mayor
};

// expense
type ExpenseAnalysis = AnalysisBase & {
 series: MonthlyTrendPoint[];
 categorization?: { categorized: number; uncategorized: number };
};

// pnl — byAccountType SIEMPRE viene cuando se pidió análisis
type PnlAnalysis = AnalysisBase & {
 series: MonthlyTrendPoint[];
 byAccountType: { investment: number; other: number };
};

// pocket
type PocketAnalysis = AnalysisBase & {
 series: MonthlyTrendPoint[];       // POSICIONES a cada cierre de mes
 progressByPocket?: PocketBoardRow[];
 committedAgainstFree?: {           // full
  bankBalance: number;
  committed: number;
  freeCash: number;
  flooredShortfall: number;
 };
};

// investment — reconciliation SIEMPRE viene cuando se pidió análisis
type InvestmentAnalysis = AnalysisBase & {
 reconciliation: {
  capitalContributed: number;
  realizedPnl: number;
  closureAdjustment: number;
  ledgerBalance: number;
  difference: number;   // los tres primeros menos el cuarto
  tolerance: number;    // bajo esto, la identidad se considera cumplida
 };
 balanceByAccount?: DistributionPart[];  // full
 contributionHistory?: {                 // full
  rows: { transactionId: number; accountId: number; accountName: string; amount: number; contributionDate: string }[];
  totalRows: number;
 };
};

// debt
type DebtAnalysis = AnalysisBase & {
 byCounterparty?: {                      // full
  accountId: number;
  accountName: string;
  balance: number;
  direction: string;
  rank: number;
 }[];
 legsOverTime?: { month: string; receivable: number; payable: number }[]; // full
};
```

### 4.3 Tres formas que hay que dibujar con la lectura correcta

Un componente que las lea mal queda mal **de una manera que igual parece
plausible**, que es la peor.

- **`committedAgainstFree` tiene tres términos y no suman, a propósito.** El
  efectivo libre se pisa por cuenta antes de sumar, así que el excedente de una
  cuenta no puede absorber el faltante de otra. `flooredShortfall` es exactamente
  lo que costó ese piso y es el campo que explica la brecha. Un cliente al que le
  den dos de los tres y calcule el tercero queda mal justo para el dueño que más
  necesita que esté bien.
- **`legsOverTime` trae las dos piernas POSITIVAS**, así que quien grafique las
  dos líneas nunca tiene que invertir una. Un mes sin deudores reporta `0` en
  ambas en vez de desaparecer — un mes faltante dobla la línea entre sus vecinos.
- **`contributionHistory` es la página más nueva de un historial sin cota
  inferior.** Trae `totalRows` al lado por eso: un lector que no distinga la
  página del todo leería "cincuenta aportes" de un dueño que hizo quinientos.

### 4.4 La pantalla de actividad

`GET /activity` devuelve `transactions`, el `range` que efectivamente sirvió y
`filters` con el término y el tipo de movimiento que aplicó. Es la única pantalla
del módulo cuyo período **elige el lector**, y sus dos cotas son opcionales con
default sin cota.

**Los tres estrechamientos se sirven, ninguno se filtra en el cliente.** El
término va en `search` y el tipo en `movementType`, así que `totalRows` responde
por el conjunto entero. Un filtro sobre la página en la mano diría "3 de 5"
mientras la cuenta tiene dos mil movimientos.

**`filters` se devuelve por la misma razón que `range`.** Cinco filas de dos mil
no es una lista corta, es una lista filtrada, y sólo el servidor puede decir cuál
de las dos está mirando el lector.

**El término es literal, no un patrón.** La consulta usa `strpos(lower(...))` y
no `ILIKE`: con `ILIKE` el `%` y el `_` que escriba el lector serían comodines, y
buscar `50%` devolvería todas las filas.

---

## 5. Tabla maestra de tasks de render

Una fila por bloque que el frontend tiene que construir. **`estado` no dice si
el componente existe**, dice si el dato que necesita está publicado hoy. Las dos
preguntas se separaron a propósito: un bloque puede estar servido y sin dibujar,
y dibujado contra un campo que después cambia de forma.

La frase que abría esta sección —«ninguno existe todavía»— era cierta el
2026-09-07 y dejó de serlo. Lo construido se mide abajo, en 5.0, y no se anota
fila por fila acá para que esta tabla siga respondiendo una sola pregunta.

### 5.0 Qué está construido, medido el 2026-09-11

Medido leyendo los montajes, no la lista de archivos: un componente que existe y
que nadie monta no está construido.

| filas | bloque | componente | dónde se monta |
|---|---|---|---|
| 1, 2 | héroe, posición y flujo | `HeroIndicators.tsx`, `BigBoxResult.tsx` | `OverviewLayout.tsx:174-182` |
| — | saldo de cuentas, lee `hero` | `AccountBalance.tsx` | `Overview.tsx:551` |
| 9 | tarjeta de inversión | `InvestmentAccBalance.tsx` | `Overview.tsx:561` |
| 4-8 | las seis tarjetas de dominio | `DomainCards.tsx` | `Overview.tsx:574` |
| 10 | snapshot mensual | `MonthlySnapshot.tsx` | `Overview.tsx:580` |
| 11 | metas financieras | `FinancialGoals.tsx` | `Overview.tsx:585` |
| 15 | líneas de tendencia | `TrendCharts.tsx` | `Overview.tsx:588` |
| 13 | Pareto del gasto | `ParetoBar.tsx` vía `ExpenseByCategory.tsx` | `Overview.tsx:595` |
| 34 | dona de la participación del mes | `DonutChart.tsx` vía `ExpenseByCategory.tsx` | `Overview.tsx:595` |
| 12 | actividad reciente | `RecentActivity.tsx` | `Overview.tsx:611` |
| 17, 35 | listado por dominio y su filtro | `OverviewDomain.tsx` | ruta `:domain` de `App.tsx:310` |

**Lo que la medición encontró sin construir, y no es lo que la tabla decía.**

- **La fila 3, la tarjeta consolidada, no tiene lector y el store no la guarda.**
  Ningún componente lee `all`, y `useOverviewStore.ts` no declara el campo, así
  que no es que falte el componente: falta el tramo entero, del store a la
  pantalla. Sigue **SERVIDA** por el endpoint, que es lo que su fila afirma.
- **La fila 14, las dos curvas del plan en el Pareto, sigue sin dibujar.**
  `ParetoBar.tsx` no menciona `cumulativeBudget` en ninguna línea. El hueco que
  5.1 describe está abierto tal cual lo describe.
- **La fila 29, la etiqueta condicional del selector de mes, tampoco.**
  `isCurrentMonth` se lee en exactamente dos lugares —`AccountBalance.tsx:115` e
  `InvestmentAccBalance.tsx:122`— y en los dos decide el pie de una tarjeta, no
  la etiqueta del selector. El campo está servido y leído; la etiqueta que la
  fila 29 pide no existe.

| # | task de render | de qué campo sale | endpoint · profundidad | estado |
|---|---|---|---|---|
| 1 | Héroe — 4 figuras de posición | `netWorth`, `liquidNetWorth`, `cashPosition`, `freeCash` | `GET /` · nivel 1 | **SERVIDO** |
| 2 | Héroe — 2 figuras de flujo | `netMonthlyFlow`, `savingsRate` | `GET /` · nivel 1 | **SERVIDO** |
| 3 | Tarjeta consolidada | `all` | `GET /` · nivel 1 | **SERVIDO** |
| 4 | Tarjeta de ingreso | `domainCards.income` | `GET /` · nivel 1 | **SERVIDO** |
| 5 | Tarjeta de gasto, con presupuesto | `domainCards.expense` + `budgetAmount`, `categorizedExpense`, `budgetVariance`, `hasUncategorizedExpense` | `GET /` · nivel 1 | **SERVIDO** |
| 6 | Tarjeta de deuda, dos piernas | `domainCards.debt` + `payable`, `receivable`, `settledCount` | `GET /` · nivel 1 | **SERVIDO** |
| 7 | Tarjeta de pocket, total y línea de estado | `domainCards.pocket` + `target`, `remaining`, `progress`, `fundedCount`, `overdueCount`, `uncoveredCount` | `GET /` · nivel 1 | **SERVIDO** |
| 8 | Tarjeta de resultado realizado | `domainCards.pnl` + `realizedFromInvestment` | `GET /` · nivel 1 | **SERVIDO** |
| 9 | Tarjeta de inversión | `domainCards.investment` — **forma propia**, comparte sólo `domain`, `currency` y `meta` | `GET /` · nivel 1 | **SERVIDO, con su propio componente** |
| 10 | Snapshot mensual, 3 dominios | `monthlySnapshot[]` | `GET /` · nivel 1 | **SERVIDO** |
| 11 | Metas financieras | `financialGoals` | `GET /` · nivel 1 | **SERVIDO** |
| 12 | Actividad reciente, con buscador, filtro y paginación | `GET /activity` → `transactions` + `range` + `filters` | `GET /activity` | **CONSTRUIDO 2026-09-09** — `RecentActivity.tsx`. El teaser de `recentActivity.transactions` que traía la página quedó sin lector |
| 13 | Pareto del gasto — barras de gasto y curva acumulada | `charts.expenseCategories` con `rank`, `cumulativeActual`, `cumulativePercentage` | `GET /` · nivel 1 | **SERVIDO** |
| 14 | Pareto — segunda barra de plan y segunda curva | `budgetAmount` + `cumulativeBudget`, `cumulativeBudgetPercentage`, `hasSkippedBudget` | `GET /` · nivel 1 | **SERVIDO** desde 2026-09-08 — falta el frontend |
| 15 | Líneas de tendencia, 6 puntos | `charts.trend.income`, `.expense`, `.pocket` | `GET /` · nivel 1 | **SERVIDO — sólo 3 de 6 dominios** |
| 16 | Pantalla de actividad con rango | `GET /activity` → `transactions` + `range` | `GET /activity` | **ABSORBIDA POR LA 12** — el bloque de nivel 1 ya elige su período, así que no hay una segunda pantalla que construir |
| 17 | Listado paginado por dominio | `transactions{rows, page, pageSize, totalRows}` | `GET /:domain` · nivel 1 | **SERVIDO** |
| 18 | Serie larga, 13 puntos | `analysis.series` | `?analysis=derived` | **SERVIDO — 4 de 6 dominios** |
| 19 | Dona de ingreso por fuente | `analysis.bySource` + `concentration` | `?analysis=full` | **SERVIDO** |
| 20 | Dona de inversión por cuenta | `analysis.balanceByAccount` | `?analysis=full` | **SERVIDO** |
| 21 | Ranking de deuda por contraparte | `analysis.byCounterparty` con `direction` | `?analysis=full` | **SERVIDO — sin `share`, ordenado por magnitud** |
| 22 | Progreso por pocket | `analysis.progressByPocket` | `?analysis=derived` | **SERVIDO — `progress` en escala 0-100** |
| 23 | Descomposición comprometido / libre | `analysis.committedAgainstFree` (4 términos) | `?analysis=full` | **SERVIDO** |
| 24 | Conciliación de inversión | `analysis.reconciliation` (6 términos) | `?analysis=derived` | **SERVIDO** |
| 25 | Historial de aportes | `analysis.contributionHistory{rows, totalRows}` | `?analysis=full` | **SERVIDO** |
| 26 | Partición del resultado realizado | `analysis.byAccountType{investment, other}` | `?analysis=derived` | **SERVIDO** |
| 27 | Split categorizado / sin categorizar | `analysis.categorization` | `?analysis=derived` | **SERVIDO** |
| 28 | Dos piernas de deuda en el tiempo | `analysis.legsOverTime` | `?analysis=full` | **SERVIDO** |
| 29 | Selector de mes con etiqueta condicional | `window{referenceMonth, isCurrentMonth, periodStart, periodEnd}` de cualquier sección | `GET /` · nivel 1 | **SERVIDO — la etiqueta es trabajo de frontend, y `isCurrentMonth` es el campo que la decide** |
| 30 | Estados de fetch: skeleton, error, vacío | `meta.notices` + semántica de ausente/`null`/`0` | todos | **SERVIDO — la regla la aplica el frontend** |
| 31 | Sparkline de la tarjeta de resultado realizado | — | — | **NO SERVIDO** — esa tarjeta no tiene `trend` de 6 puntos |
| 32 | Línea de deuda en el tiempo, un solo campo | — | — | **NO EXISTE POR DECISIÓN** — se dibuja la fila 28 |
| 33 | Línea de cartera de inversión en el tiempo | — | — | **NO EXISTE** — inversión no tiene serie a ninguna profundidad |
| 34 | Dona de participación del gasto en el mes | `charts.expenseCategories` — **las mismas filas del Pareto leídas como partes de un todo**, sin campo nuevo | `GET /` · nivel 1 | **SERVIDO** — el gasto sin categorizar queda fuera del anillo por la decisión D48: está fuera del conjunto ranqueado, así que una porción lo contaría dos veces |
| 35 | Filtro por categoría del listado de nivel 2 | `category` en el query de `GET /:domain`; la pertenencia sale de las filas de `getBudgetAccountsStatus` | `GET /:domain` · nivel 1 | **SERVIDO desde 2026-09-11** — estrecha **sólo la lista**: tarjeta, curva y ranking siguen siendo los del mes entero |

### 5.1 Los cuatro huecos, dichos como huecos

| hueco | consecuencia en pantalla | el remedio |
|---|---|---|
| las dos curvas del plan en el Pareto no están implementadas | el bloque dibuja una barra y una curva en vez de dos y dos | trabajo de servidor, en el constructor de la distribución de categorías. El bloque de una curva se construye hoy |
| la tarjeta de resultado realizado no tiene `trend` de 6 puntos | esa tarjeta no puede dibujar sparkline desde el payload de la página | pedir `derived` al endpoint por dominio y cortar los últimos seis puntos, o dejar la tarjeta sólo con cifras |
| deuda no tiene serie a ninguna profundidad | no hay línea de "deuda en el tiempo" de un solo campo | dibujar `legsOverTime` como dos líneas positivas en `full`. **Es la decisión, no la carencia** |
| inversión no tiene serie a ninguna profundidad | no hay línea de cartera en el tiempo | la conciliación, el saldo por cuenta y el historial de aportes son lo que esa tarjeta tiene. Una serie temporal necesita una sentencia nueva y no está en este plan |

---

## 6. Reglas que el payload le impone a los componentes

No son preferencias de estilo. Un componente que las ignora imprime un número
equivocado.

- **Ausente, `null` y `0` son tres afirmaciones distintas.** Ausente = la pregunta
  no se hizo. `null` = se hizo y no tiene respuesta. `0` = la respuesta es cero.
  Una cifra faltante se renderiza como skeleton o guion, **nunca** como `0` ni
  `NaN`.
- **Los tres estados de fetch son tres**: cargando (skeleton), error (mensaje y
  reintento) y vacío. No son el mismo estado con distinto texto.
- **Nunca reordenar, nunca resumar.** El rango viene del servidor con desempate
  explícito. Toda porción se toma contra la cifra que la tarjeta publicó.
- **Las escalas no se mezclan.** `share` y las dos `cumulative*Percentage` son
  razones 0-1 con cuatro decimales; `progress` del tablero de Pocket y
  `executionPercentage` del presupuesto son tasas sobre 100.
- **La ventana se lee de la respuesta**, nunca se rearma del mes.
- **La etiqueta del mes es condicional** al mes elegido.
- **La moneda vive en la sección**, no en la app; las filas de un listado traen la
  suya individualmente.
- **Los avisos se renderizan.** Una tarjeta que pinta cifras y descarta avisos
  pierde la explicación de cada guion que muestra.
- **Los colores salen de tokens.** Los bosquejos que este documento reemplaza
  llevaban valores hex crudos; eso se permite en un bosquejo y no en una hoja de
  estilos. Quien construya un bloque **pide el token que falte** en vez de
  arrastrar el literal.

---

## 7. Lo que queda abierto para el frontend

- **Qué tarjeta es dueña del Pareto.** Está en el payload de la página y podría
  renderizar dentro de la tarjeta de gasto, o rutear a su propia pantalla.
- **Si las seis tarjetas rutean a seis pantallas o a tres.** Inversión, deuda y
  pocket ya tienen módulo propio; ingreso, gasto y resultado realizado no.
- **Los tokens de color que falten**, que se piden cuando se construye el bloque.

Ninguno impide construir un componente: los dos primeros deciden dónde se monta
un bloque, y el tercero se acuerda después del diseño, nunca antes.

**Este documento no agrega ningún requerimiento al backend salvo el de la fila
14** — todo lo demás es un campo que ya existe.
