# Overview — objetivo, alcance, workflow e indicadores

**Documento único del módulo, escrito el 2026-09-07.** Reemplaza a los quince
documentos y tres bosquejos HTML que existían en esta carpeta. Todo lo que dice
está medido sobre el código de `feat/overview`, no leído de un plan anterior.

Su compañero es `OVERVIEW_LAYOUT.md`, que dice **cómo se dibuja**. Este dice
**qué se mide, por qué, y en qué orden se construye**.

Los nombres de campo van en inglés porque son identificadores del payload; el
texto va en castellano.

---

## 1. Objetivo

Overview es **la capa de lectura financiera**, no el destino analítico. Responde
tres preguntas en tres niveles de profundidad y no intenta responder una cuarta.

| nivel | pregunta | dónde vive |
|---|---|---|
| **Nivel 1** | ¿en qué situación estoy? | la página de Overview, una sola petición |
| **Nivel 2** | ¿qué explica este dominio? | la pantalla de detalle por dominio |
| **Nivel 3** | ¿qué explica esta entidad? | **no es de Overview** — es el módulo dueño (Pocket, Deuda, Inversión) |

El problema que el módulo existe para resolver: la pantalla que un usuario ve hoy
renderiza **tres** cifras —patrimonio, ingreso, gasto— construidas con **cinco**
llamadas al endpoint de saldos por tipo de cuenta, y **nunca llama al payload de
Overview**. Todo lo que Overview calcula está calculado y sin renderizar.

Por eso el trabajo no es "construir Overview". Es: corregir la base temporal,
reapuntar el dominio que leía una tabla vaciada a propósito, publicar las cifras
que ya se calculaban y se tiraban, y **sólo entonces** conectar una pantalla.
Conectar primero habría publicado tres saldos cambiados en silencio.

---

## 2. Alcance

### 2.1 Las reglas de arquitectura que no se renegocian

| regla | qué dice |
|---|---|
| **autoridad** | el backend calcula. El frontend **nunca** calcula un saldo, una tasa, una varianza ni una conversión |
| **una cifra, un camino** | una definición, una implementación autoritativa, muchos consumidores. Dos fórmulas que producen el mismo nombre es el defecto que esta regla existe para prevenir |
| **una petición** | la página entera llega en una respuesta. Un componente que busca su propia cifra busca una que la página ya tiene |
| **las tarjetas son entradas** | 3 a 5 valores máximo. Una tarjeta no es un mini-reporte |
| **sin gráficos en nivel 1** *(matizado)* | la decisión original prohibía todo gráfico en la página. Se relajó por decisión posterior: la página trae la serie de seis puntos y el Pareto **ya calculados**, y tirarlos para volver a pedirlos habría sido la segunda consulta que la regla de una petición prohíbe |
| **el que calcula, publica** | una cifra que un repositorio calcula y que nunca llega al payload es el modo de falla característico de este módulo |

### 2.2 Fuera de alcance porque ya existe en otro sitio

| cosa | dónde vive |
|---|---|
| progreso mensual de un pocket, brecha contra el plan, adherencia, requerido a la fecha | el tablero de Pocket, **construido y publicado hoy** |
| aporte mensual requerido, la línea del plan, historial de asignaciones | la pantalla de detalle de Pocket |
| total asignado / objetivo / restante como héroe | el héroe del propio tablero de Pocket. Overview muestra un resumen, no un segundo tablero |

### 2.3 Fuera de alcance porque el dato no existe

**Valor de mercado, porcentaje de retorno y ganancia no realizada.** Medido, no
supuesto: no existe ninguna columna de precio, cantidad, tenencia, ticker ni
valor de mercado en todo el backend. **No son indicadores diferidos — son
incomputables** hasta que exista una fuente de valuación. Listarlos como backlog
afirmaría lo contrario.

### 2.4 Fuera de alcance porque es infraestructura que este módulo no necesita

- Una tabla de historial de saldos. La derivación del ledger más la
  reconstrucción a fin de mes ya responden toda pregunta que este plan hace.
- Un motor genérico de indicadores o un runtime de registro de métricas. El
  registro es **documentación y contrato**, nunca infraestructura de ejecución.
- Un dominio de metas propio. Pocket es el único modelo de meta que existe; un
  segundo sería el mismo dato dos veces.
- Una tarjeta de Transferencia. Una transferencia es un hecho de soporte, no un
  dominio financiero.

### 2.5 Fuera de alcance y diferido

- **Asignación acumulada del año en Pocket** — sólo si aparece una pregunta
  genuinamente transversal. "¿Cuánto puse en mis metas este año?" es una pregunta
  distinta de "¿cómo va mi pocket este mes?", y sólo la segunda tiene casa hoy.
