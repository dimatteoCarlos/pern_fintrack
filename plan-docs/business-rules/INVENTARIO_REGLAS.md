# Inventario de reglas de negocio — pedido, definido, **sin construir**

**Estado: trabajo pendiente.** Este archivo **no es el inventario**. Es la
definición de qué forma tiene que tener, cómo se construye, y las pocas filas que
se pudieron medir de verdad el 2026-08-31, marcadas como semilla y no como
cobertura.

Se escribe así a propósito. Un inventario de autoridad a medio medir es peor que
ninguno: se consulta como si fuera completo, y una regla que falta se lee como una
regla que no existe.

---

## El problema que resuelve

**Las reglas de negocio están dispersas y no hay índice.** Medido, viven en tres
sitios distintos y por tres motivos distintos:

- **Hechos servidos**, decididos en los archivos núcleo del backend. Son la
  respuesta que la aplicación da; todo lo demás debería leerlos.
- **Umbrales de presentación**, que viven al lado de lo que los computa, en
  ayudantes del frontend. Están ahí por una razón buena —el umbral se escribe una
  vez, junto a lo que lo aplica, para que un cuadro no se encienda en un número
  mientras el borde de al lado pinta otro— pero eso los deja invisibles desde el
  backend.
- **Constantes de dominio**, repartidas en varios archivos de configuración.

**La consecuencia es la que importa: una regla implementada en más de un lugar no
se ve.** Hoy no hay forma de preguntar *¿dónde se decide esto?* sin abrir archivos
a mano, y ya hay al menos un caso donde dos módulos implementan la misma regla en
sentidos opuestos, cada uno con su argumento escrito, sin que ninguno de los dos
sepa del otro.

---

## La forma que tiene que tener

Un documento de autoridad, no un catálogo. **La columna que carga el peso es la
FUENTE DE VERDAD**: el único sitio donde la regla se decide. Todo lo demás la lee.

| columna | qué lleva |
|---|---|
| **Regla** | qué decide, en palabras, sin identificadores. *"Cuándo un bolsillo se considera cumplido"*, no `funded` |
| **FUENTE DE VERDAD** | archivo y línea del único sitio donde se decide. **Una sola.** Si hay dos, la fila está en conflicto y se marca |
| **Quién la lee** | cada consumidor, con archivo y línea. Es lo que vuelve visible la duplicación |
| **Tipo** | hecho servido, umbral de presentación, constante de dominio, o invariante de esquema |
| **Dónde está escrita** | el plan que la congela, si alguno. Una regla sin documento es una regla que nadie puede impugnar |
| **Estado** | única, **duplicada**, o **en conflicto** — y en conflicto significa que dos sitios dan respuestas distintas a la misma pregunta |

**La fila útil es la que sale mal.** Una regla con una sola fuente y tres lectores
está sana y el inventario no cambia nada sobre ella. Una regla con dos fuentes es
el hallazgo, y es lo que este documento existe para hacer visible.

---

## Cómo se construye, y por qué no se construyó hoy

**No se puede escribir por muestreo.** Un inventario incompleto que no declara su
propio hueco es una trampa, y este documento se niega a poner filas que no se
midieron. Lo que hace falta es recorrer, módulo por módulo, tres barridos:

1. **Los núcleos del backend** (`services/*_services/core/`), que es donde se
   deciden los hechos servidos. Cada función que devuelve una bandera o clasifica
   una fila es una regla.
2. **Los ayudantes de estado del frontend**, que es donde viven los umbrales de
   presentación, y los archivos de constantes.
3. **Las migraciones y el inicializador de runtime**, que es donde viven los
   invariantes que la base impone — y donde ya hay un riesgo conocido, porque el
   esquema está definido dos veces y producción se construye por la ruta de
   runtime.

**Costo estimado: un pase por módulo, y son siete módulos.** No entra en una
sesión, y partirlo por módulo es lo correcto: cada barrido deja el inventario más
completo sin dejarlo mentiroso, siempre que la cobertura se declare al principio.

---

## Filas semilla — medidas el 2026-08-31, y **nada más que éstas**

