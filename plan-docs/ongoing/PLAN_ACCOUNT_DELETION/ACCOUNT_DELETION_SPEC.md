# Borrado de cuentas — especificación y plan

Recopilación escrita el 2026-09-07. Reemplaza en función a los tres archivos que
la acompañan hoy en esta carpeta, que **no** recogen las decisiones de esta
jornada: `PLAN_ACCOUNT_DELETION.md`, `RESEARCH_LOG.md` y
`ACCOUNT_DELETION_METHODS.md`. Ninguno se borró todavía.

**En castellano, deliberadamente.** El resto de la documentación del repositorio
va en inglés. Este archivo no, por dos razones: consolida el expediente de
revisión externa `plan-docs/PROPUESTA_REDISENO_BORRADO_CUENTAS.md`, que Carlos
pidió expresamente en castellano, y su lector principal es Carlos, que corrige
estas páginas leyéndolas — de hecho la corrección más importante de este archivo
salió de que él leyó la versión anterior y detectó una atribución falsa.

---

## 0. La clave de lectura, que es lo primero de todo

Este archivo se escribió porque el anterior **presentaba como decisión de Carlos
algo que era una inferencia de un documento**. Concretamente: que RTA quedaba
retirada como método de borrado. Carlos nunca dijo eso, y el expediente del que
salió lo dice explícitamente al final de su propia sección:

> *"Si la anulación sobrevive como operación propia —escribe patas de
> corrección, o sea filas nuevas, y eso sí es compatible con la regla— **es una
> decisión separada de ésta**."*

O sea que el propio documento marcaba la pregunta como abierta y la lectura la
cerró. Por eso **toda afirmación de este archivo lleva marca de origen**, y la
marca es parte del contenido, no un adorno:

| marca | significa |
|---|---|
| **[C]** | **Palabras de Carlos.** Decidido. No se reabre sin él |
| **[⇒]** | **Se sigue necesariamente de una [C].** No es una elección de nadie: es lo que queda cuando se aplica su regla al código medido |
| **[M]** | **Medido en el código**, en `main`, abriendo el archivo. Es un hecho, no una opinión |
| **[?]** | **Abierto.** Inferencia, recomendación o conflicto. **Nadie lo puede cerrar salvo Carlos** |

**Regla de uso:** una fila **[?]** no se implementa, no se cita como si fuera
**[C]**, y no se "resuelve" leyéndola dos veces. Si aparece la tentación de
tratar una **[?]** como cerrada, ésa es exactamente la falla que este archivo
existe para impedir.

---

### 0.1 Términos y el identificador del código que les corresponde

**Regla global de Carlos, 2026-09-07: "no hablen en metaforas, utilicen los
nombres utilizados en los codigos."** Este documento está en castellano, así que
cada término conceptual va acá atado a su identificador real. Verificado el
2026-09-07: **los seis existen en el código**; ninguno nombra algo inventado.

| término en prosa | identificador real en el código |
|---|---|
| cuenta de compensación | cuenta con `account_name = 'slack'` y `account_type = 'boundary'` (`movementInputHandler.js:95-106`) |
| cola de eliminación | `eraseAccountTail.js`, sus cinco sentencias |
| descarte del residuo | política `DISCARD` del método `CLOSE` |
| transferencia del residuo | política `TRANSFER` del método `CLOSE` |
| remanente sin asignar | `unassigned` (`pocketDetailService.js:80`, `pocketAllocationService.js:351`) |
| porción comprometida | `committed` (`accountAllocationRepository.js:30`, `makePocketStatus.js:167`) |
| saldo derivado | `derivedAccountBalanceSql`, en `derivedBalance.js` |
| columna de saldo almacenada | `user_accounts.account_balance` |
| marca de desactivación / de eliminación | las columnas `deleted_at` y `closed_at` — **cuál lleva cuál es A2** |