- **Una serie temporal global de Pocket** — nivel 2 como mínimo.
- **Promedios de mes calendario** al lado de los de mes activo. Si algún día se
  quieren, es un **indicador separado con nombre propio**, jamás una redefinición
  del existente.
- **Antigüedad de deuda.** Nombrada en propuestas anteriores como gráfico de
  nivel 2. Su semántica nunca se definió, y un gráfico no se dibuja antes que su
  definición.

### 2.6 Deudas conocidas que este módulo arrastra y no resuelve

| deuda | por qué se registra acá |
|---|---|
| **la fragilidad del prefijo de texto en el resultado realizado** | las dos cifras de resultado realizado excluyen las compensaciones de cierre de cuenta comparando un **prefijo de descripción**. Es un escritor contra **cuatro** lectores, así que editar esa cadena reclasifica dinero histórico en cuatro sitios a la vez. Reemplazarlo por una bandera tipada es trabajo propio |
| **la migración de limpieza que `020` difirió** | dejó a propósito la fila del tipo de cuenta de pocket retirado y la tabla legacy. **No existe tal migración de limpieza**; la secuencia termina en 030. Después de la fase P2 nadie lee esa tabla, que es exactamente cuando la limpieza pasa a ser segura |
| **los ocho fallbacks a cero de la pantalla viva** | violan la regla de que una cifra faltante es un guion y nunca un cero. Son reales, y esa pantalla es la que este trabajo reemplaza, así que la regla **obliga al reemplazo**. La única excepción es el guard de gasto, que **ya está arreglado en los dos checkouts**: el comentario de `OverviewLayout.tsx:203-204` lo describe en pasado. No es trabajo de P5 |

---

## 3. El marco temporal

Es la corrección más grande que recibió el plan original, y todo el resto
descansa sobre ella.

### 3.1 Los tres relojes

Son tres cosas separadas y durante un tiempo fueron una sola.

```
1. FECHA DE REFERENCIA  — "¿cuál es mi posición?"   → cierre del mes, u hoy si el mes está en curso
2. PERÍODO DE ANÁLISIS  — "¿qué pasó?"              → inicio del período → fecha de referencia
3. PERÍODO DE ACTIVIDAD — "¿qué quiero leer?"       → lo elige el usuario, independiente de los otros dos
```

**Un flujo nunca fabrica los días que al mes le faltan.** El mes en curso es mes
a la fecha, y la pantalla lo dice.

El servidor **siempre informa qué ventana usó**; el cliente nunca la infiere de
su propio reloj, porque el reloj del cliente no es el calendario del dueño de la
cuenta.

**Y la informa en campos con nombre, que es lo que faltaba escribir acá.** La
ventana servida trae el **mes de referencia** (`referenceMonth`), el inicio y el
fin del período (`periodStart`, `periodEnd`), y un indicador de **si ese mes
sigue corriendo** (`isCurrentMonth`). El selector lee el mes de referencia **de
la respuesta** en vez de recordar el que envió — una petición puede no nombrar
ninguno — y el indicador de mes en curso es lo que decide la etiqueta
condicional. Sin nombrar esos dos campos, la regla de arriba queda
enunciada y sin insumo: P5 sabe que la etiqueta cambia y no tiene de dónde leer
cuándo. El fin de período es la **fecha de referencia** y no el último día del
mes: son iguales en un mes cerrado y no lo son en el mes en curso, y el mismo
valor llega a las seis tarjetas desde este mismo objeto, así que un payload no
puede nombrar dos finales para un solo período.

### 3.2 Las cinco naturalezas temporales

Toda cifra publicada es exactamente una de éstas. Una cifra que no se puede
clasificar es una cifra cuya pregunta no se decidió, y no entra al contrato hasta
que se pueda.

| marca | naturaleza | qué dice | ¿puede estar en nivel 1? |
|---|---|---|---|
| **P** | Posición | el estado en un instante | sí |
| **F** | Flujo | lo que se movió durante un período | sí |
| **T** | Tendencia | una serie a lo largo de períodos | **no — nivel 2** |
| **A** | Acumulación | total corrido desde un origen | **no — nivel 2**, con una excepción registrada |
| **M** | Promedio | el comportamiento normal contra el que se lee un período | sólo el snapshot |

**La naturaleza pertenece a la cifra, no al nombre del campo.** `totalAmount` en
la tarjeta compartida es **Flujo** para ingreso, gasto y resultado realizado, y
**Posición** para deuda y pocket — esos dos no suman los movimientos de un
período, declaran un saldo al cierre. Un mismo nombre, dos naturalezas; un
cliente que asuma la primera lectura para los cinco malinterpreta dos tarjetas.

