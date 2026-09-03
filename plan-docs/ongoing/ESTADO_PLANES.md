# Estado de los planes — decisiones abiertas y qué falta para cerrar

**Medido el 2026-08-30 sobre `fix/auth-screen`. Cabeza al escribirlo `ddadb7d`;
la sección de retrofecha remedida sobre `f7cae5b`, que cerró su cadena esa misma
noche.**

> **Tercer pase, 2026-08-31, sobre `fix/auth-screen`. Cabeza al cerrar `68501e6`,
> árbol de trabajo limpio.** El árbol se movió **tres veces mientras se medía** —
> otra sesión commiteó `cc57abf`, `fb4dc01` y `68501e6` entre lecturas del mismo
> archivo—, así que las anclas de este pase se re-verificaron después de la
> última: las tres cadenas que más se citan aquí siguen en su línea. **Ese es el
> riesgo permanente de este archivo**: varias sesiones escriben en el mismo árbol,
> y un ancla es válida hasta el próximo guardado. Las secciones tocadas son la 0,
> la 1, la 8 y la 10; el resto se deja como estaba y la tabla final dice qué no se
> remidió.

Vive en `plan-docs/ongoing/`, que el `.gitignore:123` re-incluye: este archivo sí se versiona.

Este archivo dice, plan por plan, **qué decisión sigue sin tomarse** y **qué trabajo
falta para cerrarlo**. Cada afirmación está medida contra el código, no copiada del
plan que la enuncia. Donde el documento y el código se contradicen, se dice cuál de
los dos está viejo.

Lo que este archivo **no** es: no reemplaza a ningún plan, no toma ninguna decisión,
y no ordena el trabajo más allá de la última sección.

---

## 0. El defecto que atraviesa tres módulos

No son tres defectos. Es uno de arquitectura de interfaz, con tres instancias, y
ninguno de los planes lo enuncia porque cada uno solo ve su propia pantalla.

**Instancia primera, el encabezado del tablero de presupuesto.** Imprime cuadro de
estado, palabra de dirección y banda de umbral —vocabulario que califica una fila
contra su propio límite— sobre un **neto de toda la cartera**
(`BudgetBigBoxResult.tsx:129-154`). Con cuatro categorías muy excedidas y seis
holgadas, el encabezado dice `left`, pinta verde y muestra ejecución bajo el umbral,
sobre una lista que filtrada por excedidas devuelve cuatro filas rojas. La bandera
que lo decide **se inventa en el navegador** del signo del neto
(`BudgetLayout.tsx:88`), porque el contrato no la sirve.

**Instancia segunda, el titular de deudas.** El título de la primera casilla se
elige por el signo de la posición neta (`DebtsLayout.tsx:64`). *(Ancla corregida el
2026-08-30: el ternario está en `DebtsLayout.tsx:74-79`; ese archivo está modificado
y sin commitear, así que la línea puede volver a moverse. El defecto sigue vivo.)* Si lo que el dueño
debe supera a lo que le deben, el tablero entero se titula *you owe* mientras una
casilla de cobrables debajo lo contradice. Y los dos conteos en pantalla —deudores
y prestamistas— se presentan como descomposición de la lista y **no suman**, porque
un deudor saldado no cae en ninguno.

**Instancia tercera, el tablero de bolsillos.** Existe un módulo de estado con
cuatro niveles y umbral de treinta días (`pocketStatus.ts:27`); el tablero lo ignora
y usa un esquema privado de tres palabras (`ListPocket.tsx:24-44`), de modo que **el
nivel en riesgo es inalcanzable desde el tablero**. Un bolsillo a diez días de su
fecha lee *Active* con cuadro neutro en el tablero y ámbar en su propia ficha.

> **Corregido el 2026-08-30, más tarde el mismo día: esta instancia ya no existe.**
> El módulo de estado tiene ahora **cinco** niveles, no cuatro —
> `frontend/src/fintrack/helpers/pocketStatus.ts:26-31` declara `funded`,
> `overFunded`, `onPlan`, `atRisk` y `offPlan` — y el umbral de treinta días está en
> `:24`, no en `:27`. El esquema privado de tres palabras desapareció: la tarjeta
> llama a `pocketDateLevel` y a `pocketSquareClass` del mismo ayudante
> (`pages/pocket/components/ListPocket.tsx:11-15`) y traduce el nivel con dos mapas,
> `STATUS_WORD` y `STATUS_TONE`, que cubren los cinco. El nivel en riesgo es hoy
> alcanzable desde el tablero, y un bolsillo a diez días lee *At risk* con cuadro
> ámbar en las dos pantallas. **Las otras dos instancias siguen vivas**, y la regla
> propuesta debajo no se toca.

> **Ampliado el 2026-08-31: el tablero de bolsillos pasó de ser la instancia tercera
> del defecto a ser el ejemplo trabajado de la regla, y por eso conviene mirarlo
> antes de arreglar las otras dos.** Cumple las tres cláusulas, medido:
> el encabezado **no colorea ni adjetiva ningún neto** —los tres importes van sin
> cuadro y sin palabra de dirección (`PocketBigBoxResult.tsx:177-218`)—; **imprime
> una partición que suma la lista de abajo**, en dos cabeceras que suman el total
> declarado (`:296-367`); y **sin pliegue no dibuja partición**, porque con los
> totales retenidos `levels` queda en `null` y la tira desaparece dejando guiones
> (`:155`, `:296`).
>
> Y agrega dos piezas de forma que la regla no preveía y que las otras dos
> instancias van a necesitar. **Una banda que abarca sus lecturas**, en vez de una
> lista plana: sin ella, el miembro del medio hay que repetirlo y aparece dos veces
> con dos conteos. Y **una fila de excepciones sin conteo en su encabezado**, para
> lo que ya está contado arriba y hay que volver a mirar — es un foco, no un
> compartimento, y el conteo se omite justamente para que nadie intente sumarlo.
> Esa segunda pieza es la que le falta al encabezado de deudas, donde los dos
> conteos en pantalla se presentan como descomposición y no suman.

**Lo común a las tres:** el servidor manda una bandera y la pantalla la vuelve a
deducir del signo; y una partición decidida se implementa a medias, con el miembro
del medio sin control que lo seleccione.

### La regla propuesta, 2026-08-30

> Un cuadro de estado, un color de umbral y una palabra de dirección califican **una
> fila contra un límite que esa fila tiene**. Un pliegue no tiene límite propio, así
> que un encabezado **nunca colorea ni adjetiva su neto**: enuncia las dos colas en
> vez del neto, imprime una partición de sus miembros que suma la lista de abajo, y
> solo lleva cuadro cuando al lado hay un conteo que dice a cuántos miembros
> representa.

Dos cláusulas que salen de ella:

- **Sin pliegue no hay partición.** Con los totales retenidos o en vuelo, los
  importes son guiones y la fila de marcas no se dibuja: una partición de ceros dice
  *tablero vacío*, que es otra respuesta que *sin responder*.
- **La partición cuenta la lista sobre la que se para.** Categorías en el nivel 1,
  cuentas en el nivel 2.

**Hallazgo colateral, y es un defecto vivo de accesibilidad:** los colores de
semáforo están calibrados contra la superficie oscura de la app y **caen a 1,89:1
sobre el panel crema** (`tokens.css:66-70`). El cuadro de estado del presupuesto ya
está sobre crema (`budget-styles.css:247`), así que hereda esa falla hoy.

**Decisión que esto abre:** si las dos colas del presupuesto —suma de los restantes
negativos y suma de los positivos— se pliegan en el servidor ahora, o el encabezado
embarca con el neto firmado más la partición y las colas llegan después. Es el único
punto de los tres que no es cambio de presentación. El módulo de bolsillos ya sirve
ese par y documenta la razón: netearlas deja que un bolsillo sobrefinanciado esconda
a otro atrasado (`pocketTypes.ts:74-79`).

**Tres huecos de token, ninguno inventado:** no existe clase de cuadro neutro —el
token de color existe, la clase no, y agregarla toca una hoja que leen seis
pantallas, así que es commit propio—; no existe token para el desplazamiento del
anillo de foco; y las dos colas del presupuesto no se sirven.

---

## 1. Pocket

### Decisiones abiertas

| decisión | recomendación registrada |
|---|---|
| Si la migración escribe una fila de compromiso de 90 por el bolsillo heredado que sobrevive, o lo deja en cero | escribirla: el dueño declaró meta, nombró cifra y movió dinero hacia ella |
| Cuál de tres lecturas de base sobre esa cuenta está vigente — tres mediciones que no pueden describir el mismo ahora | solo una conexión a producción lo decide |
| La altura de la barra de progreso, único valor sin token | ninguna; el documento se niega a inventarlo |
| Idioma de la interfaz del módulo | sin recomendación; cambia toda cadena |
| Si el objeto se llama *pocket* o *goal* en pantalla | *pocket* es el objeto, *goal* nombra solo la cifra objetivo |
| Si los chips de filtro llevan conteos | no: mezclaría tres cifras servidas con una plegada en el cliente |
| Una tarjeta por fila, o dos desde 768px | una hasta 768, dos arriba |
| Si una asignación lleva nota, y si un bolsillo lleva ícono | descartar ambas de la versión uno |
| Si una escritura invalida el tablero o lo refresca | dividir por dónde queda parado el dueño |
| Si el bloque de hoja escrito con tokens se extiende o se reemplaza | extender |
| Qué significaría un filtro de *próximos* | descartarlo: ningún horizonte existe en código |
| Cómo se redacta la caída del proveedor de tasa | como reintento, y registrar el requisito de backend |

