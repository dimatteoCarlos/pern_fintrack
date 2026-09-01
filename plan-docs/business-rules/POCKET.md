# Bolsillos — reglas que gobiernan cada mensaje al usuario

**Vive en `plan-docs/`, que está en `.gitignore`: no produce commit.**

Medido contra el código el 2026-08-31, en `fb4dc01`. Cada fila se leyó del
archivo, no del plan.

Cubre **todo lo que la pantalla le dice al usuario en este módulo**: rótulos que
cambian, cifras, frases armadas, estados vacíos y estados de error. Un mensaje
que no está acá es un mensaje que nadie decidió.

---

## Parte 1 — Las seis reglas que gobiernan TODOS los mensajes

Estas no son de bolsillos. Son las que deciden la forma de cualquier mensaje
dinámico, y las de la parte 2 las aplican.

### R-1. Cero se imprime; ausente desaparece

**Un miembro de una partición se imprime aunque valga cero**, porque si se cae
la partición deja de sumar y el lector no puede distinguir un nivel ausente de
uno vacío. **Una excepción se ausenta en cero**, porque no particiona nada y
nada se rompe si se va.

Aplicado: las cinco lecturas de nivel imprimen en cero; la fila de alertas
desaparece entera cuando no hay nada que alertar.

**Fuente de verdad:** `PocketBigBoxResult.tsx`, el ayudante que elige la clase
atenuada, y la condición que envuelve la fila de excepciones.

### R-2. El signo lo lleva la cifra salvo que la palabra ya diga la dirección

Una **posición** cuya dirección ya está en palabras va sin signo, en magnitud.
Un **movimiento** lleva signo siempre: es el operador de la suma. Un **neto**
lleva signo y no lleva color.

Aplicado: `Over target $3.62`, nunca `-$3.62`. `12 days late`, nunca
`-12 days left`. Pero la fila liberada del historial sí muestra `-$5.00`, porque
es un movimiento.

### R-3. El color nunca es el único canal

Toda marca de color viaja con su palabra. Medido: los tonos del semáforo están
entre **1,08 y 1,56 de contraste de luminancia** entre sí — se separan por tono,
no por claridad, y el par ámbar/rojo es el que colapsa la ceguera al color más
común. La palabra es lo que sostiene la lectura.

Corolario: el estado terminado se marca con **forma** (un ganchillo) y no con un
verde más, porque una forma sobrevive a cualquier daltonismo.

### R-4. Un nivel se nombra en un solo lugar

Las cinco palabras de nivel salen de un único mapa. El chip del filtro, la
palabra de cada tarjeta y las lecturas del héroe lo leen; **ninguno escribe la
palabra a mano**. Un literal tecleado en un componente es la deriva que ese mapa
existe para impedir — pasó hoy y se corrigió en `fb4dc01`.

**Fuente de verdad:** `helpers/pocketStatus.ts`, el mapa de palabras.

### R-5. Nombre de nivel y nombre de banda no son intercambiables

`At target` y `Above target` son **niveles**. `Target reached` es la **banda**
que contiene a los dos. Una lectura cuyo cuadrado pinta un nivel tiene que
nombrar ese nivel: poner el nombre de la banda al lado del color de un nivel
hace que el color y el texto discrepen en precisión.

### R-6. Tres ausencias distintas, tres respuestas distintas

**En la wire** (cargando), **nada que mostrar** (vacío) y **el servidor se negó**
(rechazo) son tres respuestas. Un guion no puede decir cuál es.

Aplicado: cuando el servidor retiene las cifras manda **su propia oración**, que
se imprime donde irían los números — sin guiones arriba, porque repetirían en
símbolos lo que la línea está por decir en palabras.

### R-7. La cifra es *allocated*, el evento es *commit*

Vocabulario congelado del módulo. Un rótulo que nombra un monto toma la palabra
del monto. Nunca *saved*: la plata no se guardó en ningún lado, sigue en una
cuenta real y está comprometida.

---