**La excepción de Acumulación en nivel 1** es la tarjeta de inversión: capital
aportado, resultado realizado desde la apertura y días desde el último aporte son
acumulaciones y están en la página. Se aceptó porque esa tarjeta **no tiene
ventana** y por lo tanto no puede confundir dos escalas: no hay período que
etiquetar al lado de la cifra.

---

## 4. Workflow — las fases y su estado

El estado se midió en el código, no se leyó del plan.

| fase | qué es | estado | condición de salida | lo pendiente |
|---|---|---|---|---|
| **P0** | congelar el contrato semántico | **HECHA**, sin código | toda cifra de nivel 1 tiene fórmula, naturaleza, dueño, semántica de nulo y de moneda | — |
| **P1a** | reanclar las cuatro lecturas de saldo | **HECHA**, commit `2f8cec3d` | el saldo almacenado y el derivado coinciden por cuenta antes de editar | — |
| **P1b** | que banco e inversión obedezcan el mes de referencia | **HECHA**, commits `4f9be6a0` y `229286df` | un saldo pasado de banco y uno de inversión se reconstruyen bien; el mes en curso es mes a la fecha | — |
| **P2** | reapuntar Pocket al modelo de plan | **HECHA**, commits `f4b999d9` y `f0388039` | objetivo, asignado, restante y progreso de Overview **igualan** los del tablero de Pocket, cifra por cifra | — |
| **P3** | completar y corregir los indicadores de nivel 1 | **HECHA en el código** | `netWorth − liquidNetWorth == receivable` · gasto = categorizado + sin categorizar · las piernas de deuda coinciden en magnitud con el endpoint legacy | el monto sin categorizar se queda en nivel 2 por orden de Carlos: esa cifra debería ser cero |
| **P4** | el contrato de la API | **HECHA**, sin comitear | el contrato está congelado y los tests de contrato pasan (69 pasan hoy) | el bloque no está comiteado |
| **P5** | frontend | **NO EMPEZADA** | **que la pantalla viva no tenga ninguna dependencia del endpoint de saldos por tipo para ninguna cifra de Overview** | ningún componente importa ninguna ruta de Overview |
| **P6** | nivel 2 | **HECHA en el backend**, sin comitear | las seis pantallas de dominio tienen su análisis servido a las dos profundidades | 16 archivos modificados y 10 sin seguimiento; comitear es decisión de Carlos |

La condición de salida de P5 es la única que importa para el usuario: hoy esa
pantalla hace **cinco llamadas para construir tres cifras**.

### El orden de construcción de P5

Un componente por commit, cada uno entero.

1. **El selector de mes**, con la etiqueta condicional. El control elige un mes
   entero en los dos casos; la etiqueta no puede — un mes cerrado se lee como el
   mes y el mes en curso se lee como mes a la fecha.
2. **El héroe**, con sus cuatro figuras de posición y dos de flujo, adoptando la
   jerarquía nueva entera en vez de la tríada vieja con una cifra atornillada.
3. **Las seis tarjetas** — cinco con un componente compartido, **inversión con el
   suyo propio**.
4. **El Pareto**, del payload de la página, sin parámetro `analysis` y sin
   reordenar en el cliente.
5. **Snapshot mensual, metas y teaser de actividad**, los tres del mismo payload.
6. **Las pantallas de dominio**, con la profundidad `derived` donde alcanza y
   `full` sólo donde hay desglose ranqueado.

**El arreglo de una línea del guard de gasto salió de esta lista, y es una
corrección a lo que este documento decía.** La pantalla viva probaba el total de
ingreso para decidir si el total de gasto era un número — un gasto roto se
imprimía como real y un gasto válido se borraba cuando el ingreso se rompía —
pero el comentario de `OverviewLayout.tsx:203-204` lo describe **en pasado** en
los dos checkouts. Ya está arreglado, y ponerlo primero mandaba a P5 a rehacer
trabajo hecho.

---

## 5. Los indicadores

Cada uno con lo que dice, cómo sale, su naturaleza y su semántica de nulo. La
forma exacta del campo está en `OVERVIEW_LAYOUT.md`.

### 5.1 Nivel 1 — el héroe

Las cifras que responden "dónde estoy parado", leídas a la fecha de referencia.