### Falta para cerrar

**La partición, que es la instancia tercera de la sección 0.** El tablero adopta el
módulo de estado de cuatro niveles y deja su esquema privado; la casilla imprime la
partición con ceros incluidos en vez de una resta; y la cobertura sale de la
partición a su propia línea, oculta a cero, **pintada roja en las dos pantallas** —
manda la ficha, porque una cobertura rota deja la cifra del encabezado sin respaldo,
que es peor que una fecha acercándose. Hoy es ámbar en el tablero y roja en la ficha:
un booleano servido, dos colores.

**Las dos casillas que la propuesta visual borró por nombre y se construyeron
igual.** La de objetivos activos necesita un conteo que el servidor no pliega y se
arma restando tres conteos servidos en el cliente (`PocketBigBoxResult.tsx:33-34`);
lo mandado era *n de m financiados*. La de próximo objetivo también está construida.

> **Medido el 2026-08-30, sin commitear: estos dos párrafos describen trabajo ya
> hecho, y con una partición de cinco miembros en vez de cuatro.**
> - La resta de conteos desapareció. `countActive`, que era
>  `pocketCount − fundedCount − overdueCount`, la reemplazó `countByLevel(summary,
>  pockets)` en `pages/pocket/components/PocketBigBoxResult.tsx`, que devuelve
>  `{ funded, overFunded, overdue, atRisk, onPlan }`. Los dos conteos que el
>  servidor pliega se toman enteros y solo el resto se cuenta en el cliente, porque
>  el umbral de treinta días es regla de presentación.
> - **La partición quedó jerárquica, no plana**, y es una decisión de forma que el
>  párrafo de arriba no contempla. **Renombrada el 2026-08-31 y ya en el código**:
>  *Target reached* encabeza, con *at target* y *above target* colgando de ella;
>  *In progress* encabeza, con *on plan*, *at risk* y *overdue* colgando de ella.
>  Los nombres viejos eran *Funded* y *Not funded* — el primero nombraba el
>  mecanismo y no el resultado, y el segundo definía un grupo por negación. El
>  nivel `funded` pasó a decirse **At target** en `POCKET_STATUS_WORD`, así que el
>  chip del filtro, la palabra de cada tarjeta y las lecturas del héroe vuelven a
>  coincidir. Las excepciones —vencidos, en riesgo y sin respaldo— se repiten
>  además en una fila propia bajo la partición, sin conteo en su encabezado
>  porque todas ya están contadas arriba.
>  Estar por encima de la meta es **subconjunto de financiado**, no su hermano —
>  el servidor marca financiado en *comprometido mayor o igual a la meta*, así que
>  sacar las filas excedidas de ese conteo dejaba *financiado* significando
>  *aterrizó en el centavo*.
> - Cada lectura se imprime aunque valga cero, que es exactamente lo que este
>  párrafo pide.
> - La cobertura salió a su propia línea, fuera de las dos cabeceras, y se oculta a
>  cero. **Lo que no se resolvió es el color:** el tablero la pinta con el cuadro de
>  `offPlan`, o sea rojo, así que hoy coincide con la ficha — pero por elección de
>  esta pantalla, no por una regla escrita. La recomendación de arriba sigue sin
>  registrarse como decisión.

> **Cinco cosas más que el bloque de arriba no alcanza a decir, medidas el
> 2026-08-31 sobre `fb4dc01` y todas commiteadas.**
>
> - **El bolsillo que aterriza exacto en su meta tiene lectura propia por primera
>  vez.** Antes existía sólo como la resta entre el conteo de la banda y el de los
>  excedidos: contado y nunca escrito. Hoy se imprime como
>  `{levels.funded - levels.overFunded} at target`
>  (`PocketBigBoxResult.tsx:313-323`). Es **derivada, no servida**: el servidor
>  marca financiado en *comprometido mayor o igual a la meta*, así que su conteo
>  contiene las dos lecturas y sólo la mitad excedida se cuenta en el cliente.
> - **Esa lectura lleva un tic, no un cuadro** (`:321`), y es lo único de la tira
>  que sale del semáforo. El argumento escrito al lado es doble: es el único nivel
>  **terminado** en vez de pendiente, y una forma sobrevive a cualquier daltonismo,
>  que ningún verde al lado de un ámbar hace. La medición que lo sostiene está en
>  el propio comentario: los dos ámbar y el rojo de la tira caen entre 1,08 y 1,30
>  de luminancia entre sí y sólo se distinguen por tono.
> - **Los vencidos se cuentan dentro de *In progress*, y además tienen lectura
>  propia ahí** (`:342` y `:360-363`). Es una decisión de dominio, no de pantalla:
>  un bolsillo pasado de fecha no llegó a su meta y no se cerró, así que está
>  atrasado y no terminado. Eso es lo que hace que **las dos cabeceras sumen el
>  total** que la etiqueta de arriba declara (`:273`), que era la propiedad que la
>  partición vieja rompía.
> - **La fila de excepciones no lleva conteo en su encabezado, y es a propósito**
>  (`:390-392`). Toda cifra de esa fila ya está contada en una de las dos bandas
>  —los vencidos dentro de *in progress*, y un bolsillo sin respaldo dentro de la
>  banda que le toque por su propio avance—, así que un número ahí invitaría a una
>  suma que no cierra. Aparece sólo cuando hay algo que levantar (`:386-389`), al
>  revés que las lecturas de una banda, que se imprimen a cero porque una
>  partición tiene que seguir sumando.
> - **La barra de progreso se movió debajo de la ecuación que reformula**
>  (`:220-252`). Es el comprometido sobre la meta, así que va al lado de los
>  importes que divide; dos tarjetas más abajo, el lector tenía que cargar tres
>  cifras en la cabeza para saber qué medía.
>
> **Y la tarjeta de próximo objetivo cambió de pregunta.** Ya no responde *cuál
> fecha cae primero* sino *sobre cuál actuar*: el vencimiento más cercano entre
> los que siguen corriendo y, sólo si no queda ninguno corriendo, el más pasado de
> fecha (`findNextGoal`, `:97-109`). Excluir a los atrasados de plano —que es lo
> que hacía— dejaba la tarjeta en blanco justo en el tablero donde más importa la
> dirección. Ahora carga además **el faltante**, que es la cifra sobre la que se
> actúa y que la tarjeta no tenía (`:465`), y **está ausente en vez de vacía**
> cuando todos los bolsillos aterrizaron (`:445`).

**Ocho cadenas violan el vocabulario congelado.** La más grave: un mismo asiento del
historial lleva dos sustantivos a un clic de distancia — la fila imprime `Allocated`
(`PocketDetail.tsx:468`) y el modal que esa fila abre imprime `Committed`, que es el
término mandado. Los dos botones principales dicen `Commit cash` y `Release cash`
donde lo fijado es *Allocate* y *Release*.

> **Remedido el 2026-08-30. El defecto sigue vivo, las anclas se movieron, y hay un
> cambio de vocabulario que va en dirección contraria.** La fila imprime `Allocated`
> en `pages/forms/pocketDetail/PocketDetail.tsx:476`, no en `:468`; los dos botones
> están en `:339` y `:350` y siguen diciendo `Commit cash` y `Release cash`. Lo que
> cambió es otra palabra: **el módulo movió *goal* a *target*** en las cadenas del
> tablero — `Over goal` pasó a `Over target` en
> `pages/pocket/components/ListPocket.tsx:247`, el estado vacío dice ahora *plan
> towards a target* en `:138`, y el encabezado rotula la casilla nueva `Target`.
> Eso choca con la decisión registrada arriba, que reserva *goal* para nombrar la
> cifra objetivo. **Queda para el desarrollador** ratificar *target* como el término
> de la cifra o revertir esas cadenas; ninguna de las dos se decide aquí. Las otras cinco: la línea de cero fuentes,
la etiqueta de fecha, la de ritmo —tablero y ficha nombran distinto al mismo campo
servido—, un porcentaje sin sujeto, y una clase CSS con la palabra prohibida del
módulo.