**Cobertura: cuatro reglas del módulo de bolsillos y una del de presupuesto. Cero
por ciento de los otros seis módulos.** Están aquí porque se midieron en el pase de
estado de ese día, abriendo cada archivo. No se agrega ni una fila por inferencia.

| Regla | FUENTE DE VERDAD | Quién la lee | Tipo | Estado |
|---|---|---|---|---|
| Cuándo un bolsillo se considera cumplido — comprometido **mayor o igual** a la meta | `backend/src/fintrack_api/services/pocket_services/core/makePocketStatus.js:128` | El nivel de presentación (`frontend/src/fintrack/helpers/pocketStatus.ts:100`), el encabezado del tablero (`PocketBigBoxResult.tsx:64`) y la tarjeta de próximo objetivo (`:98`) | hecho servido | única |
| Cuándo un bolsillo está vencido — sin días y por debajo de la meta | `makePocketStatus.js:129` | Las mismas tres | hecho servido | única |
| A cuántos días de su fecha un bolsillo empieza a alarmar — **30** | `frontend/src/fintrack/helpers/pocketStatus.ts:24` | Sólo el propio ayudante (`:111`) | umbral de presentación | única. **El modelo no tiene de dónde leerlo**: lo fijó el desarrollador, un ciclo de ingreso |
| A qué porcentaje de ejecución un presupuesto empieza a alarmar — **75** | `frontend/src/fintrack/helpers/budgetStatus.ts:24` | El propio ayudante (`:51`) y la lista de transacciones de la ficha de cuenta (`AccountTransactionsList.tsx:98`) | umbral de presentación | única |
| **Cómo se suma el faltante de varias metas** | **DOS, y dan cifras distintas** — ver abajo | — | hecho servido | **EN CONFLICTO** |

### La fila en conflicto, desarrollada

Es la única fila de este archivo que exige una decisión, y es el ejemplo de por qué
el inventario hace falta.

- **El módulo de bolsillos recorta el faltante por bolsillo antes de sumar**, y
  hace viajar el excedente por separado.
  `backend/src/fintrack_api/services/pocket_services/services/pocketBoardService.js:138-139`:
  el hueco entra a `remaining` sólo si es positivo, y si es negativo entra a
  `excess` negado. La razón está escrita en el encabezado que lo consume
  (`PocketBigBoxResult.tsx:201-209`): **para que un bolsillo sobrefinanciado no
  cancele a otro atrasado**. Por eso la identidad que imprime es
  `comprometido − excedente + restante = meta` y no una resta.
- **Overview suma plano.**
  `pern_fintrack_overview/backend/src/fintrack_api/services/overview_services/core/makeFinancialGoals.js`
  documenta que su faltante es una resta simple, que una meta ya superada aporta
  negativo y baja el total, y que **recortar informaría más trabajo pendiente del
  que hay**.

**Las dos posturas están razonadas y las dos no caben.** Con un bolsillo excedido
en 500 y otro atrasado en 500, bolsillos informa 500 por asignar y Overview informa
0. Un dueño que mire las dos pantallas ve dos respuestas a la misma pregunta.

**Decisión del desarrollador, no se cierra aquí.** Responden preguntas
legítimamente distintas —*cuánto falta poner* contra *cuánto falta en neto*— y lo
insostenible no es que existan las dos, es que se llamen igual en pantalla.
Anotada también en `ongoing/OVERVIEW_PLAN/OVERVIEW_DECISIONS.md` y en
`ongoing/ESTADO_PLANES.md`, secciones 8 y 10.

---

## Lo que este archivo NO afirma

- **No afirma que estas cinco sean las únicas reglas**, ni que sean las más
  importantes. Son las que se midieron.
- **No afirma nada sobre presupuesto, deudas, retrofecha, borrado de cuenta,
  unicidad de nombre, tracker ni Overview** más allá de la fila en conflicto.
- **No cierra ninguna decisión.** La única fila que pide una la deja abierta.

**Siguiente paso concreto:** el primer barrido completo de un módulo, y el
candidato es bolsillos — es el único cuyo núcleo, ayudante de estado y plan
congelado están los tres medidos y frescos, así que su inventario se puede escribir
entero en un pase y sirve de plantilla para los otros seis.