| indicador | campo | fórmula | nat. | nulo |
|---|---|---|---|---|
| **Patrimonio** | `netWorth` | banco + inversión + posición de deuda | P | nunca nulo; 0 es una cifra real |
| **Patrimonio líquido** | `liquidNetWorth` | banco + inversión − por pagar | P | `null` + aviso **sólo** si la pierna por pagar no llegó, nunca 0 |
| **Posición de efectivo** | `cashPosition` | banco + efectivo, una sola cifra | P | nunca nulo |
| **Efectivo libre** | `freeCash` | `Σ max(saldo − asignado, 0)` sobre banco y efectivo | P | nunca nulo y nunca negativo |
| **Flujo neto del mes** | `netMonthlyFlow` | ingreso del período − gasto del período | F | nunca nulo; negativo es una respuesta real |
| **Tasa de ahorro** | `savingsRate` | flujo neto ÷ ingreso del período | F, tasa | `null` + aviso cuando el ingreso no puede ser denominador, **nunca 0** |

**`netWorth` tiene tres términos y deliberadamente no cuatro.** Un pocket es un
plan, no un contenedor: comprometer dinero no mueve nada, así que el total
comprometido **ya está dentro del saldo bancario**. Sumarlo contaba el mismo
dinero dos veces. La pantalla viva tampoco lo sumaba nunca.

**El piso del efectivo libre es por cuenta, antes de sumar.** Una cuenta
comprometida más allá de su saldo aporta cero, nunca un negativo que el excedente
de otra cuenta absorba en silencio.

**Consecuencia del piso, escrita porque se lee como un defecto: el efectivo libre
puede salir MAYOR que la posición de efectivo.** Una cuenta en descubierto aporta
su saldo negativo a la posición y aporta cero al efectivo libre. Es la respuesta
que el piso se eligió para dar — dinero que el dueño no tiene no es efectivo
libre negativo — y el par sigue siendo legible porque responden preguntas
distintas: qué tienen las cuentas, contra cuánto de eso nadie prometió.

**Las dos se leen en par y nunca fundidas.** Un pocket no bloquea un gasto: el
gasto contra dinero comprometido siempre se acepta, así que restar el
comprometido de la posición le diría al dueño que no puede gastar dinero que sí
puede. El compromiso va **al lado** del saldo, nunca dentro.

**El patrimonio líquido deja fuera lo que a uno le deben** a propósito: lo que
queda es lo que el dueño controla. Negativo es una respuesta real — dice que las
deudas pesan más que todo lo líquido.

**El flujo neto y la tasa de ahorro viajan juntos.** La tasa es el flujo dividido
por uno de los dos operandos con los que el flujo ya se construyó; una tasa sin
su denominador al lado es ilegible.

### 5.2 Nivel 1 — la tarjeta compartida de dominio

Cinco dominios llevan las mismas tres cifras: ingreso, gasto, deuda, pocket y
resultado realizado. **Inversión no**, y §5.4 dice por qué.

| indicador | campo | qué dice | nat. | nulo |
|---|---|---|---|---|
| **total** | `totalAmount` | el agregado del dominio sobre la ventana | **F** para ingreso, gasto y resultado · **P** para deuda y pocket | nunca nulo — 0 es actividad real en cero |
| **conteo de movimientos** | `transactionCount` | las filas detrás del total | F | nunca nulo |
| **cambio, como monto** | `delta` | el total de este período − el del anterior | F, comparación | `null` + aviso cuando no existe un período anterior completo |
| **cambio, como tasa** | — | cambio ÷ el total del período anterior | F, comparación | **decisión abierta**, §7 |

**El cambio como tasa es nulo por una razón que no es dato faltante.** Un
porcentaje medido desde cero no tiene valor, y uno medido desde una base negativa
invierte su propio signo: un resultado realizado que va de −100 a −50 imprimiría
+50% y se leería como una ganancia. El monto está definido en todos los casos en
que la tasa no lo está, así que la tarjeta siempre tiene algo cierto que imprimir.

### 5.3 Nivel 1 — lo que cada dominio agrega a la tarjeta compartida