**`user_accounts.account_balance` no se retira** (Carlos, 2026-09-07: *"yo
dejaria la columna, solo como informacion de consulta rapida, y para no hacer una
migracion para eliminar dicha columna, no obstante, es importante mantenerla
actualizada con el verdadero forma de calcularla"*). Ninguna migración la
elimina; debe coincidir siempre con `derivedAccountBalanceSql`. Nada de este
documento propone quitarla.

**Este módulo tiene el primer consumidor identificado de esa obligación, y es de
cara al usuario. [M]** En `deleteAccountService.js:376`,
`finalSlackBalance = parseFloat(slackRow.account_balance)` lee la columna
almacenada, donde `slackRow` es el `RETURNING ua.*` de
`setAccountBalanceFromLedger` invocado una sentencia antes (línea 369); y ese
número viaja al cliente como `data.finalSlackBalance` en la respuesta de éxito de
la reversión (`deleteAccountService.js:1133`). **No se convierte a derivación:**
la lectura ocurre una sentencia después de la escritura que rederivó esa misma
cuenta dentro de la misma transacción, así que el valor *es* la derivación. Lo
que cambia es el alcance de la regla de Carlos: si la columna deja de coincidir
con `derivedAccountBalanceSql`, esto no es higiene interna — el dueño ve un saldo
equivocado de la cuenta de compensación al terminar una reversión. Verificado en
el archivo, no relatado. La sesión `a6` retiró la fila de su plan que afirmaba
que ninguna respuesta fuera del detalle de cuenta publica esa columna.

**Regla acotada sobre `SELECT ua.*`, medida en este módulo. [M]** Un
`SELECT *` es inofensivo para una columna que existe y se está rederivando, y es
un generador de respuestas equivocadas en silencio para cualquier columna que
agregue una migración pendiente. El contraejemplo está en
`deleteAccountService.js:494-504`: `accountCheck` selecciona `ua.*`, de modo que
`accountCheck.rows[0].closed_at` es una lectura de propiedad; donde no corrió
`034_add_account_closed_at.sql` vale `undefined`, `undefined !== null` es
verdadero, y **todo borrado duro se rechaza** con un 400 que afirma que la cuenta
fue cerrada y liquidada cuando nunca lo fue. Una columna nombrada habría fallado
con error 42703, ruidoso. No se repara aquí: aflojar la comparación la convierte
en permiso justo en las bases donde el brazo por tipo del guardia de cuenta de
sistema está ciego, así que es decisión de Carlos.

---

## 1. Lo que Carlos decidió — sus palabras

| # | Decisión | Marca |
|---|---|---|
| C1 | La eliminación es **terminal dura**: la marca es irreversible, el dueño no tiene camino de vuelta | **[C]** |
| C2 | **La fila de `user_accounts` sobrevive siempre** | **[C]** |
| C3 | **Ningún movimiento histórico se borra ni se revierte** | **[C]** |
| C4 | **Desactivar exige saldo cero** | **[C]** |
| C5 | **La cuenta de compensación no debe ser accesible ni seleccionable** | **[C]** |
| C6 | **El borrado de la cuenta de compensación o del sistema no debe ser posible** | **[C]** |
| C7 | **No se puede dejar saldo negativo en cuentas de banco, inversión o categoría** | **[C]** |
| C8 | El privilegio de administrador para la reversión queda **suspendido**: está abierta al dueño | **[C]** |
| C9 | Las migraciones quedan **frenadas** hasta que estén definidos todos los procedimientos y sus implicaciones | **[C]** |
| C10 | **Congelamiento** de commits y escrituras sobre la superficie de borrado hasta acordar el definitivo | **[C]** |

## 2. Lo que se sigue necesariamente de esas decisiones

Esto **no es una propuesta**. Es lo que queda cuando se aplican C1–C4 al código
medido. No hay elección que hacer acá.

| # | Consecuencia | De dónde sale | Marca |
|---|---|---|---|
| E1 | **No existe el borrado físico de cuentas.** Ninguna operación quita una fila de `user_accounts` | C2 | **[⇒]** |
| E2 | **Las cinco escrituras de la cola de eliminación salen todas** — las dos que ponen las claves en NULL y reescriben la descripción, la que borra asignaciones de bolsillo, la que borra las transacciones propias y la que borra la cuenta | C3, C2 | **[⇒]** |
| E3 | **El método de borrado duro desaparece**: no era una política, era exactamente la cola de eliminación | E2 | **[⇒]** |
| E4 | **El camino actual de la reversión no puede sobrevivir tal cual**, porque termina en esa misma cola | E2 | **[⇒]** |
| E5 | **Desactivar y cerrar colapsan en una sola operación**: cerrar es lo que produce el saldo cero que desactivar exige | C4 | **[⇒]** |
| E6 | **La marca deja de ser el mecanismo de la terminalidad y pasa a ser sólo su registro**: si la fila sobrevive, lo que hace terminal a la eliminación es la irreversibilidad de la marca, no la desaparición de la cuenta | C1, C2 | **[⇒]** |

**El matiz de E4, que es donde estuvo el error.** Que el camino actual no
sobreviva **no** significa que la anulación se retire. Son dos cosas:

- La **cola de eliminación** que la reversión invoca al final: sale, por E2. Eso
  está cerrado.
- La **anulación en sí** —escribir asientos nuevos que corrigen el flujo en las
  contrapartes—: **escribe filas nuevas y no borra ni revierte ninguna
  histórica, así que es compatible con C3.** Su supervivencia como operación
  propia es una decisión abierta, y es de Carlos. Ver **A1** en la sección 3.

## 3. Lo que está abierto — y nadie salvo Carlos lo cierra

| # | Pregunta abierta | Opciones | Qué depende | Marca |
|---|---|---|---|---|
| **A1** | **¿La anulación sobrevive como operación propia?** Hoy es un método de borrado; podría ser una operación de corrección que escribe asientos y no borra nada | (a) sobrevive separada del borrado (b) se retira entera | Si existe o no una operación que toca cuentas de terceros. **Es la decisión de mayor alcance del módulo** | **[?]** |
| **A2** | **¿Cuántos estados de ciclo de vida, y qué columna lleva cada marca?** Reducida el 2026-09-07 | (a) un estado (b) dos estados —desactivar reversible, eliminar terminal— con `deleted_at` y `closed_at` repartidas | La forma del contrato de frontend y qué columna lleva cada marca | **[?] parcial** |
| ~~**A3**~~ | ~~¿Desactivar y eliminar dejan de escribir transacciones?~~ | **CERRADA 2026-09-07 por B3: no escriben nada. Verifican y refusan nombrando qué falta y dónde saldarlo** | El escritor de liquidación se retira; el descarte pasa a operación propia; no hace falta cláusula de fondos acá | **[C]** |
| **A4** | **¿C7 alcanza al remanente sin asignar, o sólo al saldo derivado?** Son dos cifras distintas y la resolución cierra una sola | (a) sólo el saldo derivado (b) también el remanente | Si un destino con bolsillos sobrecomprometidos se puede ofrecer | **[?]** |
| **A5** | **¿Se puede desactivar una cuenta de tipo flujo con total distinto de cero?** Su saldo no es dinero accesible | (a) sí, sin precondición (b) no | La precondición de saldo por tipo de cuenta | **[?]** |
| **A6** | **¿La reactivación está limitada por tipo de cuenta?** | (a) no (b) sí, y cuáles | El alcance de la operación de reactivar | **[?]** |
| **A7** | **¿Qué se hace con las filas que un borrado anterior ya desprendió?** Quedaron sin contraparte y el informe las descarta | (a) nada (b) reconciliación | Un pasivo contable ya existente | **[?]** |

**A2 no es una laguna, es un choque.** La cancelación de las columnas es una
inferencia del expediente, **no palabras de Carlos**; su resolución explícita las
compromete. Una sesión que elija un lado está resolviendo por él — ya pasó.

---

## 4. Cómo trabajan los métodos instalados hoy

Todo medido en `main` abriendo el archivo. **[M]** en bloque.

### 4.1 Entrada común

| Elemento | Valor |
|---|---|
| Ruta | `DELETE /api/fintrack/account/delete/:targetAccountId` |
| Selector | `req.query.type` **o** `req.body.deletionType` — el controlador acepta los dos |
| Métodos expuestos | `SOFT`, `HARD`, `RTA`, `CLOSE` |
| Vistas previas | `GET /delete/assessment/:id`, `/delete/report_of_affected_accounts/:id`, `/delete/close_preview/:id` |
| Atomicidad | Cada método corre dentro de una transacción de base de datos |
| Guarda de cuenta de sistema | 403, **antes** de la bifurcación, cubre los cuatro métodos |

### 4.2 Los cuatro métodos

| Método | Qué hace | Compuerta de saldo | Toca terceros | Destruye historia |
|---|---|---|---|---|
| **SOFT** | Pone fecha en una columna. Oculta la cuenta **sin saldar su saldo** | No | No | No |
| **HARD** | Ejecuta la cola de eliminación | **Sí**, 409 si el saldo no es cero | No | **Sí** |
| **RTA** | Escribe asientos de reversión en cada contraparte, después ejecuta **la misma cola** | **No, ninguna** | **Sí** | **Sí** |
| **CLOSE** | Liquida el residuo por transferencia o descarte, después pone fecha | Verifica residuo | Sí, la cuenta destino | No |

**La incoherencia central de lo instalado:** `HARD` refusa con 409 una cuenta con
saldo distinto de cero **y su propio mensaje de error deriva al dueño hacia
`RTA`**, que llega al mismo borrado sin ninguna compuerta. Es una sola operación
alcanzable por dos entradas, con compuerta en una sola de ellas.

### 4.3 El flujo de la reversión, paso por paso

| # | Paso | Detalle medido |
|---|---|---|
| 1 | Resuelve la cuenta de compensación | Busca por nombre exacto **y** tipo de frontera; si no existe, **la crea** |
| 2 | Calcula el informe de impacto | **Recalculado dentro del bloqueo**, nunca la copia que mandó el cliente |
| 3 | Bloquea y deriva saldos | `FOR UPDATE` ordenado por id, sobre contrapartes ∪ {compensación, objetivo}. **Saldos derivados del libro, no la columna almacenada** |
| 4 | Escribe las anulaciones | Un par por contraparte: `+ajuste` en ella, `−ajuste` en la de compensación |
| 5 | Reescribe las columnas de saldo | Desde el libro, no desde lo que predijo |
| 6 | **Ejecuta la cola de eliminación** | **En las dos ramas, sin ninguna compuerta** |

El paso 3 existe por algo medido: **la columna almacenada había divergido del
libro** —la cuenta de compensación leía −75,97 guardado contra −90,22 derivado—,
así que cada corrección se construía sobre un punto de partida equivocado.

### 4.4 Qué filas entran al informe de impacto

| Regla | Efecto |
|---|---|
| Filtro por cuenta dueña | Cada transferencia aporta **una sola pata** |
| Contraparte | La otra columna de la fila |
| Comparación nula-segura | Una desigualdad simple descartaría filas reales |
| Filtro de estado `complete` | El comentario del archivo dice *"sin efecto hasta ahora"* |
| JOIN interno | **Descarta las contrapartes en NULL** |

### 4.5 La cola de eliminación, sus cinco escrituras

| # | Escritura | Efecto |
|---|---|---|
| 1-2 | Pone en NULL las dos claves de contraparte y sustituye el nombre en la descripción | Desprende filas de **otras** cuentas |
| 3 | Borra las asignaciones de bolsillo | **Destruye** el único registro de esos compromisos |
| 4 | Borra las transacciones propias | **Destruye** su historia entera |
| 5 | Borra la fila de la cuenta | La cuenta desaparece |

Las dos primeras existen sólo para que la quinta no choque contra las claves
restrictivas de la migración 018.

### 4.6 Lo que el algoritmo sí hace bien

Verificado; **no se vuelve a auditar**. **[M]**

Convención de signos, cardinalidad de filas, orden de bloqueos, ventana entre
lectura y escritura cerrada, fecha puesta por el servidor, aritmética decimal
exacta y comparación nula-segura: **todo correcto**.

**Lo que está mal en la reversión no es cómo calcula. Es qué decide tocar.**

---

## 5. Las objeciones medidas

Ordenadas por gravedad. La última columna es la que decide si la objeción se
archiva con el método o sigue viva después — y **eso depende de A1**.

| # | Objeción | Qué pasa | Gravedad | ¿Vive si A1 sale por (b)? |
|---|---|---|---|---|
| **O1** | Destruye historia | Las escrituras 3, 4 y 5 borran filas. Choca de frente con C3 | **Fatal** | No: la cola sale por E2 igual |
| **O2** | **Fuga al patrimonio publicado, en forma cerrada** | El patrimonio baja exactamente por: las filas de la objetivo que enfrentan a la cuenta de compensación, **más** las que no enfrentan a nadie. Todo lo demás preserva valor | **Alta** | **Sí, como pasivo**: dejar de producir fugas no revierte las escritas |
| **O3** | Sin compuerta de saldo | Ver 4.2 | **Alta** | No |
| **O4** | **La cuenta de compensación se identifica por NOMBRE** | El endpoint de edición no tiene guarda de sistema: el dueño la puede renombrar. Renombrada conserva su tipo y **entra al patrimonio que el dashboard muestra hoy** | **Alta** | **Sí, entera.** No involucra a la reversión en nada |
| **O5** | La migración de tipo no detecta el renombrado | Reidentifica por el mismo nombre exacto: sobre una base renombrada no toca nada y **reporta un éxito idéntico al de una base limpia** | **Alta** | **Sí** |
| **O6** | El 403 que protege la cuenta de compensación **recomienda romperla** | Su texto termina diciéndole al dueño que la renombre si es suya | Media | **Sí** |
| **O7** | La anulación se tipa como movimiento de pérdidas y ganancias | Una reversión no es una ganancia. Sólo un prefijo de texto la mantiene fuera del resultado realizado | Media | Depende de A1 |
| **O8** | La identidad viaja en cadenas mutables | El nombre dentro de una descripción, y el nombre como referencia del sistema. Un `UPDATE` de texto rompe los dos, en silencio | Media | **Sí** |
| **O9** | Filtro de estado incoherente | El informe filtra por `complete`; el saldo derivado y **ninguna consulta de Overview** filtran nada | Baja | Depende de A1 |
| **O10** | **Segundo escritor de movimientos ajenos** | Saldar una deuda es de Deudas, liquidar una inversión es de Inversión. Al reimplementarlos **esquiva la comprobación de fondos** del controlador de transacciones | **Alta** | **Sí**: aplica también a cerrar |
| **O11** | La restricción de bolsillos no protege nada | La escritura 3 vacía las filas antes de que la clave restrictiva pueda dispararse | Media | No |
| **O12** | Ninguna migración correctiva puede reparar O5 | Está publicada, el proyecto no admite correctivas, y no habría clave de selección honesta | — | **Sí**: obliga a reconciliación a mano |

### 5.1 Por qué la compuerta de saldo NO era el arreglo de O3

Copiar el rechazo del borrado duro dentro de la reversión **refusaría toda cuenta
abierta con fondos**: el residuo de esa cuenta **es** su monto inicial, y la
anulación no tiene a dónde moverlo.

### 5.2 Objeciones levantadas y retiradas

Se listan porque el argumento que las cerró vale más que la objeción.

| Retirada | Por qué se cayó |
|---|---|
| "La migración de tipo abre la exposición" | La exclusión es por **nombre**, con o sin migración. La exposición está **viva hoy** — sube la gravedad, no la baja |
| "El buscador devuelve el id de la cuenta de compensación" | El nombre de cuenta no está entre los campos que la consulta compara. La accesibilidad se sostiene por un camino más corto: ids secuenciales y un endpoint que toma el id en la URL |
| "La reescritura y el borrado apuntan a columnas distintas" | Un `grep` cortó la línea de continuación |
| Fecha de anulación provista por el cliente | La pone el servidor |
| Interbloqueo entre borrados concurrentes | El bloqueo está ordenado por id |
| Aritmética de punto flotante | La columna es decimal exacta |
| La respuesta etiqueta la reversión como borrado blando | La reversión tiene su propio bloque de respuesta y retorna antes del formateador compartido |

---

## 6. Cómo deben trabajar los métodos

### 6.1 El mapa de destino

| Método de hoy | Destino | Marca |
|---|---|---|
| `HARD` | **Desaparece** — era la cola de eliminación | **[⇒]** |
| `SOFT` | **Converge** con cerrar | **[⇒]** |
| `CLOSE` | **Converge** con desactivar | **[⇒]** |
| `RTA` | **Su camino actual no sobrevive** (termina en la cola). **Si la anulación sigue existiendo como operación propia es A1, y es de Carlos** | **[⇒]** + **[?]** |

### 6.2 Las operaciones que quedan

| Operación | Qué hace | Reversible | Exige saldo cero | Escribe en el libro |
|---|---|---|---|---|
| **Desactivar** | La cuenta deja de ofrecerse al crear movimientos. Ése es el efecto completo | **Sí** | Sí | Nada, si ya es cero |
| **Eliminar** | Se retira definitivamente. La fila sobrevive; la marca es irreversible | No | Sí | Nada, si ya es cero |
| **Deshacer la creación** | Revierte la apertura contra su contraparte real, con un asiento nuevo y fechado | No aplica | El saldo es el inicial | La anulación de la apertura |
| **Anular** (sólo si A1 sale por (a)) | Escribe asientos de corrección en las contrapartes. **No borra nada** | No | — | Los asientos de corrección |

**Deshacer la creación no es un caso de borrado, y ésa es la razón de que
exista.** Que una cuenta abierta con fondos y sin uso posterior sea hoy borrable
sin compuerta no es un dato que decida nada: lo decide la intención del dueño.
*"Quiero sacar esta cuenta"* es Eliminar y pasa por la compuerta como cualquier
otra; *"me equivoqué al crearla"* es Deshacer la creación. Separarlas en dos
operaciones nombradas disuelve la incoherencia de 4.2 sin necesidad de elegir
cuál rama era la correcta.

### 6.3 El flujo de una disposición

Tres pasos, y **el orden es obligatorio en las dos direcciones**:

| # | Paso | Por qué no puede ir en otro lugar |
|---|---|---|
| 1 | **Liberar las asignaciones de bolsillo**, escribiendo las filas negativas que las compensan | Liberar después de disponer mediría la liberación contra un saldo que ya se fue |
| 2 | **Disponer del saldo**: transferencia a una cuenta que el dueño elige, o descarte contra la de compensación | Disponer sin liberar movería también la porción comprometida |
| 3 | **Sellar la marca** | — |

**La liberación pasa por el escritor del módulo de bolsillos, nunca por una
sentencia escrita dentro del borrado.** Esa tabla es sólo-agregar: una corrección
es una fila nueva de signo opuesto. Una sentencia a mano acá reproduce las filas
y no la regla, y Overview y el tablero de bolsillos quedarían en desacuerdo sobre
el mismo mes, **los dos pareciendo correctos**.

### 6.4 Casos borde de desactivar

| # | Caso | Qué hace | Qué se le muestra |
|---|---|---|---|
| 1 | Saldo cero | Desactiva | Confirmación simple |
| 2 | Saldo distinto de cero | **No desactiva**: pide disposición primero | El saldo, y que no se podrá sin resolverlo |
| 3 | Ningún destino con fondos suficientes | Ofrece **sólo descarte** | Que ningún banco puede cubrirlo, **y cuánto falta** |
| 4 | Hay destinos, todos comprometidos | Los ofrece **todos**, ninguno recomendado | Por cada uno: saldo, comprometido y no asignado, **las tres juntas** |
| 5 | El destino queda con bolsillos sin respaldo | Lo permite, **enunciándolo** | Cuáles y por cuánto |
| 6 | La cuenta tiene asignaciones | Las libera con filas negativas | Qué bolsillos pierden respaldo |
| 7 | Es la cuenta de compensación | **Refusa, 403** | Que es del sistema. **El mensaje NO ofrece renombrarla** |
| 8 | Tipo no creable por el usuario | Refusa, 403 | Ídem |
| 9 | Reactivar | Limpia la marca | Que vuelve en **cero**: la disposición no se deshace |
| 10 | Sale de los indicadores | Sale | Por saldo cero, **sin tocar ninguna consulta de Overview** |
| 11 | Otra operación commitea en el medio | Refusa y no escribe | Que su vista estaba vencida |

**El caso 10 es el argumento más fuerte del rediseño.** Hay 88 referencias a la
tabla de cuentas en 29 archivos. Sin la precondición de saldo cero, cada una
tendría que decidir si filtra la marca, y equivocarse en cualquiera devuelve el
ocultamiento por otra puerta. **Con la precondición, una cuenta desactivada
aporta cero a cualquier total**, así que filtrarla o no da el mismo número: la
decisión **deja de existir** en 87 de los 88 sitios. No resuelve el problema
consulta por consulta — lo vuelve irrelevante.

### 6.5 Las reglas transversales

| Regla | Dónde se implementa | Estado |
|---|---|---|
| Ninguna cuenta que paga queda en negativo | **Una cláusula en un solo lugar**: la consulta de destinos sirve al selector y al validador de escritura a la vez | **[C]** sobre el saldo derivado |
| C7, sin saldo negativo en banco, inversión ni categoría | Ídem | **[C]** sobre el saldo derivado; **[?]** sobre el remanente — ver A4 |
| La cuenta de compensación no es accesible ni seleccionable | Guardia de dos brazos en `deleteAccountService.js:1015-1026` — **sólo en la escritura** | **[C]**, y **dos huecos medidos**, abajo |

#### Los dos huecos de la regla de la cuenta de compensación [M]

Ambos están en el camino de cierre y ambos son míos. La regla ya la decidió
Carlos —*"el borrado de la cuenta boundary de compensacion, o del sistema, no
deberia ser posible"*—, así que esto es trabajo retenido por el congelamiento de
escritura, no una decisión abierta.

1. **La vista previa de cierre no tiene guardia, de ninguna clase.**
   `getCloseAccountPreview` (`accountDeleteController.js:145`) acepta cualquier
   `targetAccountId` del dueño, y `CLOSING_ACCOUNT_QUERY`
   (`getClosePreview.js:58-71`) filtra por dueño, por `deleted_at` y por
   `closed_at`, y por nada más. La cuenta de compensación lleva el `user_id` del
   dueño, así que pasa: la pantalla mostraría su remanente y su lista de
   destinos. El guardia existe una capa más adentro, en la escritura, y esta es
   otra superficie que publica la misma regla.
2. **La consulta de destinos excluye por tipo y no tiene brazo por nombre.**
   `ELIGIBLE_DESTINATIONS_QUERY` (`getCloseTransferDestinations.js:62-86`) filtra
   `act.account_type_name = 'bank'` y descansa en que
   `031_add_boundary_account_type.sql` haya retipado la cuenta a `'boundary'`.
   El encabezado del archivo lo dice con todas las letras. Y esa consulta es a la
   vez el selector y el validador de la escritura, por diseño, así que **no hay
   segunda compuerta**: lo que se ofrece es lo que se acepta.

**Ninguno de los dos es alcanzable en una base construida por la cadena, y es
por accidente. [M]** Las dos consultas nombran `ua.closed_at` en SQL, columna que
agrega `034_add_account_closed_at.sql`; el corredor de migraciones ordena los
archivos por nombre y lanza excepción al primer fallo (`runMigrations.js:92` y
`:119`), de modo que una base sin 031 tampoco tiene 034 y ambas consultas fallan
ruidosamente con 42703 antes de ofrecer nada. La máscara desaparece exactamente
cuando se ejecuta P2.

**Corrección de alcance, de la sesión `23`, verificada: la máscara vive en un
solo camino de construcción. [M]** El DDL de arranque declara `closed_at` en la
definición misma de `user_accounts` (`createTables.js:78`) y la agrega a una
tabla existente (`createTables.js:800`), así que una base construida por arranque
tiene la columna sin haber corrido nunca la 031: no hay 42703 y las dos consultas
se ejecutan. Escribí "hoy ninguno es alcanzable" sin decir que hablaba de la
cadena; es el mismo error de alcance que corregí en un peer esta misma sesión.
**Pero la exposición no queda suelta ahí**, y esto acota la conclusión de `23`:
`populateDB.js:260` siembra el tipo `boundary` (id 8), así que en una base de
arranque `checkAndInsertAccount` crea la cuenta de compensación ya tipada
`boundary` y el filtro por tipo del hueco 2 **funciona**. Lo que hace falta es
una fila heredada tipada `bank` — que es justo la población que la 031 existe
para arreglar y la que salta cuando fue renombrada. Reproducible en local, sí,
pero **construyendo esa fila**, no de fábrica.

**El renombrado está abierto hoy, y por la pantalla, no sólo por petición. [M]**
Medido a pedido de la sesión `a6`, que planteó la pregunta y no la había medido.
No es mi módulo —`accountEditController.js` es de otro dueño— pero decide la
gravedad de todo lo anterior, así que lo dejo aquí:

- La ruta `account/:accountId/edit` existe en el enrutador y renderiza
  `EditAccount`, que toma el id de `useParams`. **Ninguna lista es guardia**: la
  cuenta nunca tiene que aparecer en un listado para llegar a la pantalla.
- `getAccountById` (`getAccountController.js:739-751`) no excluye a la cuenta de
  compensación por nombre. Tiene una **lista blanca de seis tipos** que no
  incluye `'boundary'`, así que **después de la 031** devuelve 404 y la pantalla
  no carga — un guardia accidental, de un solo brazo y en otro controlador.
- **Antes de la 031 la cuenta está tipada `bank`**, pasa la lista blanca, la
  pantalla carga, y `patchAccountById` acepta `account_name` sin ningún guardia
  de cuenta de sistema (`accountEditController.js`, cero menciones de `slack` o
  `boundary`; verificado).

Es decir: **la ventana en que el renombrado es alcanzable por la interfaz
publicada es exactamente la ventana en que produce daño** —antes de la 031, que
es producción hoy—, y la cierra por accidente una lista blanca de tipos que vive
en un controlador que nadie escribió pensando en esta regla.

**El riesgo que sobrevive a la migración es el renombrado, no la ausencia. [M]**
031 retipa con `WHERE account_name = 'slack' AND account_type_id = 1`, exacto y
sensible a mayúsculas. Una cuenta de compensación renombrada a mano no se retipa,
031 **igual reporta éxito**, la cadena sigue hasta 034, y desde ahí queda
ofrecida como destino elegible del remanente de una cuenta que se cierra —
donde un brazo por nombre tampoco la habría salvado, porque el nombre es lo que
cambió. Esto **ata P1 con P2**: dejaron de ser independientes. P1 no es sólo
cuadrar el saldo a mano antes de 031; es **verificar que el nombre sea
exactamente `slack`**, porque si no lo es, P2 vuelve alcanzable el hueco 2 de
forma permanente.

#### La elegibilidad de destino no coincide con su regla hermana [M]

Encontrado al verificar un hallazgo de la sesión `23` sobre una lista de tipos
que se quedó corta. El mío no es una deriva, es una decisión con una condición de
vencimiento que nadie escribió.

`TRANSFER_DESTINATION_ACCOUNT_TYPE = 'bank'`
(`getCloseTransferDestinations.js:42`) admite **un solo tipo**. La pregunta que
contesta —qué cuentas pueden recibir y mover dinero real del dueño— ya la
contestó otro módulo, y contestó distinto: `ELIGIBLE_SOURCE_TYPES =
['bank', 'cash']` decide qué cuentas pueden respaldar un pocket
(`pocketAllocationService.js:56`), y `ACCOUNTS_WITH_UNASSIGNED_CASH` es el mismo
par (`accountAllocationService.js:23`). Los lectores de saldo coinciden:
`IN ('bank', 'cash')` en `overviewPageRepository.js:84`. **Cuatro sitios en tres
módulos tratan a `cash` como par de `bank`; el cierre no.**

Hoy no se nota: ninguna ruta crea una cuenta `cash`
(`USER_CREATABLE_ACCOUNT_TYPES` la permite, el frontend no la ofrece). El día que
`cash` exista, una cuenta de efectivo no podrá recibir el remanente de una cuenta
que se cierra, sin que ninguna regla escrita diga por qué. **No lo cambio**: la
elegibilidad la congeló Carlos el 2026-09-07 y sólo él la abre. Queda como fila
bloqueante.

### 6.6 La corrección pendiente que más código retira — A3

| Aspecto | Hoy **[M]** | Bajo la recomendación **[?]** |
|---|---|---|
| Quién escribe el movimiento | El módulo de borrado | El módulo dueño: Deudas salda, Inversión liquida |
| Comprobación de fondos | **No corre**: el escritor la esquiva | Corre sola, en el camino normal |
| Con saldo distinto de cero | Lo liquida él | **Refusa nombrando qué falta y dónde**: *"esta cuenta debe 500; saldala desde Deudas"* |
| Cláusula de fondos acá | Necesaria | **Deja de hacer falta** |
| Descarte | Lo escribe el módulo | **Sobrevive**: no es un pago, es un par contra la de compensación |

**El matiz medido:** el escritor de liquidación **no desaparece**. La misma
función sirve transferencia y descarte, y el descarte sobrevive. Se retira una
rama, no un archivo.

---

## 7. Cómo se implementa

### 7.1 Las dos precondiciones que no son código

| Precondición | Quién | Por qué es previa |
|---|---|---|
| **Reconciliación a mano de la cuenta de compensación en producción**, antes de correr la migración de tipo | Carlos | La migración registra el retipado como hecho aunque no haya movido nada, y después nada vuelve a visitar esas cuentas. **No hay archivo posterior que lo repare** |
| **La cadena de migraciones llega a la marca de cierre antes del próximo despliegue del backend** | Carlos | Si no, el camino de lectura de cuentas falla en producción sobre una columna que no está |

### 7.2 El orden de construcción

La regla: **primero lo que no depende de las decisiones abiertas**, y dentro de
eso, primero lo que protege una cifra que alguien mira hoy.

| Bloque | Qué incluye | Depende de |
|---|---|---|
| **B1 — Guarda de la cuenta de compensación** | Guarda de sistema en el endpoint de edición, con sus dos brazos, **antes** de la bifurcación. Retirar el texto del 403 que invita a renombrarla | **Nada.** Independiente de A1, A2 y A3 |
| **B2 — Reserva del nombre en la creación** | Que ninguna cuenta de usuario pueda nacer con el nombre reservado | Nada |
| **B3 — Retiro de la cola de eliminación** | Comentar las cinco escrituras y sus dos invocadores | Nada más que E2, que ya está |
| **B4 — Sentencia de reactivación** | La sentencia que devuelve la marca a NULL. **Hoy no existe en ningún lugar del backend** | A2 |
| **B5 — Registro de eventos** | **En el mismo paso que B4, nunca después** | A2 |
| **B6 — Refusar en vez de liquidar** | Verificar y refusar nombrando dónde saldar | A3 |
| **B7 — Columnas de nombre de contraparte** | Una sola migración, columnas nulables para siempre | A2, y C9 |
| **B8 — Pantallas** | Lista de desactivadas y su acción de reactivar | A2 |
| **B9 — Destino de la anulación** | Lo que A1 decida | **A1** |

**Por qué B4 y B5 van juntos y no en dos pasos:** reactivar devuelve la marca a
NULL, y en ese instante **no queda registro en ninguna parte de que la cuenta
estuvo desactivada**. La marca es el estado, nunca la historia. Una marca
reversible no puede ser su propia evidencia, así que reactivación sin registro de
eventos borra en silencio el registro de la desactivación.

**Por qué B1 es lo primero aunque parezca menor.** Es la única objeción viva con
consecuencia hoy: el nombre protege una cifra que una persona está mirando en el
dashboard desplegado. Es la que, una vez rota, no deja de dónde recuperarse —los
agregados, el resolvedor y la migración pierden el mismo anclaje juntos— y es
mucho más barata: una guarda en un endpoint, copiada de la que este mismo módulo
ya tiene.

### 7.3 Lo que se cancela antes de escribirse

| Trabajo | Estado | Por qué |
|---|---|---|
| Migración correctiva de la migración de tipo | **Cancelado** | Publicada, sin correctivas, y sin clave de selección honesta |
| Compuerta de saldo dentro de la reversión | **Cancelado** | Refusaría toda cuenta abierta con fondos |
| Cláusula de fondos dentro del módulo de borrado | **Cancelado si A3 sale por (a)** | No quedaría ningún pago fuera del camino normal |
| Columna nueva para el estado terminal | **Cancelado** | Las dos que hay alcanzan bajo la reasignación recomendada |

**En un esquema que no admite migraciones correctivas, cancelar antes de escribir
es la única cancelación barata que existe.**

### 7.4 Restricciones vigentes

| Restricción | Alcance |
|---|---|
| **Congelamiento de escritura y commit** (C10) | Nada se comitea ni se escribe en la superficie de borrado — tampoco una corrección de comentario ni un texto de error |
| **Suspensión de migraciones** (C9) | Ninguna migración del rediseño se escribe |
| **No se borra código** | Se deja comentado |
| Sin push | — |

---

## 8. Decisiones bloqueantes, una línea cada una

| # | Decisión | Quién |
|---|---|---|
| **A1** | ¿La anulación sobrevive como operación propia, separada del borrado? | Carlos |
| **A2** | ¿Uno o dos estados de ciclo de vida, y qué columna lleva cada marca? (reducida: las columnas de contraparte ya no hacen falta) | Carlos |
| ~~A3~~ | ~~¿Dejan de escribir transacciones?~~ **Cerrada 2026-09-07: no escriben, refusan** | — |
| **A4** | ¿La regla de no-negativo alcanza al remanente sin asignar o sólo al saldo derivado? | Carlos |
| **A5** | ¿Se puede desactivar una cuenta de tipo flujo con total distinto de cero? | Carlos |
| **A6** | ¿La reactivación está limitada por tipo de cuenta? | Carlos |
| **A7** | ¿Qué se hace con las filas que un borrado anterior ya desprendió? | Carlos |
| **A8** | El rechazo de todo borrado duro donde falta `closed_at`: aflojar la comparación es permiso justo donde el guardia de cuenta de sistema está ciego por tipo (§0.1) | Carlos |
| **A9** | ¿La liberación de asignaciones del borrado de cuentas pasa por el escritor del módulo de pockets, en vez del `DELETE FROM pocket_allocations` directo de `eraseAccountTail.js:97`? | Carlos |
| **A10** | ¿Se prohíbe renombrar la cuenta de compensación? Hoy nada lo impide y el renombrado es lo que derrota todos los filtros por nombre (§6.5) | Carlos |
| **A11** | ¿Una cuenta de efectivo puede recibir el remanente de un cierre? Cuatro sitios en tres módulos ya tratan `cash` como par de `bank`; la elegibilidad de destino admite sólo `bank` (§6.5) | Carlos |
| **P1** | Reconciliar a mano la cuenta de compensación en producción antes de la migración de tipo — **y verificar que su nombre sea exactamente `slack`**, o el retipado la salta en silencio y el cierre la ofrece como destino (§6.5) | Carlos |
| **P2** | Llevar la cadena de migraciones a la marca de cierre antes del próximo despliegue | Carlos |
| **P3** | Borrar `RESEARCH_LOG.md` (209 KB, histórico, sin referencias): el clasificador de permisos del entorno bloqueó los dos intentos | Carlos |

---

## 8.1 Resoluciones de Carlos del 2026-09-07 sobre el cierre (B2–B8)

Preguntas suyas, numeradas por él. **Fijan A3 y disuelven la mitad de A2.**

| # | Pregunta | Resolución | Marca |
|---|---|---|---|
| **B2** | ¿Exige saldo cero? | **Sí, fijado.** `balance ≠ 0` no permitido; `balance = 0` permitido | **[C]** |
| **B3** | ¿Mueve dinero por sí mismo? | **No, nunca.** Valida el saldo, registra el evento, sella la marca. La disposición del saldo la hace el dueño antes, por los módulos que corresponden | **[C]** — cierra **A3** por la opción (a) |
| **B4** | ¿Las transacciones quedan intactas? | **Sí, intactas** | **[C]** |
| **B5** | ¿Se toca la descripción? | **Nunca.** Principio absoluto | **[C]** |
| **B6** | Registro del cierre | Tabla de eventos de ciclo de vida, **con** clave foránea a `user_accounts` y **sin** snapshot de atributos | **[C]** + **[⇒]** |
| **B7** | ¿Justificación obligatoria? | **Opcional.** La fila de evento es obligatoria; el texto no | Recomendación aceptada |
| **B8** | ¿Operación independiente? | **Una sola acción, siempre habilitada.** El mensaje de rechazo es la guía de preparación | Recomendación aceptada |

### Las tres consecuencias que no son obvias

**B3 saca el descarte del cierre.** La política `DISCARD` también mueve dinero
—escribe un par contra la cuenta `'slack'`—, así que bajo B3 deja de ser una rama
interna del cierre y pasa a ser **una operación propia que el dueño invoca**
antes de cerrar. No desaparece; se hace visible. Y la comprobación de fondos que
hoy el módulo esquiva al reimplementar la escritura vuelve al camino normal sola,
sin cláusula nueva.

**B4 se contradice con la regla que la acompañaba, y gana B4.** Poner
`source_account_id → NULL` **es** modificar una fila histórica, así que "quedan
intactas" y "la clave se anula" no pueden ser ciertas a la vez. La anulación de
la clave existía únicamente para desprender referencias antes de `DELETE FROM
user_accounts`, y ese `DELETE` no ocurre: la fila sobrevive. Con la fila viva la
clave apunta a un registro real y **las columnas de nombre de contraparte no
hacen falta** — el nombre sale del join. Eso disuelve la mitad de A2; lo que
queda abierto de A2 es sólo cuántos estados hay y qué columna lleva cada marca.

**B5 se puede hacer más fuerte que un principio.** Medido: las **dos únicas
sentencias `UPDATE transactions` de todo `backend/src`** están en
`eraseAccountTail.js`. Al retirarlo, la tabla queda sin ningún escritor de
modificación. No es una regla que alguien deba recordar: es una tabla que ningún
código sabe modificar.

**B6 depende de que la fila sobreviva, y por eso cambia de forma.** El snapshot
de tipo, moneda y nombre se diseñó para un mundo donde `user_accounts` pierde la
fila. Como no la pierde, el snapshot duplicaría columnas vivas y los duplicados
se desincronizan. La clave foránea, que en ese diseño era imposible, acá es
correcta. **La tabla sigue haciendo falta igual:** `deleted_at` y `closed_at` son
estados, no historia — reactivar devuelve la columna a NULL y el hecho de que la
cuenta estuvo desactivada desaparece sin dejar rastro. Por eso el registro de
eventos entra **en el mismo paso que la reactivación, nunca después**.

---

## 9. Qué pasó con los otros archivos de esta carpeta

Ejecutado el 2026-09-07. **Nada se comiteó**: el congelamiento sigue en pie, así
que todo esto es reversible con un solo `git checkout` de la carpeta.

| archivo | qué se hizo | por qué |
|---|---|---|
| `ACCOUNT_DELETION_SPEC.md` | **Es este archivo.** El plan vigente | — |
| `PLAN_ACCOUNT_DELETION.md` | **Conservado y degradado.** Lleva ahora una cabecera que dice que ya no es el plan y que lo que sirve de él es la medición fechada | **No se puede borrar:** tiene 855 líneas escritas hoy, sin comitear, que no existen en ningún otro lado — la guarda de cuenta de sistema con sus dos brazos, RTA sin compuerta de cero, el camino de cierre ofreciendo tipos que los totales no cuentan, y las correcciones a la propuesta de rediseño |
| `ACCOUNT_DELETION_METHODS.md` | **Vaciado y convertido en redirección**, de 11 KB a una tabla de a dónde fue cada cosa | Declaraba la ruta mal en sus tres métodos. **No se borra** porque un comentario de `accountDeleteController.js` lo cita, y el backend está congelado para escritura, así que esa cita no se puede corregir todavía |
| `RESEARCH_LOG.md` | **Pendiente de borrar.** 209 KB | Su propia cabecera lo declara histórico y nada lo referencia — ni en `plan-docs` ni en `backend`, medido. **El intento de borrarlo fue bloqueado por el clasificador de permisos del entorno**, no por una regla del proyecto |

**Está versionado**, así que borrarlo no pierde nada: queda entero en la historia
del repositorio y vuelve con un `git checkout`.

Los dos archivos de los que sale esta recopilación —el expediente de revisión
externa y el documento de estado y plan medido— **están fuera de git**. Su
pérdida sí sería definitiva, y por eso ninguno se toca.