> **Remedido el 2026-08-31, y el conteo de ocho ya no describe el código.** El
> commit `a54441b` fijó **una palabra por cifra en todo el módulo** bajo una
> regla que el propio código enuncia y que hay que leer antes de contar
> violaciones: **la cifra se dice *allocated*, el evento se dice *commit***
> (`PocketBigBoxResult.tsx:193-195`, citando 18.1). Con esa regla en la mano:
>
> - El par que este documento llamaba «lo más grave» **no es una contradicción**.
>  La fila del historial imprime `Committed` / `Released` (`PocketDetail.tsx:528`)
>  y los dos botones dicen `Commit cash` (`:391`) y `Release cash` (`:402`): los
>  tres nombran **eventos**, así que les toca la palabra del evento. La caja de
>  resumen imprime la **cifra** y dice `allocated` (`SummaryPocketDetailBox.tsx:70`
>  y `:97`). Las anclas viejas `:468`, `:339` y `:350` están muertas.
> - El faltante tenía cuatro nombres y hoy tiene uno: **Still to allocate**, en el
>  encabezado (`PocketBigBoxResult.tsx:196`), en la tarjeta
>  (`ListPocket.tsx:353`), en el orden de la barra (`PocketToolbar.tsx:37`), en la
>  caja de resumen (`SummaryPocketDetailBox.tsx:65`) y en el modal de efectivo
>  (`PocketCashModal.tsx:382`). Los tres sitios que pueden ir a negativo dicen
>  `Over target` en su lugar, con la palabra cargando el signo.
> - **El nivel `funded` pasó a decirse `At target`** en el mapa compartido
>  (`pocketStatus.ts:65`), que es el que leen el chip del filtro, la palabra de
>  cada tarjeta y las lecturas del encabezado.
> - `fb4dc01` cerró el último desacuerdo de este frente: la lectura de fecha de la
>  ficha imprimía el literal `Target reached`, que es el nombre de la **banda**,
>  al lado de un cuadro pintado para el **nivel**. Ahora toma
>  `POCKET_STATUS_WORD[dateLevel]` (`PocketDetail.tsx:331`).
>
> **Lo que sigue vivo son dos cosas, no ocho, y las dos son del desarrollador:**
> el choque *goal* contra *target* que el bloque de arriba anota, y la palabra
> suelta *allocation* en los dos rótulos de cobertura que el párrafo de la barra
> de herramientas nombra. Los cinco restos que este párrafo listaba —cero fuentes,
> etiqueta de fecha, ritmo, porcentaje sin sujeto, clase CSS— **no se remidieron
> en este pase**; se dejan enunciados y sin ancla, que es como estaban.

**El signo, con el mismo par contradictorio.** La fila del historial imprime el
importe con signo bajo una palabra que ya dice la dirección; el modal que esa fila
abre lo imprime en absoluto, con un comentario explicando por qué. Un asiento, dos
convenciones.

**Una cifra servida que se descarta y vuelve falsa una afirmación del propio
código.** La suma por encima de la meta (`totalExcess`) está tipada y no la lee
nadie. El encabezado afirma en su comentario que *comprometido más restante es la
meta*; con el restante recortado a cero por bolsillo antes de sumar y el excedente
sin pintar, un tablero sobrefinanciado muestra dos casillas que no reconcilian.

> **Cerrado el 2026-08-30, sin commitear.** La suma por encima de la meta ya se lee
> y se pinta: `pages/pocket/components/PocketBigBoxResult.tsx` imprime
> `<amount> committed above target` debajo del hueco, y solo cuando
> `summary.totalExcess > 0` — a cero no hay discrepancia que explicar. El comentario
> falso se reemplazó por la identidad correcta, **`comprometido − excedente +
> restante = meta`**, con la razón escrita al lado: el faltante se recorta por
> bolsillo antes de que el servidor lo sume, para que un bolsillo sobrefinanciado no
> cancele a otro atrasado. Y el encabezado pasó a **tres cifras pares** — meta,
> comprometido y hueco — en vez de un titular con las otras dos degradadas a notas
> al pie; las dos líneas de contexto (*of a $X target* y *to reach every target*) se
> fueron con esa promoción.

**El encabezado de cinco guiones que el plan prohíbe por nombre.** El tablero vacío
debe reemplazarse entero por un estado vacío; ese componente no existe, así que un
tablero vacío renderiza exactamente eso, con la casilla derivada imprimiendo `0 of 0`.

> **Remedido el 2026-08-31. Se partió en dos, y una mitad cerró.**
> - La casilla derivada que imprimía `0 of 0` **ya no existe**: se fue con
>  `countActive`, y con ella la resta de tres conteos servidos.
> - **La lista sí tiene estado vacío**, y está commiteado: con cero bolsillos,
>  `ListPocket.tsx:192-201` devuelve *No pockets yet. Create one to plan towards a
>  target.* en vez de una lista.
> - **El encabezado sigue sin estado vacío propio**, y ahí el párrafo se sostiene.
>  `PocketLayout.tsx:74-78` lo monta sin condición, así que con cero bolsillos y
>  totales servidos pinta la ecuación en ceros, la barra a cero y *Pocket status
>  (total: 0)* con las cinco lecturas a cero. Lo que **no** pinta es la tarjeta de
>  próximo objetivo ni la fila de excepciones: las dos están ausentes.
> - **Y con los totales retenidos cumple la regla de la sección 0.** Sin pliegue
>  no hay partición: `levels` queda en `null` y la tira no se dibuja
>  (`PocketBigBoxResult.tsx:155` y `:296`), quedando guiones donde iban los
>  importes. Cuando el servidor además explica por qué los retuvo, la frase
>  reemplaza al encabezado entero y no se imprime ningún guión (`:147-153`).

~~**La barra de herramientas entera**: sin búsqueda, sin orden, sin filtros.~~

> **Falso desde el 2026-08-31. Medido: la barra existe entera y está commiteada.**
> `pages/pocket/components/PocketToolbar.tsx` sirve las tres herramientas que el
> plan pedía. Búsqueda por nombre con tope de 50 caracteres (`:52`). Tres
> criterios de orden en `SORT_OPTIONS` (`:34-38`): fecha límite, nombre y
> faltante, este último rotulado *Still to allocate*. Siete chips de filtro en
> `FILTER_OPTIONS` (`:42-51`): *All*, los cinco niveles leídos de
> `POCKET_STATUS_WORD` y no escritos aquí, y la cobertura al final por ser un eje
> distinto y no un sexto nivel. El componente no guarda estado propio: todo llega
> por props para que `ListPocket` los respalde con la URL, y los conteos
> `matched`/`total` salen de `usePocketListFilter`, así que filtrar cambia lo
> listado y nunca lo que el encabezado reporta.
>
> **Lo que sí queda vivo de este párrafo es una sola cosa, y es de vocabulario:**
> el chip de cobertura se rotula `Allocation not covered` (`PocketToolbar.tsx:50`)
> y el encabezado imprime `with allocation not covered`
> (`PocketBigBoxResult.tsx:423`). La regla congelada 18.1 de `POCKET_DECISIONS.md`
> prohíbe **la palabra suelta *allocation*** por ambigua entre
> `pocket_allocations` y `budget_monthly_allocations`, y manda escribir *pocket
> allocation*. El historial de la ficha sí cumple —dice `Pocket allocation
> history` (`PocketDetail.tsx:502`)—; estas dos cadenas no. Es una violación
> medida de un contrato congelado, así que **no se arregla aquí**: queda anotada.

**El bloque de efectivo comprometido en la ficha de cuenta**: el backend lo sirve
desde antes del merge (`getAccountController.js:862-872`); el frontend no lo tipa ni
lo pinta, y arrastra el fetch condicional que confunde *no se sabe* con *no aplica*.
*(Ancla corregida el 2026-08-30: el bloque está en `getAccountController.js:857-880`,
donde `accountAllocationService.getAccountAllocation` construye `pocketAllocation`.
El hecho no cambió.)*

**Cuatro requisitos de backend registrados y no hechos:** la respuesta de servicio no
disponible ante una caída de tasa; servir el par tipado de la meta —se escriben seis
columnas y ningún `SELECT` las nombra—; las claves del compromiso inicial en el
validador; y comparar el plazo contra el hoy del dueño para que un bolsillo no nazca
vencido.

**Un quinto que ningún documento agenda**, y que sostiene dos celdas visibles: la
tarjeta de ritmo imprime guiones en ritmo logrado y fecha proyectada porque hace
falta una serie mensual de transacciones que nadie sirve.

**Dos decisiones embarcadas contra lo que los documentos recomiendan:** la opción de
límites de campo rechazada es la que se embarcó —la clave de nota compartida subida a
155, que toca otros cinco formularios—; y el botón de liberar se deshabilita por
cantidad de fuentes en vez de por el comprometido, que la especificación advierte que
**son preguntas distintas**.

**El borrado de cuenta no sabe nada de bolsillos**: la restricción sobre la clave del
libro lo va a rechazar con un error crudo de Postgres en vez de un informe que nombre
las metas que lo bloquean.

**Los dos huérfanos existen y nadie los referencia**: `PocketEditLink.tsx`, con cinco
menciones y las cinco dentro del propio archivo, y el bloque de cinco estados de
`.pocketDetail__delete`.

**Defectos de la hoja legada:** una declaración inválida que el navegador descarta,
un bloque duplicado, dos `!important`, colores crudos, y sin corte a 1024px.

---

## 2. Budget

### Decisiones abiertas