| indicador | campo | qué dice | dueño | nulo |
|---|---|---|---|---|
| **presupuesto del período** | `budgetAmount` | la suma de las categorías presupuestadas | presupuesto, importado | `null` + aviso si no hay ninguna categoría presupuestada |
| **gasto categorizado** | `categorizedExpense` | gasto atado a una cuenta de categoría | presupuesto, importado | `null` con el anterior |
| **varianza de presupuesto** | `budgetVariance` | presupuesto − gasto categorizado | presupuesto, importado | `null` si el presupuesto lo es |
| **hay gasto sin categorizar** | `hasUncategorizedExpense` | verdadero cuando el total supera al categorizado | Overview | nunca nulo |
| **por pagar** | `payable` | los saldos deudores negativos, como magnitud positiva, al cierre | Overview | nunca nulo; ≥ 0; 0 es real |
| **por cobrar** | `receivable` | los saldos deudores positivos al cierre | Overview | igual |
| **deudores saldados** | `settledCount` | cuentas de deudor con saldo cero al cierre | Overview | nunca nulo. Va al read model y **no se pinta** en la tarjeta de nivel 1 |
| **objetivo de pockets** | `target` | la suma de los objetivos de los planes | Pocket, importado | puede ser `null` si ningún plan tiene objetivo |
| **restante de pockets** | `remaining` | objetivo − asignado, acotado por pocket antes de sumar | Pocket, importado | `null` con el anterior |
| **progreso de pockets** | `progress` | asignado ÷ objetivo, **tasa sobre 100** | Pocket, importado | `null` con el anterior |
| **conteos de estado de pockets** | `fundedCount`, `overdueCount`, `uncoveredCount` | financiados, vencidos, sin cobertura | Pocket, importado | nunca nulos |
| **parte del resultado en inversión** | `realizedFromInvestment` | cuánto del resultado del mes cayó en cuentas de inversión | Overview | nunca nulo |

**La varianza compara dos universos distintos a propósito.** El presupuesto se
mide contra el gasto **categorizado** y no contra el total, porque el vínculo
entre un movimiento y una cuenta de categoría es opcional. Publicar la diferencia
contra el total inventaría una resta entre universos que no coinciden.

**Las dos piernas de deuda son magnitudes positivas, las dos.** La dirección la
lleva el nombre del campo, no el valor: un `payable` negativo sería un doble
negativo. La identidad que las ata es `totalAmount = receivable − payable`, y es
una **comprobación, no una definición** — el total sigue saliendo de su propia
consulta y no se recalcula desde las piernas, ni en el servidor ni en el cliente.

**Los conteos de estado de pockets son una línea, no tres tarjetas.** Siete
cifras renderizadas como siete cifras convertirían esto en un tablero de Pocket
en miniatura dentro de Overview.

**La parte del resultado que cayó en inversión se dibuja subordinada al total, y
nunca al lado con el mismo peso.** Es una porción del número de arriba — un
filtro sobre exactamente las filas que el total ya sumó, así que no puede
excederlo ni construirse sobre otro corte — y cuando lo iguala, lo honesto es
decir que todo el resultado del mes vino de inversión, no que hay dos resultados.
**No es la cifra de la tarjeta de inversión con otro nombre**: aquélla acumula
toda la historia de esas cuentas, ésta es un flujo acotado al mes de referencia,
y coinciden sólo para un dueño cuya historia entera de inversión cae dentro del
mes que se está leyendo. El resto — lo que vino de toda otra cuenta — es una
resta sobre dos campos publicados y deliberadamente no es un segundo campo.

**El monto sin categorizar existe como cifra de divulgación, nunca como categoría
de presupuesto.** Existe para que `gasto = categorizado + sin categorizar` sea
visible, y jamás se carga contra una línea de presupuesto. Por orden de Carlos
vive en nivel 2, porque esa cifra **debería ser cero**.

**El monto no se publica: se publica la bandera, y la resta la hace el cliente.**
`hasUncategorizedExpense` es booleano, y el monto es el total menos el
categorizado — dos campos que la tarjeta ya trae, así que el servidor no debe un
tercero. **Hay un solo caso que esa resta no recupera, y es el único terreno
sobre el que el campo podría reabrirse**: el gasto categorizado es anulable, y
con él nulo el cliente no tiene de qué restar. La bandera también es falsa en
ese caso, así que la pantalla no miente — pero tampoco puede decir cuánto, y esa
es la diferencia entre una cifra ausente y una cifra en cero.

### 5.4 Nivel 1 — la tarjeta de inversión

Cinco cifras absolutas, **ninguna sumable al total de otra tarjeta**. Un
porcentaje de retorno y un valor de mercado están prohibidos por decisión y están
**ausentes del tipo**, no presentes en nulo.

| indicador | campo | qué dice | nat. |
|---|---|---|---|
| **capital aportado** | `capitalContributed` | aportes y aperturas de cuenta | A |
| **saldo del ledger** | `ledgerBalance` | el saldo derivado de las cuentas de inversión | P |
| **resultado realizado desde la apertura** | `realizedPnl` | movimientos de resultado, menos los ajustes de borrado | A |
| **ajuste por cierre** | `closureAdjustment` | lo que las compensaciones de cierre movieron | A |
| **concentración** | `concentration` | el saldo de la cuenta mayor ÷ el saldo del ledger | P, tasa |
| **días desde el último aporte** | `daysSinceLastContribution` | días del movimiento de fondeo más nuevo a la fecha de referencia | P, edad |
| **cuentas** | `accountCount` | cuántas cuentas de inversión existen | P |