## Parte 2 — Cada mensaje, sus casos y sus bordes

### 2.1 Héroe del tablero — la partición

| mensaje | casos | borde | regla |
|---|---|---|---|
| `Pocket status (total: N)` | N = cantidad de bolsillos | N=0 con tablero vacío | — |
| Banda `Target reached N` | N = conteo servido de alcanzados | N=0 imprime igual | R-1 |
| Banda `In progress N` | N = en plan + en riesgo + **vencidos** | los vencidos cuentan acá porque no llegaron al objetivo y no se cerraron: están tarde, no terminados. Es lo que hace que las dos bandas sumen el total | R-1 |
| `N at target` | derivado: alcanzados menos excedidos | ganchillo, no cuadrado | R-3 |
| `N above target` | conteo de nivel | azul | R-1 |
| `N on plan` | conteo de nivel | teal | R-1 |
| `N at risk` | conteo de nivel | ámbar | R-1 |
| `N overdue` | conteo servido | **aparece dos veces**: en su banda y en alertas | R-1 |

**Borde crítico:** con todo vencido, la banda dice 4 y sus lecturas dicen
`0 on plan · 0 at risk · 4 overdue`. Si el vencido no tuviera lectura propia, la
banda declararía una cifra que sus lecturas no pueden justificar.

### 2.2 Héroe del tablero — la fila de alertas

| mensaje | cuándo aparece | regla |
|---|---|---|
| encabezado `Alerts` | si hay al menos una alerta | **sin conteo**, porque todo lo suyo ya está contado arriba: sería contar dos veces |
| `N overdue` | vencidos > 0 | rojo — fecha ya perdida |
| `N at risk` | en riesgo > 0 | ámbar — **todavía se puede evitar**, y esa es la única diferencia que la fila gradúa |
| `N with allocation not covered` | sin respaldo > 0 | rojo — la plata ya no está. Nombra **qué falló**, no etiqueta al bolsillo |
| la fila entera | desaparece si las tres son cero | R-1 |

**Por qué el sin-respaldo no puede subir a la partición:** un bolsillo sin
respaldo sigue estando en alguno de los cinco niveles, así que contarlo como par
lo contaría dos veces y rompería el total.

### 2.3 Héroe del tablero — la ecuación y el excedente

| mensaje | regla |
|---|---|
| `Target`, `Total allocated`, `Still to allocate` | R-7 |
| `$X committed above target` | **solo si el excedente > 0**. Sin él las tres cifras de arriba parecen un error de aritmética: reconcilian como asignado − excedente + faltante = objetivo, no como una resta, porque el servidor recorta el faltante bolsillo por bolsillo antes de sumar |
| `N%` de progreso | ausente como guion si el servidor retuvo la cifra; **nunca 0%**, que sería otra afirmación |

### 2.4 Héroe del tablero — Next target

| caso | qué muestra |
|---|---|
| hay algo corriendo | el de fecha más cercana |
| no hay nada corriendo pero sí vencidos | **el más vencido** |
| todos alcanzaron su objetivo, o no hay bolsillos | **la tarjeta no se renderiza** |

**El borde que esto arregla:** excluir a los vencidos dejaba la tarjeta en blanco
justo en el tablero donde más falta hace la dirección — cuatro bolsillos
levantando alerta y la tarjeta diciendo que no hay nada pendiente.

**Propiedad forzosa, no casualidad:** en riesgo es ≤30 días y en plan es >30, y
la tarjeta toma el mínimo, así que **si existe alguno en riesgo la tarjeta lo
muestra siempre**. Su cuadrado es un resumen: ámbar significa que hay al menos
uno en riesgo; teal, que todo lo que corre tiene margen; rojo, que no queda nada
corriendo.

### 2.5 Tarjeta de la lista