- **Si el tablero mensual oculta una cuenta que aún no existía ese mes, o la lista
  marcada.** Recomendación: ocultarla. El lado de escritura ya rechaza meses fuera de
  la vida de la cuenta; el de lectura no tiene equivalente — la fecha de apertura
  aparece **cero veces** en el servicio de cálculo.
- **Cuántos meses hacia adelante alcanza un rango.** El servidor no pone techo; el
  frontend se puso uno propio de 12 meses cuyo comentario admite que es límite de
  interfaz y no regla de servidor. La recomendación del documento es 24, decidido en
  el servidor y servido al cliente.
- **Si el lápiz se ofrece sobre un mes pasado.** Decidido que sí, **condicionado** a
  que exista antes la confirmación bloqueante que nombre el mes desde el que se
  reemplaza. La condición no está cumplida, así que la decisión no se puede ejecutar.
- **Si la excepción a la regla de banderas de funcionalidad sigue en pie**, ahora que
  las dos premisas que la sostenían vencieron. El símbolo no existe en el código.
- **Qué tokens toman las palabras *over* y *left***, y si *left* se colorea.
- **Si el módulo se cierra con una lista que queda vieja tras borrar una cuenta**, o
  el bloque de borrado entra en su alcance.
- **Si las dos colas se pliegan en el servidor ahora** (sección 0).

### Falta para cerrar

**El encabezado, que es la instancia primera de la sección 0.** Se van el cuadro y la
palabra de dirección; el neto conserva su signo; la etiqueta pasa a fija. Debajo, una
tira de marcas fuera del panel crema. Y el cuadro de categoría no debe leer el neto de
la categoría, porque reproduce el mismo defecto un nivel abajo: lee su peor cuenta y
imprime cuántas de cuántas están excedidas.

**La partición de tres miembros con un filtro de dos.** El estado tiene tres lecturas
con umbral en 75% (`budgetStatus.ts:24`); el filtro es una unión de dos. **La palabra
*near limit* no se renderiza en ninguna pantalla de presupuesto**: el estado ámbar es
solo color, el cuadro compartido no tiene texto ni etiqueta accesible, y no hay
control que junte las filas ámbar.

**La palabra de dirección se deriva del signo en el navegador, en las cinco
superficies**, mientras el servidor manda la bandera. El plan lo prohíbe en esos
términos. Hoy coinciden aritméticamente, que es por qué sobrevive: un hecho con dos
dueños.

**El modal pierde la guarda del caso sin presupuesto:** las otras cuatro pantallas no
imprimen nada cuando no hay presupuesto ni gasto; el modal imprime `Left` sobre
`$0.00`.

**La mitad bloqueante de la confirmación**: hoy el guardado llama directo, sin rama de
confirmación previa. Es lo que traba la decisión del mes pasado.

**El lápiz del nivel 3 está construido y apagado** por una constante
(`CategoryDetail.tsx:63`).

**La página de borrado de cuenta no emite el aviso de cambio**, así que cuatro de los
cinco criterios de invalidación de caché pasan y ese no.

**La serie mensual del backend existe y no la llama nadie**: cero consumidores en el
cliente. Es la unidad que Overview e Insights necesitan.

**El total remanente del dashboard resta un presupuesto mensual menos un saldo de toda
la vida** (`dashboardController.js:195` y `:356`). Hoy **no lo lee nadie en el
frontend** — sobrevive en tipos y en dos bloques retirados que documentan su propio
retiro. Servido, mal, y sin lector.

> **Remedido el 2026-08-30: el defecto se sostiene y su descripción cambia en un
> punto.** Las dos restas siguen ahí — `dashboardController.js:195`
> (`SUM(st.budget) − SUM(...)`) y `:356` (`COALESCE(SUM(cba.budget), 0) − SUM(...)`) —
> pero **el minuendo ya no es la columna almacenada**: las dos restan
> `${DERIVED_BALANCE}`, la derivación del libro. Es decir que la cifra de vida
> completa ahora se deriva bien y se sigue restando de un presupuesto mensual. La
> incompatibilidad de marcos temporales, que es el defecto, no la arregla derivar
> mejor uno de los dos términos.

**El encabezado del porcentaje dice lo contrario de lo que es:** `% of spent budget`
se lee como *porcentaje del presupuesto gastado*; la cifra es el porcentaje **del
presupuesto, que fue gastado**. Los otros tres nombres del mismo número lo dicen bien.

**Dos huecos de estado ausente:** el aviso de categoría con monedas mezcladas se sirve
y **no se pinta nunca** —esa categoría rinde tres guiones sin explicación—; y el nivel
1 no tiene estado vacío, así que un mes sin datos imprime `$0.00` en una moneda que el
servidor no nombró, sobre un área en blanco sin frase. El nivel 2 sí tiene la frase.

**La columna almacenada de presupuesto sigue alimentando lecturas vivas** en el
dashboard y en la ficha de cuenta. Y cuatro funciones del repositorio con cero
llamadores esperan el bloque único de borrado.

---

## 3. Backdating

### Decisiones abiertas

- **Qué significa el saldo inicial de un resumen mensual.** La función tiene dos ramas
  que etiquetan dos cantidades distintas con la misma palabra, y la rama mensual no
  usa la función que ya calcula lo correcto. Recomendación: unificar, en commit propio.
- **Si el brazo de tasas con credencial entra en la versión uno.** Recomendación:
  descartarlo — su ventana no alcanza la mitad vieja del problema, es la única
  credencial del lanzamiento, y su dirección de host no aparece en ningún archivo.
  **Tomada de hecho:** quedó fuera de la cascada al escribirse el resolvedor.
- **Qué valor toma el color de advertencia**, que es token y mueve toda la app.

### Falta para cerrar

**El resolvedor en cascada aterrizó** (`ddadb7d`, tres archivos): los tres brazos y el
almacén histórico ya tienen llamador. Medido contra base y fuentes vivas — un domingo
resuelve al viernes anterior, veinticinco filas por moneda de una sola llamada, un día
hábil respondido desde el almacén sin red, y rechazados con el estado correcto un día
futuro, una moneda sin fuente, una fecha malformada y un presupuesto agotado.

**Y la cadena cerró la misma noche**, con cuatro commits más:

| commit | qué hizo |
|---|---|
| `34b6e18` | la función de conversión acepta el cuarto parámetro de fecha |
| `664ad5c` | el izado en el controlador de transferencias, 72 líneas nuevas y 37 borradas |
| `921bd21` | la clase D del camino de escritura, en los dos controladores de creación |
| `f7cae5b` | el informe de impacto del borrado deja de leer la columna almacenada |

**El defecto está corregido, verificado en el orden del código**: la fecha se lee en
`transactionController.js:354`, se valida hasta `:383`, y la conversión corre en
`:409` — después. Un movimiento retrofechado en otra moneda ya no se guarda con la
tasa de hoy.

> **Anclas remedidas el 2026-08-30, el hecho intacto.** El día calendario se lee en
> `transactionController.js:348` (`requestedDay`), el hoy del dueño en `:349`, la
> validación corre de `:351` a `:377`, el día efectivo se elige en `:382-383`
> (`asOfDay`, nulo cuando es hoy) y la conversión lo recibe como cuarto argumento en
> `:400-405`. El orden que la corrección exige se cumple.

**Y la clase D cerró mejor de lo planteado:** el ayudante que bloquea y deriva salió
del controlador a su propio módulo, `lockAndDeriveBalances.js`, 74 líneas, consumido
por los dos controladores de creación. Sesenta y cuatro líneas salieron del
controlador de transacciones. Ya no hay dos aritméticas.

**Queda registrada la corrección que gobernó ese izado**, porque vuelve a aplicar
cada vez que alguien quiera mover una llamada de red en ese controlador: bajar el
bloque de conversión por debajo del bloque de validación **no es viable**, porque la
validación depende de las dos filas de cuenta, que se leen dentro de la transacción
ya abierta. Eso metería una llamada HTTP dentro de una transacción abierta, peor que
el defecto que arregla. Lo que se izó fue **solo el parseo del día calendario**, que
necesita nada más la zona horaria.

**La regla de procedencia, vigente:** ninguna fuente puede fabricar una fecha de
vigencia, ni siquiera el respaldo por CDN — ese brazo solo responde para una fecha
efectiva ya resuelta por otro.

**Lo demás:** los dos escritores que todavía persisten el saldo por fila; la ficha de
cuenta que lee la columna almacenada en tres consultas —la corrección es una línea por
consulta, y todas las consultas de lista del mismo archivo ya la tienen—; retirar el
campo de fecha heredado que pérdidas y ganancias sigue enviando junto al nuevo; y
filtrar el desplegable de categorías por fecha de apertura, que es cambio de contrato
leído por cuatro pantallas.