**La identidad que la tarjeta afirma:** capital aportado + resultado realizado +
ajuste por cierre = saldo del ledger. Es la única tarjeta que publica su propia
conciliación, y lo hace en nivel 2 con la diferencia y la tolerancia explícitas.

**Una sola cifra de esta tarjeta no está acotada al mes**, y está registrada donde
se calcula: el conteo de cuentas cuenta las que existen **ahora**, no las que
existían en el mes de referencia.

### 5.5 Nivel 1 — el snapshot mensual

Definido para **tres** dominios solamente: ingreso, gasto y pocket.

| indicador | campo | qué dice | nat. |
|---|---|---|---|
| **la cifra del propio mes** | `domainMonthlyActual` | el total del dominio en el mes de referencia | F |
| **promedio de 3 meses** | `activeMonthAverage3m` | la media de los meses **activos** de los últimos tres | M |
| **promedio de 12 meses** | `activeMonthAverage12m` | la media de los meses **activos** de los últimos doce | M |
| **varianza contra el promedio** | `varianceVsAverage` | la cifra del mes − el promedio de **doce** | F, comparación |

**"Meses activos" es toda la definición.** Un mes sin actividad se **excluye del
denominador** en vez de contarse como cero, que es por qué el promedio es `null`
y no cero cuando ningún mes de la ventana tuvo actividad. Un dueño sin historia
trae `null` en los dos promedios y en la varianza: tres guiones, no tres ceros.

La varianza se mide contra el promedio de **doce** meses, no contra el de tres.

### 5.6 Nivel 1 — metas, tarjeta consolidada y actividad

| indicador | campo | qué dice | nat. |
|---|---|---|---|
| **saldo de las metas** | `goalsTotalBalance` | lo que las metas tienen | P |
| **objetivo de las metas** | `goalsTotalTarget` | a qué apuntan; `null` cuando ninguna lo fija | P |
| **restante de las metas** | `goalsTotalRemaining` | objetivo − saldo | P |
| **las cifras consolidadas** | `all.*` | las del héroe y las tarjetas, **restadas de nuevo por nadie** | según su fuente |
| **conteo de movimientos de todo** | `all.transactionCountAll` | filas de **cinco** dominios en la ventana | F |
| **actividad reciente** | `recentActivity.transactions` | los cinco movimientos más nuevos | **no es un indicador** |

**La tarjeta consolidada no recalcula nada.** Toda cifra suya es el mismo valor
que el héroe o una tarjeta ya publicó, por el mismo camino. Su patrimonio es el
valor del propio héroe pasado tal cual, no una segunda suma de los mismos tres
números.

**El conteo consolidado suma cinco dominios y no seis.** Inversión no aporta
ninguno, porque su tarjeta no publica conteo. Un lector que espere seis va a
buscar el que falta.

**La actividad reciente no es una métrica y no toma el período de análisis.** Es
el único consumidor que elige su propia ventana, que es por qué se gana un
parámetro de petición que el resto del payload no tiene. Un usuario leyendo
agosto en noviembre vería, si no, un teaser de tres meses atrás — que parece una
app que dejó de registrar.

### 5.7 Nivel 2 — lo que agrega cada dominio

Nivel 2 es **una respuesta por dominio, no una por análisis**. Eso tiene un
costo: los análisis de un dominio difieren enormemente en precio, y una sola
respuesta haría que el caro sea el costo de todos. El parámetro de profundidad es
cómo las dos cosas se sostienen a la vez — una petición, y el que llama dice
cuánto construir.

| profundidad | qué agrega | qué cuesta |
|---|---|---|
| **ausente** | nada. La respuesta no tiene la clave del análisis en absoluto | la respuesta de nivel 1 |
| **`derived`** | todo lo que la petición de nivel 1 **ya buscó**, reformado | **ninguna sentencia extra** |
| **`full`** | lo que hay que consultar por primera vez | una sentencia nueva por dominio |