| mensaje | casos | regla |
|---|---|---|
| palabra de nivel | las cinco, del mapa | R-4 |
| nota | la del bolsillo, o guion | R-6 |
| `$X` y `TARGET $Y` | el objetivo se **nombra**, no se relaciona | una preposición como *of* afirma que el segundo es el todo, y un bolsillo pasado de objetivo lo desmiente en pantalla |
| `Over target` / `Still to allocate` | según el signo del faltante | R-2, R-7 |
| ritmo: `$X` | hay fecha por delante | |
| ritmo: `Not needed` | ya alcanzó el objetivo — **cero exigido** | |
| ritmo: `$X now`, rótulo `To settle` | **fecha pasada** — no hay tasa porque no hay tiempo, pero sí hay monto | |
| fuentes: `No funding account yet` / `Funded by N accounts` | | |
| aviso de respaldo | frase entera, no una etiqueta | |
| lista vacía | `No pockets yet…` distinto de `No pockets match "X"` | R-6: vacío y filtrado son dos respuestas |

**El campo de ritmo tiene tres ausencias y son distintas:** nulo es una fecha ya
pasada, cero es un objetivo ya cubierto, y un monto es una exigencia. Ninguna es
una cantidad de plata por mes.

### 2.6 Pantalla de detalle

| mensaje | casos |
|---|---|
| lectura de fecha | palabra del nivel si alcanzó · `N days late` · `Due today` · `N days away` |
| veredicto de ritmo | `The target is covered…` · `$X a month keeps this target on its date.` · **el bloque entero se omite** si la fecha pasó |
| tasa exigida | `$X / month` o guion |
| finalización proyectada | guion — **el endpoint no existe todavía**, y un cero afirmaría una fecha |
| fuentes vacías | `No account has committed cash to this pocket yet…` |
| historial vacío | `Nothing has been committed or released yet.` |

La lectura de fecha guarda **solo lo que ningún otro bloque dice**. La fecha ya
está en el panel y el ritmo en su tarjeta; repetirlos ponía la fecha dos veces y
la tasa tres en una misma pantalla.

### 2.7 Panel del detalle

| mensaje | casos |
|---|---|
| `N% allocated` | sobre la barra que lee — nunca al lado del faltante, donde se leía como el faltante |
| `$X over target` · `Nothing left to allocate` · `Still to allocate $X` | R-2, R-7 |

### 2.8 Modal de comprometer y liberar

| mensaje | casos |
|---|---|
| título y explicación | **una copia por dirección**, comprometer o liberar |
| bloque del plan | objetivo, fecha, asignado, y faltante **o** `Over target` |
| techo por cuenta | `Unassigned` al comprometer, `Committed` al liberar |
| conversión | consultando · resuelta con su tasa · **fallida con reintento** |
| sin tasa | `No rate for XXX right now…` y el monto se guarda igual |

**Las tres de conversión no son grados de una misma.** Una consulta en vuelo no
es un fracaso, y ninguna de las dos es "no hace falta convertir" — que era el
caso que antes se veía idéntico a un fallo.

---

## Parte 3 — Lo que el inventario destapó y sigue abierto

**Cuatro palabras para dos hechos temporales.** La tarjeta dice `N days overdue`
y `N days left`; el detalle dice `N days late` y `N days away`. Mismo hecho,
cuatro redacciones. Hay que elegir un par y aplicarlo a los dos.

**El endpoint de la tasa lograda no existe**, así que la finalización proyectada
y la tasa real imprimen guion en una tarjeta que declara dos columnas. Está
correcto como ausencia y pendiente como funcionalidad.

**El relleno teal del cuadrado por defecto se pinta por respaldo hexadecimal**:
la variable que la regla nombra no está declarada. Funciona y no está escrito
sobre un token.

**Los conteos de nivel se derivan en el cliente** recorriendo las filas, mientras
alcanzados y vencidos vienen servidos. Es correcto hoy —el umbral de treinta días
es regla de presentación y el modelo no tiene de dónde leerlo— pero significa que
**el tablero y el servidor pueden discrepar si alguna vez el servidor sirve esos
conteos**. Antes de servirlos hay que decidir cuál manda.