> **Corregido el 2026-08-30, y la corrección de la ficha de cuenta no fue lo que
> este párrafo supuso.**
> - **No eran tres consultas ni una línea por consulta: fue un solo sitio.** La
>  consulta de datos básicos trae la cifra del libro bajo su propio nombre —
>  `${derivedAccountBalanceSql('ua','NUMERIC')} AS derived_account_balance` en
>  `backend/src/fintrack_api/controllers/getAccountController.js:592` — y el
>  controlador la escribe encima del saldo en el objeto de respuesta y borra la
>  clave auxiliar, en `:822-824`. Commit `17a0714`. Las ramas por tipo de cuenta
>  siguen seleccionando `ua.*`; lo que las neutraliza es esa sobreescritura única.
> - El campo de fecha heredado ya se retiró: commit `ebd7622`,
>  *refactor(tracker): drop the legacy date key*.
> - El desplegable de pérdidas y ganancias ya se filtra por fecha: commit `e97f22f`,
>  *fix(tracker): filter the P&L account list by date*.
> - Lo de los dos escritores del saldo por fila hay que leerlo con la sección 4: el
>  escritor único derivado aterrizó, sin commitear, y el viejo se borró.

**Los dos sitios que decidían fondos contra la columna almacenada** —los dos
controladores de creación de cuenta— **ya derivan del libro** (`921bd21`).

**Y queda registrado que la propia regla de orden del plan se rompió:** dice, en
negrita, que ninguna pantalla embarca antes del resolvedor. Las pantallas embarcaron
primero, y el resolvedor llegó unas horas después. El piso de mes acotó el daño a
esa ventana. Vale como precedente de lo que la regla existía para evitar, no como
deuda abierta.

---

## 4. Borrado de cuenta

### Decisiones abiertas

**Dos bloqueantes:**

- ~~**Cómo se repara el descuadre existente**~~ — **cerrada y ejecutada el
  2026-08-30 por orden del desarrollador.** Ninguna de las dos opciones que la
  decisión planteaba, transacción de ajuste o congelamiento fechado: una tercera,
  **re-derivación silenciosa**, sin escribir ninguna fila. El motivo es que el
  descuadre nunca fue un error del libro. El libro siempre dijo la verdad; lo que
  mentió fue la columna que lo proyecta. Una transacción de ajuste habría
  corrompido el libro para que coincidiera con una proyección equivocada, que es
  exactamente lo contrario de lo que hacía falta.

  Ejecutado en una sola transacción, con los mismos ayudantes que usa la
  aplicación — cerrojo en orden ascendente de id, derivación como sentencia
  posterior — sobre `slack` `-75.97` a `-90.22`, `banco` `102.59` a `90.58` e
  `inBestMen` `2.14` a `1.39`. `cuenta precargada`, la cuarta de la lista, se
  había corregido sola nueve minutos antes al recibir un movimiento, que es la
  prueba en vivo de que la proyección se repara al moverse. **Cero cuentas
  descuadradas.** El invariante de que cada cuenta superviviente cuadra con su
  propio libro ya se puede afirmar.
- **Qué cuentas pueden recibir el saldo residual.** De esto depende si el invariante
  del destino se escribe en importes crudos o convertidos.

**Cuatro no bloqueantes:** si borrar una cuenta y borrar el usuario comparten camino
—con la restricción ya en vigor, **borrar un usuario falla hoy**—; qué le significa al
dashboard una fila desprendida, cuyo join es interno y la hace desaparecer del agregado
en silencio; si el nombre de la contraparte deja de incrustarse en la descripción; y si
la columna de borrado se renombra a *cerrada*.

**Una decisión huérfana:** si una cuenta cerrada sigue reteniendo su nombre. El plan de
unicidad se la transfirió a este plan el 30-08 y **no aparece en este documento en
ninguna parte**. Bloquea una unidad de aquel plan.

### Falta para cerrar

Todo menos la primera unidad. **La migración de las tres claves foráneas a restricción
ya está hecha y está en esta rama** — el plan la lista como pendiente, y es su
afirmación desactualizada más importante.

**Consecuencia medida, no predicha:** el borrado que la interfaz ofrece hoy **aborta al
confirmar** sobre cualquier cuenta con transacciones, porque nada desprende ni elimina
sus filas antes. Y el camino de borrado suave es **inejecutable de todos modos**: pasa
un parámetro donde su SQL espera dos.

**El defecto de emparejamiento está vivo y es exacto:** las dos patas compensatorias se
escriben sobre la cuenta afectada y sobre la de frontera; **la cuenta que se está
borrando nunca es dueña de ninguna de las dos, así que nunca se debita**.

**Uno de los dos orígenes del descuadre que el plan inventaría ya no aplica:** la
creación de bolsillo dejó de escribir fila de cuenta y transacción, así que el
reconteo que el plan exige tiene que descontarlo.

> **Corregido el 2026-08-30: el escritor único de saldo aterrizó.** Está en el árbol
> de trabajo sin commitear, en
> `backend/src/utils/fintrackUtils/accountManagement/setAccountBalanceFromLedger.js`,
> y **sí toma la derivación del camino de lectura**: construye su `SET` con
> `derivedAccountBalanceSql('ua', 'NUMERIC')` importado de
> `accountDataRetrieval/derivedBalance.js`. Los tres caminos de dinero lo llaman
> **después** de insertar las filas del movimiento —
> `transactionController.js:832` y `:838`, `accountCreationController.js:402` y
> `:910`, `accountCategoryCreationcontroller.js:489` — y las dos escrituras que
> estaban comentadas en los controladores de creación ahora existen. El escritor
> viejo, `accountManagement/updateAccountBalance.js`, está **borrado**. Sigue vivo un
> segundo escritor, `accountDeletionUtils/updateAffectedAccountBalance.js:8`, con dos
> llamadores en el camino de borrado, `deleteAccountService.js:273` y `:311`, que
> todavía recibe el saldo ya calculado por su llamador y no filtra por dueño.
>
> Y la comparación de fondos dejó de pasar por coma flotante: usa la aritmética
> decimal del proyecto en `transactionController.js:688-694`, con `money()` y
> `toAmountString()` importados de `budget_services/core/money.js`.

Faltan además: el séptimo tipo de cuenta para la cuenta de frontera, hoy identificada
por una cadena
literal; el endpoint de evaluación que reemplace el informe de impacto que hoy llega
**desde el cuerpo de la petición**; el motor de liquidación; el barrido de 68 sitios de
lectura; y el desprendimiento y saneo.

---

## 5. Unicidad de nombre de cuenta

### Decisiones abiertas

- **Dónde se ubica el mensaje de colisión** cuando tres campos componen una sola clave.
  Recomendación: bajo el nombre compuesto de solo lectura, el único elemento en pantalla
  que representa la clave.
- **Con qué fidelidad el cliente reproduce el normalizador de nombre de persona.**
  Recomendación: un helper que colapse espacios y deje el caso como está, idéntico al
  servidor.
- Heredada y sin dueño: **si una cuenta cerrada retiene su nombre** (sección 4).

### Falta para cerrar

**Las dos primeras unidades están cerradas**, contra lo que el plan afirma: el hook
compartido existe con estado triple y exclusión por identificador, y el chequeo de
renombrado **cubre los cuatro tipos** desde un solo sitio colocado después del switch
(`accountEditController.js:239-260`). *(Ancla ampliada el 2026-08-30: el bloque va de
`:239` a `:264`, y además de excluir la propia fila por `account_id <> $4` excluye las
borradas con `deleted_at IS NULL`.)*

**Faltan las cinco pantallas.** Ninguna condiciona su botón de envío al resultado. El
estado triple existe y **nadie lo lee**: los dos consumidores del hook siguen
destructurando solo las dos funciones viejas.

**La unidad del formulario de bolsillo cambió de premisa:** esa pantalla ya no crea una
fila de cuenta, escribe en la tabla de bolsillos, que el índice del cliente no lee. No
se puede construir sobre el hook compartido tal como está, y **no existe chequeo de
unicidad de nombre de bolsillo en ningún lado del servidor**.

**La inconsistencia que el plan marca urgente, confirmada:** creación e índice tratan
como tomado el nombre de una cuenta cerrada, y el chequeo de renombrado no. El
formulario va a llamar tomado un nombre que el servidor acepta.

---

## 6. Debts

> **Regla de presentación de importes, 2026-08-31.** Registrada entera en
> `PLAN_DEBTS/DEBTS_AUDIT.md`, sección 15, y ya aplicada en cuatro superficies.
> Lo que decide no es si la cifra es una deuda: es **si algo más en la misma
> línea ya dice la dirección**. Una **posición** con su dirección escrita al lado
> se imprime como magnitud y toma color; un **movimiento** conserva su signo,
> porque es el operador de la suma que corre contra el saldo de arrastre, y el
> color solo lo refuerza; un **neto** conserva su signo y no toma color. El color
> nunca es el único portador, y el par no es rojo y verde.
>
> Obligó a declarar dos tokens para superficie clara,
> `--color-amount-positive-on-panel` y `--color-amount-negative-on-panel`: el par
> existente está calibrado contra el fondo oscuro y sobre el panel crema cae a
> 2,98 y 2,64 contra uno, por debajo del piso de 3.
>
> **Deja dos unidades abiertas en el detalle del deudor, ninguna empezada:** el
> extracto sobre un período que el dueño elige — que **no** está bloqueado por la
> falta de posición a una fecha, porque el endpoint del extracto por cuenta ya
> acepta inicio y fin y ya calcula el saldo de arrastre — y el bloque de período
> tratado como en los otros detalles de cuenta, que necesita **una frase del
> desarrollador** antes de escribirse porque no está definido qué abarca.