| dominio | indicador | profundidad | qué dice |
|---|---|---|---|
| todos con serie | **serie larga** (`series`) | `derived` | trece puntos: el mes de referencia y los doce contra los que se juzga |
| income | **ingreso por fuente** (`bySource`) | `full` | cada cuenta de origen, ranqueada, con su porción |
| income | **concentración** (`concentration`) | `full` | la porción de la fuente mayor |
| expense | **split categorizado / sin categorizar** (`categorization`) | `derived` | las dos partes de un mismo total |
| pnl | **partición por tipo de cuenta** (`byAccountType`) | `derived` | cuánto del resultado fue de inversión y cuánto del resto |
| pocket | **progreso por pocket** (`progressByPocket`) | `derived` | las filas del tablero de Pocket **republicadas verbatim** |
| pocket | **comprometido contra libre** (`committedAgainstFree`) | `full` | saldo bancario, comprometido, efectivo libre, y lo que costó el piso |
| investment | **conciliación** (`reconciliation`) | `derived` | los cuatro términos de la identidad, su diferencia y su tolerancia |
| investment | **saldo por cuenta** (`balanceByAccount`) | `full` | la cartera repartida, ranqueada, con su porción |
| investment | **historial de aportes** (`contributionHistory`) | `full` | la página más nueva de un historial sin cota inferior, con su conteo |
| debt | **por contraparte** (`byCounterparty`) | `full` | cada deudor, ranqueado por magnitud, con la dirección del dinero |
| debt | **las dos piernas en el tiempo** (`legsOverTime`) | `full` | por mes, por cobrar y por pagar, **las dos positivas** |

**El progreso por pocket no se recalcula: son las filas del propio tablero.** Eso
es lo que hace que esta sección y la pantalla del tablero coincidan **por
construcción y no por revisión**.

**`committedAgainstFree` tiene tres términos y no suman, a propósito.** El
efectivo libre se pisa por cuenta antes de sumar, así que el excedente de una
cuenta no puede absorber el faltante de otra. El cuarto campo,
`flooredShortfall`, es exactamente lo que costó ese piso y es el que explica la
brecha.

**Deuda no tiene serie a ninguna profundidad, y es una decisión.** Una posición
neta de deuda que no se movió es exactamente lo que esconde que las dos piernas
se duplicaron, que es la lectura que el nivel 2 existe para exponer. Por eso la
deuda se dibuja por contraparte y por pierna, nunca como una línea.

---

## 6. Reglas invariables

Cada una es una forma que el backend eligió a propósito. Un consumidor que la
ignora imprime un número **equivocado**, no algo feo.

- **Ausente, `null` y `0` son tres afirmaciones distintas.** Ausente significa que
  la pregunta no se hizo — la profundidad no la buscó. `null` significa que se
  hizo y no tiene respuesta. `0` significa que la respuesta es cero.
- **Una cifra faltante se renderiza como skeleton o guion, nunca como `0` ni
  `NaN`.**
- **Nunca reordenar, nunca resumar.** El rango se asigna en el servidor con un
  desempate explícito, así que dos peticiones idénticas no pueden intercambiar dos
  porciones iguales. Toda porción se toma contra la cifra que la tarjeta publicó,
  nunca contra una segunda suma sobre las mismas filas.
- **Toda razón es 0-1 con cuatro decimales** — `share`, `cumulativePercentage` —
  **excepto** `progress` del tablero de Pocket y `executionPercentage` del
  presupuesto, que son **tasas sobre 100**. Un componente que las mezcle imprime a
  cien veces el tamaño.
- **Una tasa es para mostrar y nunca para reconstruir un monto.** El helper
  compartido redondea a dos decimales sobre una escala 0-1: un punto porcentual de
  granularidad.
- **La ventana se lee de la respuesta, nunca se rearma del mes.** El mes en curso
  termina en la fecha de referencia, así que un período reconstruido en el cliente
  pondría dos finales distintos en una misma pantalla.
- **La etiqueta del mes es condicional al mes elegido.** Un mes cerrado se lee
  como el mes; el mes en curso se lee como mes a la fecha. El selector elige un
  mes entero en los dos casos: el arreglo es a la etiqueta, no al control.
- **La moneda vive en la sección, no en la app.** Cada tarjeta, el héroe, el
  snapshot y las metas publican su propio campo de moneda. Las filas de un listado
  traen la suya individualmente.
- **Los avisos son la frase al lado de la cifra.** Ahí ya están escritas "no hay
  ingreso contra el que tomar una tasa", "hay más comprometido que lo que tienen
  las cuentas" y "la pierna por pagar no llegó". Una tarjeta que renderiza cifras
  y descarta avisos pierde la explicación de cada guion que muestra. El arreglo de
  avisos **siempre está presente**, nunca ausente y nunca una cadena suelta.

---

## 7. Decisiones abiertas

Ninguna impide construir un componente. Las dos primeras deciden dónde se monta
un bloque; las demás se acuerdan cuando toca.

| decisión | las dos lecturas | quién decide |
|---|---|---|
| **si el cambio se publica también como tasa** | el monto ya está y está definido siempre; la tasa es más legible pero es nula en los dos casos que más importan | Carlos |
| **qué tarjeta es dueña del Pareto** | puede renderizar dentro de la tarjeta de gasto, o rutear a su propia pantalla | frontend, en P5 |
| **si las seis tarjetas rutean a seis pantallas o a tres** | inversión, deuda y pocket ya tienen módulo propio; ingreso, gasto y resultado realizado no | frontend, en P5 |
| **los tokens de color que faltan** | los bosquejos traían valores hex crudos, lo que se permite en un bosquejo y no en una hoja de estilos | se piden cuando se construye el bloque, nunca antes |
| **si el bloque de nivel 2 se comitea** | 16 archivos modificados y 10 sin seguimiento, 69 tests pasando, la rama 0/0 contra origen | Carlos |

**Cerrada el 2026-09-06 y sacada de esta tabla: la conciliación de inversión ya
tiene su tercer término.** Capital aportado más resultado realizado más **ajuste
por cierre** iguala el saldo del ledger, y §5.4 de este mismo documento ya lo
publica. La causa era de enumeración y no de aritmética, tal como decía la
lectura: borrar una cuenta de inversión escribe una fila de reversa que mueve el
saldo y no es ni aporte ni resultado, así que una identidad de dos términos
fallaba para todo dueño que hubiera borrado una cuenta y la tarjeta llamaba
inconsistentes a libros correctos. **Esta tabla la listaba como abierta porque
este documento se escribió contra la copia vieja del plan, y se contradecía con su
propia §5.4.**

**El servidor publica los cuatro campos y nunca la diferencia.** La resta es del
cliente y le cuesta una operación sobre campos que ya tiene; lo que el cliente no
puede reconstruir es la **tolerancia**, porque la comparación corre por la
librería decimal y una resta en punto flotante encuentra un centavo donde el
servidor no encontró ninguno. En nivel 2 la diferencia sí se publica, y viaja con
su tolerancia al lado.

---

## 8. Trampas ya pagadas

Registradas porque cada una produce **un número plausible y equivocado**, no un
error.

- **La trampa del signo.** El endpoint legacy emite la pierna por pagar
  **negativa**; este contrato la declara **magnitud positiva**. Invertirlo
  convierte una resta en una suma y sigue pareciendo razonable. La comprobación
  que lo atrapa es `netWorth − liquidNetWorth == receivable`: falla de inmediato
  en vez de producir un número plausible.
- **La trampa del cero con Decimal.** Probar positividad devuelve verdadero para
  cero, porque la prueba mira el **signo** y el cero tiene signo positivo. El
  guard correcto es un mayor-estricto.
- **La trampa de la conciliación.** Acotar por mes una de las tres consultas de
  inversión y no las otras dos convierte en silencio una comprobación que pasa en
  un aviso de falla permanente.
- **La trampa del piso antes de la suma.** El efectivo libre pisa el remanente
  **por cuenta** antes de sumar. Sumar primero deja que el excedente de una cuenta
  esconda el faltante de otra.
- **La trampa de la granularidad.** Una tasa redondeada a dos decimales sobre 0-1
  no puede reconstruir el monto del que salió.
- **La trampa de la tarjeta compartida.** Cinco tarjetas comparten forma y la
  sexta no comparte **ningún** campo de la base. Un componente compartido con
  excepciones imprime indefinido en cuatro lugares o revienta — y es la forma de
  falla que sobrevive a una revisión.

---

## 9. Verificación

| paso | comprobación |
|---|---|
| **P1a** | el saldo almacenado contra el derivado, por cuenta, **antes** de editar. Coincidir significa que el cambio es inerte y seguro |
| **P1b** | quince meses leídos sobre el único dueño con cuentas de inversión. El mes en curso vuelve idéntico a la consulta previa, cifra por cifra. La identidad falla por una fila de anulación, no por la acotación |
| **P2** | el total de pocket en Overview **iguala** el total del propio tablero para el mismo mes |
| **P3 héroe** | `netWorth − liquidNetWorth == receivable` en todo caso donde ambos se reportan |
| **P3 gasto** | gasto = categorizado + sin categorizar, en un mes que tenga gasto sin categorizar |
| **P3 deuda** | las piernas de la tarjeta coinciden **en magnitud** con las dos direcciones del endpoint legacy, difiriendo la de por pagar sólo en el signo |
| **P4 / P6** | los 69 tests de contrato del módulo pasan con `node --test "test/overview/*.test.js"` |
| **P5, por componente** | los tres estados de fetch distintos —skeleton, error con reintento, vacío— y ninguna cifra faltante impresa como `0` ni `NaN` |
| **todas** | pruebas unitarias importando los constructores directamente, sin base de datos. Prueba de arranque `APP LOADED OK` |