> **Fallo del desarrollador, 2026-08-30, tercera lectura.** Registrado entero en
> `PLAN_DEBTS/DEBTS_AUDIT.md`, sección 14. Reencuadra el módulo: doce de los
> diecinueve defectos cerrados, y **todo P0 y todo P1 entre ellos**, así que
> Debts ya no es un módulo roto que necesita rescate sino uno con la capa de
> comportamiento visible estabilizada y el contrato contable sin formalizar.
>
> **Dos vías que no se mezclan.** Los siete defectos vivos responden *¿el código
> actual implementa bien lo que ya pretende hacer?*; los siete bloques de
> contrato responden *¿qué debe pretender hacer Debts?*. Resolver uno no aporta
> evidencia para el otro.
>
> **El orden:** cerrar los siete defectos vivos, volver a medir, recién después
> los contratos con especificación antes que código, y una segunda auditoría
> contra el contrato cerrado. Borrado de cuenta **no pasa por delante** de
> terminar la especificación de Debts, y los siete contratos tampoco se empiezan
> a implementar todavía.

### Decisiones abiertas

- **Si la cuenta registrada al crear un deudor es hecho histórico inmutable o
  preferencia operativa editable.** Recomendación: preferencia — el libro ya sirve el
  hecho histórico, y una segunda copia solo agrega una forma de discrepar.
- **Si el nombre copiado de esa cuenta sobrevive al borrado de la cuenta que nombra.**
  Recomendación: borrarlo al eliminarla — mientras su sujeto existe es presentación, en
  cuanto desaparece es una cadena que reidentifica.
- **Dónde se agenda el importe formateado a mano**, único camino del módulo a un `NaN`
  en pantalla.

### Falta para cerrar

**El titular, que es la instancia segunda de la sección 0.** El título pasa a
sustantivo fijo y deja de voltearse con el signo. Los dos tazones de cobrable y
pagadero ya son la representación de dos colas que la regla pide: se quedan. Los
conteos salen a su propia tira con la tercera categoría, *saldados*.

**El tercer conteo ya viaja y se descarta:** se construye en el memo y su
destructuración está comentada (`DebtsLayout.tsx:38` y `:50`). No hay nada que derivar.
*(Anclas corregidas el 2026-08-30: la destructuración comentada está en
`DebtsLayout.tsx:41`, el campo se arma en el memo en `:56` y viaja en el arreglo de
dependencias en `:66`. El archivo está modificado y sin commitear. El hecho se
sostiene: el conteo llega y nadie lo pinta.)*

**Cada fila deduce su propia dirección en el navegador**
(`ListOfDebtors.tsx:136`): un saldado se etiqueta como deudor. Necesita la rama de cero
y la palabra *saldado* con marca neutra. Es además el defecto que el bloque de modelo
canónico de lectura existe para terminar — el servidor no sirve la posición de deuda,
así que cada pantalla la reinterpreta del signo.

**El vocabulario del contrato:** cobrable, pagadero y saldado son los términos
primarios; deudor y acreedor quedan secundarios. Hoy la interfaz usa los secundarios
para los conteos y los primarios para los importes, en la misma caja.

**Cerrado y no reabrir:** el pagadero se imprime en valor absoluto y el modelo contable
no se movió. El principio que dejó eso vale para todo lo de arriba: **nunca se cambia
un significado contable para resolver un problema de presentación**.

**Lo demás vivo:** los siete respaldos a cero literal de la caja de titulares; la
segunda moneda que se descarta en silencio por leer la primera fila de una consulta
agrupada sin ordenar; la ventana del extracto calculada con el reloj del navegador;
las filas listadas por índice de arreglo sobre una lista reordenada; colores crudos y
un borde de depuración; y una clase escrita con punto inicial que no casa con ninguna
regla.

**Y los siete bloques de contrato del dominio se deben enteros**, empezando por el más
grande: qué es un movimiento de deuda. Las fases uno y dos están prácticamente
completas; las fases tres a seis, intactas.

---

## 7. Tracker UX

### Decisiones abiertas

Cinco enteras y dos partes de una sexta, no siete: si la acción principal pasa a botón
ancho abajo o la tarjeta se encoge; si el glifo de más junto a la nota desaparece o se
redefine; si las cinco pantallas comparten una maqueta; si la tarjeta nombra el tipo de
movimiento o solo lo dice la barra de pestañas; y del contrato del control de fecha,
qué gesto lo abre y qué cuesta a 360px, y si arrancar en hoy se lee como elección o
como omisión.

### Falta para cerrar

El envío disfrazado de afordancia de nota; el formulario sin manejador de envío, que
impide completarlo desde el teclado; el error de tipeo visible en el título del
desplegable de categorías; y el área vacía de la tarjeta, cuya regla fija posición
absoluta y desplazamiento superior sin declarar ni alto ni borde inferior.

> **Corregido el 2026-08-30, más tarde el mismo día: tres de los cuatro cerraron.**
> Las cinco pantallas tienen envío real, cada formulario declara
> `onSubmit={onSaveHandler}` y cierra con
> `general_components/formSubmitBtn/FormSubmitBtn.tsx` —
> `tracker/expense/Expense.tsx:827` y `:897`, `income/Income.tsx:456` y `:512`,
> `transfer/Transfer.tsx:750` y `:846`, `debts/Debts.tsx:647` y `:714`,
> `profitNloss/PnL.tsx:601`; commits `a8d9457`, `e82c99b`, `878915a`, `4623c78`,
> `fc77d8d`. El error de tipeo se corrigió en `Expense.tsx:343`, que hoy dice
> `'Category / Subcategory'` (`035661b`). **Sigue vivo el cuarto**, el área vacía de
> la tarjeta. Y queda un residuo: `tracker/components/CardNoteSave.tsx` no tiene ya
> **ningún importador** en `frontend/src`.

**El importe entre paréntesis junto a una categoría ya está corregido en las dos
pantallas.** Y la hoja ya consume tokens: sobreviven un hexadecimal crudo y una
declaración muerta.

---

## 8. Overview

### Decisiones abiertas

Once. Las que deciden algo: si un movimiento entre cuentas propias merece tarjeta propia
o submedida; en qué directorio vive el cálculo de indicadores —**registrada dos veces
con dos estados distintos**, un documento la llama abierta y otro la da por aplicada
salvo veto—; qué lectura presenta la segunda tarjeta nueva, ahora que *ahorro* dejó de
ser un tipo de cuenta; y cómo se repara el defecto de marcos temporales mezclados del
encabezado, que suma un saldo bancario de hoy con un cierre de deuda del mes pasado.

**Tres más, abiertas el 2026-08-31 y ninguna cerrable con trabajo:**

- **Cómo se suma el faltante de las metas**: recortado por bolsillo antes de sumar,
  con el excedente aparte, como hace el módulo de bolsillos; o resta plana, como hace
  Overview hoy. Las dos están razonadas por escrito y son incompatibles.
- **Si Overview adopta el idioma de banda con lecturas colgando** para presentar cada
  dominio, o conserva la lista apilada. Anotada también en `OVERVIEW_DECISIONS.md`, al
  pie de la página de referencia congelada.
- **Cuál de las dos ramas gana con el componente de metas de ahorro** al fusionar:
  borrado en `fix/auth-screen`, vivo en `feat/overview`.

### Falta para cerrar

**Todo lo que lo conecta, y el plan está viejo en cuatro frentes.**

- No existe directorio de servicios de Overview en esta rama, ni ruta, ni controlador,
  ni URL en la configuración del cliente.
- La pantalla viva hace **13 peticiones distintas** en un montaje frío contra un
  criterio que exige una, y **suma dinero en el navegador** contra un criterio que lo
  prohíbe.
- **El código de la rama de Overview filtra por el tipo de cuenta retirado y une la
  tabla de extensión que la migración retiró.** Ya no falla: devuelve cero. Fusionarla
  como está embarca una tarjeta que **miente sin romperse**.
- **Ningún documento de Overview menciona el saldo derivado del libro.** Cualquier
  indicador definido como suma sobre cuentas tiene que importar la derivación, no
  escribir su propia aritmética.

**Lo que ya está resuelto y el plan no sabe:** la columna de fecha que cualquier
agrupación mensual debe usar es la fecha real del movimiento, resuelta a la zona del
dueño antes de extraer el mes. Las dos series que existen ya lo hacen así.

> **Remedido entero el 2026-08-31, y esta vez sí contra la rama de Overview.** El
> pase anterior dejó esta sección marcada como dudosa porque el árbol no la tenía
> desplegada. **Sí la tiene**: `feat/overview` está montada como árbol de trabajo
> aparte, en `C:/AA1-WEB_DEVELOPER/REACT/apps/FINTRACK/pern_fintrack_overview`,
> cabeza `1fb66b9`. Todo lo que sigue está medido ahí, en lectura solamente.
>
> **Primer frente: el backend de Overview existe, y el párrafo que lo negaba
> hablaba de otra rama.** Hay controlador (`overviewController.js`), ruta
> (`overviewRoutes.js`) y un árbol de servicios completo en
> `services/overview_services/`, con diez constructores en `core/` —encabezado,
> tarjeta de gastos, desglose por categoría, snapshot mensual, series de
> tendencia, metas de ahorro— y seis repositorios en `db/`. La afirmación *no
> existe directorio de servicios de Overview* es cierta en `fix/auth-screen` y
> **falsa en `feat/overview`**; el documento decía la primera sin nombrar la rama,
> que es lo que la volvía engañosa.
>
> **Segundo frente: el conteo de peticiones se remide en 13, y el reparto es
> otro.** Sobre `fix/auth-screen`: seis salen del agregador
> (`overview/Overview.tsx:76-107`, un gasto mensual por tipo y cinco listas de
> movimientos), cinco del contenedor (`OverviewLayout.tsx:37,52,69,86,102`, un
> saldo total por tipo de cuenta cada una) y dos de componentes que buscan por su
> cuenta (`components/AccountBalance.tsx:50` y
> `components/InvestmentAccBalance.tsx:45`). Trece, contra un criterio que exige
> una. **La suma de dinero en el navegador también se sostiene**:
> `CalculateMonthlyAverage.ts` promedia importes en el cliente y `Overview.tsx:161`
> lo llama.
>
> **Tercer frente, y es el más grave: la consulta de metas de ahorro lee el modelo
> de bolsillo retirado, y el mecanismo no es el que este documento suponía.**
>
> La consulta está en
> `pern_fintrack_overview/backend/src/fintrack_api/services/overview_services/db/overviewPageRepository.js:50-61`
> y dice, textual: `JOIN pocket_saving_accounts psa ON psa.account_id =
> ua.account_id` con `AND act.account_type_name = 'pocket_saving'`, leyendo
> `ua.account_balance AS balance` y `psa.target AS target`. El repositorio de
> cuentas filtra por el mismo tipo en `overviewAccountRepository.js:62` y `:208`.
>
> **Corrección de mecanismo.** Este documento decía *la tabla de extensión que la
> migración retiró*. **Ninguna migración la retira.** `020_create_pocket_tables.sql`
> declara por escrito, en su cabecera (`:32-40`), que **no** borra ni renombra
> `pocket_saving_accounts` —porque tres endpoints vivos todavía la unen— y que
> **no** quita `pocket_saving` del catálogo de tipos —porque todo registro anterior
> lleva ese id significando *bolsillo*, y restatearlo reescribiría esa historia en
> silencio. La tabla sigue creada (`002_accounts.sql:190`) y el tipo sigue en el
> catálogo (`005_base_catalogs.sql:40`); quedan 43 referencias a `pocket_saving` en
> `backend/src` de esta rama.
>
> **Lo que la migración sí hace es vaciarla.** El paso 5 (`:360-392`) borra las
> cuentas de bolsillo de `user_accounts`, y `pocket_saving_accounts` cuelga de ahí
> con `ON DELETE CASCADE` (`createTables.js:124`), así que se va con ellas.
>
> **Y de ahí sale la cifra exacta que la tarjeta va a mostrar.** Con cero filas,
> `makeFinancialGoals.js` devuelve saldo total **0**, meta total **null** y
> faltante **null**, y empuja el aviso `NO_GOAL_SET_NOTICE`, que dice literalmente
> *No saving goal has a target set*. Es decir: sobre un dueño con bolsillos, metas
> y compromisos escritos en `pockets` y `pocket_allocations`, la tarjeta de metas
> **informa cero ahorrado y ninguna meta fijada, sin lanzar un solo error**. La
> conclusión del documento —*miente sin romperse*— se confirma; lo que cambia es
> por qué, y por qué no hay excepción que avise.
>
> **Cuarto frente: el saldo derivado del libro sigue sin figurar en ningún
> documento de Overview**, y la consulta de arriba es el caso de manual — suma
> `ua.account_balance`, que es la columna almacenada, en vez de derivar del libro.
> Se confirma sin cambio.
>
> **Un quinto frente que este documento no tenía.** El código de Overview cita un
> plan que **no existe en ningún lado**: `makeFinancialGoals.js:5-6` remite a
> `PLAN_POCKET_ALERT.md` para *the per-pocket card and hero*. Ese archivo no está
> ni en `plan-docs/` ni en ninguno de los árboles. La documentación que gobierna
> esa pantalla es `PLAN_POCKET/POCKET_MODULE_SPEC.md` y `POCKET_DECISIONS.md`.
>
> **Y una divergencia entre ramas que conviene tener presente al fusionar:**
> `SavingGoals.tsx` **está borrado en `fix/auth-screen`** —el directorio
> `pages/overview/components/` tiene cinco archivos y ninguno es ese, y las dos
> claves de bolsillo del agregador están comentadas en `overviewFetchAll.ts:67` y
> `:72`— pero **sigue vivo y montado en `feat/overview`**, importado en
> `Overview.tsx:10`, pedido en `:83` y renderizado en `:424` contra el endpoint
> viejo del dashboard. La fusión tiene que resolver cuál de las dos gana.

> **Qué de lo que cambió hoy en bolsillos le llega a Overview. Medido, y la
> respuesta corta es: del vocabulario nada, de las definiciones una y es un
> choque.**
>
> **Overview no consume ni una palabra del vocabulario de bolsillos, y se
> verificó antes de afirmarlo.** El mapa compartido `POCKET_STATUS_WORD` y sus dos
> ayudantes tienen **seis importadores en todo el frontend y los seis están dentro
> del módulo de bolsillos** — el propio ayudante, la ficha, su ícono de lectura,
> la tarjeta, el encabezado, la barra de herramientas y el hook del filtro. Cero
> fuera. En `pages/overview/` de esta rama no aparece la palabra *pocket* salvo en
> dos líneas comentadas (`overviewFetchAll.ts:67` y `:72`). Y la sección congelada
> del contrato, `PLAN_OVERVIEW_CONTRACT.md:377-380`, son **tres importes y ninguna
> palabra de nivel**: saldo, meta y faltante. Así que *At target*, *Still to
> allocate*, la partición en dos bandas y la fila de excepciones **no cambian nada
> que Overview consuma hoy**. Lo que fijan es el idioma que Overview tendrá que
> adoptar el día que presente bolsillos, si no quiere ser el tercer sitio que
> nombra el mismo nivel de una tercera manera.
>
> **La que sí es un choque real, y de definición, no de palabra: el faltante se
> calcula de dos maneras incompatibles.** El módulo de bolsillos **recorta el
> faltante por bolsillo antes de sumar** y hace viajar el excedente por separado
> (`totalExcess`), con la razón escrita en `PocketBigBoxResult.tsx:201-209`: para
> que un bolsillo sobrefinanciado no cancele a otro atrasado. Overview hace lo
> contrario y lo argumenta al revés: `makeFinancialGoals.js` documenta que
> `goalsTotalRemaining` es **una resta plana**, que una meta ya superada aporta
> negativo y baja el total, y que **recortar informaría más trabajo pendiente del
> que hay**. Las dos posturas están razonadas y **las dos no pueden estar en la
> misma aplicación**: para la misma cartera devuelven cifras distintas, y la que
> presente Overview va a contradecir a la que presente el tablero de bolsillos.
> Es exactamente el tipo de fila que el inventario de reglas de negocio pedido
> existe para hacer visible. **La decisión es del desarrollador y se anota en
> `OVERVIEW_PLAN/OVERVIEW_DECISIONS.md`.**

---

## 9. Superficie del tablero

### Decisiones abiertas

Siete: los dos valores de color sin token —el relleno de la tarjeta, donde el token que
encaja no se ve y el valor que se ve no tiene token, y el color de advertencia, que hoy
grita más fuerte que la alerta—; cómo se salda la regla de que un porcentaje de fila
significa lo mismo que el del encabezado; si los tres rellenos de Overview colapsan a
uno; si el ancho uniforme se escribe una vez —abierta, pero rechazada como commit
propio—; el ritmo de espaciado de la tarjeta; el selector de mes posicionado en un
literal de píxeles que desborda su contenedor por 7px; y el encabezado más corto que su
propio token.

### Falta para cerrar

Nada de esto está escrito en el árbol de la aplicación, y **las reglas se perdieron al
recargar**: el documento es el único registro que queda de la medición.

---

## 10. Qué bloquea a qué

| bloqueador | a quién traba |
|---|---|
| **El escritor único de saldo, tomando la derivación del camino de lectura** | Borrado de cuenta y el invariante 5 de Debts. La mitad de lectura y la clase de escritura ya cerraron; lo que falta es el escritor. **Corregido el 2026-08-30, más tarde el mismo día: el escritor existe y está commiteado** — `accountManagement/setAccountBalanceFromLedger.js`, en `d41aca2`, importando `derivedAccountBalanceSql` de `accountDataRetrieval/derivedBalance.js`, con cinco llamadores en los tres caminos de dinero. Con él se borró `updateAccountBalance.js`, que guardaba la cifra que su llamador calculaba. Lo que queda bloqueando es el **segundo** escritor, `accountDeletionUtils/updateAffectedAccountBalance.js`, con dos llamadores en el camino de borrado (`deleteAccountService.js:273` y `:311`) |
| ~~**Cómo se repara el descuadre existente**~~ | **Desbloqueado el 2026-08-30**: re-derivado en bloque, cero cuentas descuadradas. Ni Borrado ni Debts siguen esperando esto |
| **Si una cuenta cerrada retiene su nombre** — sin dueño, transferida a un plan que no la registró | Unicidad de nombre, Borrado de cuenta |
| **Si las dos colas del presupuesto se pliegan en el servidor** | el encabezado de presupuesto, y por analogía el de deudas |
| **La definición de qué es un deudor cerrado** | la tercera categoría de Debts, que no puede embarcar antes |
| **Cómo se suma el faltante de las metas** — recortado por bolsillo con el excedente aparte, o resta plana — *abierta el 2026-08-31* | la tarjeta de metas de Overview, que hoy implementa la segunda mientras el tablero de bolsillos implementa la primera. Ninguna de las dos puede embarcar sin que la otra la contradiga |
| **Qué se hace con la consulta de metas de Overview**, que lee cuentas de tipo `pocket_saving` a las que la migración 020 dejó sin filas — *abierta el 2026-08-31* | la fusión de `feat/overview`. No falla: informa cero ahorrado y *ninguna meta fijada* sobre un dueño que tiene metas |

Y una sola medición desbloquea tres decisiones de golpe: **conectarse a producción**.
De ahí salen si el bolsillo heredado sigue vivo, si existe la columna de zona horaria
del dueño —que decide el arranque de Supabase— y si la migración de restricción corrió
allá.

---

## Correcciones del 2026-08-30 (segunda pasada del mismo día) — sólo mediciones

Este archivo se escribió el 2026-08-30 sobre la cabeza `ddadb7d`, con la sección de
retrofecha remedida sobre `f7cae5b`. **La cabeza es hoy `e919a89` y el árbol de trabajo
tiene veintidós archivos modificados, uno borrado y dos rutas sin seguimiento**, así que una
parte de lo que este documento midió esa noche envejeció en horas. Ninguna decisión se cerró,
se borró ni se reordenó.

| sección | qué se corrigió |
|---|---|
| 0 — el defecto que atraviesa tres módulos | **La instancia tercera dejó de existir.** El tablero de bolsillos adoptó el ayudante compartido, que ahora tiene cinco niveles y no cuatro, y el nivel en riesgo es alcanzable desde la tarjeta. Las otras dos instancias siguen vivas. Ancla del titular de deudas corregida |
| 1 — Pocket | La resta de conteos desapareció y la partición quedó **jerárquica**: estar por encima de la meta es subconjunto de financiado, no su hermano. El excedente ya se lee y se pinta, y el comentario falso del encabezado se reemplazó por la identidad correcta. El encabezado pasó a tres cifras pares. Anclas del historial y del bloque de efectivo comprometido corregidas. **Se marca un choque de vocabulario nuevo**: el módulo movió *goal* a *target* en las cadenas del tablero, contra la decisión registrada que reserva *goal* para la cifra objetivo |
| 2 — Budget | Las dos restas del total remanente siguen ahí, pero su minuendo ya no es la columna almacenada: las dos derivan del libro. El defecto de marcos temporales no lo arregla eso |
| 3 — Backdating | Anclas del orden fecha–validación–conversión remedidas. **La corrección de la ficha de cuenta no fue lo que este documento supuso**: no eran tres consultas con una línea cada una, fue un solo sitio — la consulta de datos básicos trae la cifra derivada bajo su propio nombre y el controlador la escribe encima de la respuesta. El campo de fecha heredado y el filtro del desplegable de pérdidas y ganancias ya cerraron |
| 4 — Borrado de cuenta | **El escritor único de saldo aterrizó**, sin commitear, y sí toma la derivación del camino de lectura. El escritor viejo está borrado. Queda un segundo escritor con dos llamadores en el camino de borrado. La comparación de fondos dejó de pasar por coma flotante |
| 5 — Unicidad de nombre | Ancla del chequeo de renombrado ampliada a su tramo real |
| 6 — Debts | Anclas del tercer conteo corregidas; el hecho se sostiene |
| 7 — Tracker UX | **Tres de los cuatro pendientes cerraron hoy**: el envío disfrazado, el formulario sin manejador y el error de tipeo. Queda el área vacía de la tarjeta, y un residuo: el componente de guardado compartido se quedó sin importadores |
| 10 — qué bloquea a qué | La fila del escritor único se reescribe: el escritor existe; lo que bloquea es el segundo |

**Se dejó intacto a propósito.** La regla propuesta de la sección 0 y sus dos cláusulas. Las
doce decisiones abiertas de Pocket, las siete de Budget, las tres de Backdating, las seis de
Borrado, las tres de Unicidad, las tres de Debts, las cinco y media de Tracker, las once de
Overview y las siete de Superficie del tablero: **ninguna se cerró**. El principio de Debts
—nunca se cambia un significado contable para resolver un problema de presentación— tampoco.

**Queda dudoso.**
- La sección 8, Overview, no se remidió contra la rama `feat/overview`, que este árbol no
  tiene desplegada. Sus cuatro frentes se dejan como estaban.
- La sección 9, Superficie del tablero, es una medición tomada en el navegador que este pase
  no puede repetir sin correr la aplicación.
- Todas las mediciones contra base de datos de este archivo se dejaron sin re-tomar: no se
  consultó ninguna base.
- Los archivos de deudas y de bolsillos citados por línea están modificados y sin commitear,
  así que sus anclas se vuelven a mover con el próximo guardado.

---

## Correcciones del 2026-08-31 (tercer pase) — sólo mediciones

Este archivo se escribió el 2026-08-30 sobre `ddadb7d` y se corrigió esa misma noche.
**La cabeza es hoy `fb4dc01` y el árbol de trabajo está limpio.** Ninguna decisión se
cerró, se borró ni se reordenó en este pase.

| sección | qué se corrigió |
|---|---|
| 0 — el defecto que atraviesa tres módulos | El tablero de bolsillos pasó de instancia del defecto a **ejemplo trabajado de la regla**, y se anotan las dos piezas de forma que aporta y que la regla no preveía: la banda que abarca sus lecturas, y la fila de excepciones sin conteo en su encabezado. Las otras dos instancias siguen vivas |
| 1 — Pocket | **Tres afirmaciones eran falsas.** La barra de herramientas no está sin construir: existe entera y commiteada. Las «ocho cadenas» que violaban el vocabulario ya no son ocho: bajo la regla congelada *la cifra es allocated, el evento es commit*, la mitad nunca fue violación y el resto lo cerró `a54441b`. Y la casilla que imprimía `0 of 0` no existe. **Se anota una violación nueva y medida**: la palabra suelta *allocation* en dos rótulos de cobertura, que 18.1 prohíbe. Se agregan cinco hechos que ningún párrafo cubría: la lectura del bolsillo exacto y su tic, los vencidos contados dentro de *In progress*, la fila de excepciones sin conteo, la barra bajo la ecuación, y la tarjeta de próximo objetivo con su pregunta cambiada |
| 8 — Overview | **Remedida entera contra `feat/overview`, que el pase anterior no pudo abrir y que sí está montada como árbol aparte.** El backend de Overview existe; la afirmación contraria era cierta de otra rama y no lo decía. El conteo de 13 peticiones se confirma con su reparto exacto. La consulta de metas lee el modelo retirado, y **se corrige el mecanismo**: ninguna migración retira esa tabla, la 020 dice por escrito que no lo hace, y lo que ocurre es que la vacía por cascada. Se agrega la cifra exacta que la tarjeta mostrará, un plan citado por el código que no existe, y la divergencia del componente de metas entre las dos ramas |
| 8 — Overview, impacto de bolsillos | **Verificado antes de afirmarlo: Overview no consume ni una palabra del vocabulario de bolsillos.** Seis importadores del mapa compartido, los seis dentro del módulo. Lo que sí choca es una **definición**: el faltante se recorta por bolsillo en un módulo y se suma plano en el otro, con argumento escrito en los dos sentidos |
| 10 — qué bloquea a qué | Fila nueva por el choque de definición del faltante |

**Se dejó intacto a propósito.** La regla propuesta de la sección 0 y sus dos cláusulas.
Todas las decisiones abiertas de todas las secciones: **ninguna se cerró**, y las tres
nuevas de Overview quedan abiertas, no resueltas.

**Queda sin remedir en este pase, y se dice para que nadie lo lea como medido.**
- Las secciones 2 a 7 y la 9. Nada de lo que dicen se tocó ni se verificó hoy.
- Los cinco restos de vocabulario de bolsillos —cero fuentes, etiqueta de fecha, ritmo,
  porcentaje sin sujeto, clase CSS— siguen enunciados y sin ancla.
- Ninguna consulta a base de datos, ni local ni de producción.
- La sección 9 sigue siendo una medición de navegador que este pase no repite.
