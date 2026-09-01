# Plan de trabajo — qué falta y cómo se arregla

**Medido el 2026-08-30 sobre `fix/auth-screen`, cabeza `be6ebbf`, incluyendo trece
archivos del módulo de bolsillos modificados y sin commitear.** Vive en
`plan-docs/`, gitignoreado: no produce commit.

Complementa `ESTADO_PLANES.md`, que dice **dónde estamos**. Este dice **qué hacer**.
Cada punto trae tres cosas: qué falta, dónde está, y cómo se arregla. Ordenado por
lo que destraba más, no por gravedad.

---

## 0. Los cuatro que destraban a los demás

### 0.1 El escritor único de saldo, derivando su propia aritmética

**Sigue debiéndose, y el refactor de hoy no lo construyó** — colapsó un duplicado.
Quedan **dos** escritores y ninguno deriva: los dos aceptan una cifra que el
llamador calculó en JavaScript.

`updateAccountBalance.js:13` y `updateAffectedAccountBalance.js:8`, con el mismo
`UPDATE` byte por byte. Cinco llamadores le pasan una cifra ya computada.

**El arreglo:** una función que reciba cliente, cuenta y dueño, y cuyo `SET` sea la
expresión ya exportada como `derivedAccountBalanceSql` — la misma que consumen los
cinco sitios de lectura. Reemplazar los cinco llamadores y borrar los dos
escritores. **Ninguna decisión pendiente:** la derivación está congelada y el lado
de lectura ya la ejerció.

**Destraba:** la reparación del descuadre, el motor de borrado, el invariante 5 de
deudas, y cualquier indicador de Overview definido como suma sobre cuentas.

> **Corregido el 2026-08-30, después de escribirse este archivo: el punto está hecho,
> y hecho exactamente como lo describe el arreglo.** Este documento se midió sobre la
> cabeza `be6ebbf`; el escritor aterrizó en el árbol de trabajo después, sin
> commitear.
> - Existe `backend/src/utils/fintrackUtils/accountManagement/setAccountBalanceFromLedger.js`,
>  con la firma pedida — cliente, cuenta y dueño — y su `SET` es
>  `derivedAccountBalanceSql('ua', 'NUMERIC')`, la misma expresión que consume el
>  lado de lectura. Filtra por `user_id` en la propia consulta.
> - `accountManagement/updateAccountBalance.js` está **borrado**.
> - Los cinco llamadores están puestos, y los cinco **después** de insertar las filas
>  del movimiento: `transactionController.js:832` y `:838`,
>  `accountCreationController.js:402` y `:910`,
>  `accountCategoryCreationcontroller.js:489`.
>
> **Lo que sigue debiéndose es el segundo escritor**, no el primero:
> `accountDeletionUtils/updateAffectedAccountBalance.js:8` conserva sus dos
> llamadores en el camino de borrado, `deleteAccountService.js:273` y `:311`, sigue
> recibiendo la cifra ya calculada y **no filtra por dueño**. Todo lo que este punto
> dice que destraba lo destraba ese resto, no el conjunto.

### 0.2 La ficha de cuenta lee la columna almacenada, en cuatro consultas

Un mismo deudor muestra dos saldos distintos en dos pantallas del mismo día: las
listas derivan, el detalle no. Cuatro consultas en `getAccountById`
(`getAccountController.js:588`, `:669`, `:695`, `:711`), todas con `ua.*` sin alias
posterior.

**El arreglo:** agregar `${DERIVED_BALANCE} AS account_balance` después de `ua.*` en
las cuatro, para que gane el alias de más abajo. La constante ya está importada en
ese archivo, y las consultas de lista del mismo archivo ya lo hacen. **Va antes que
0.1**, o el escritor se verifica contra una pantalla que lee otro número.

> **Corregido el 2026-08-30: este punto está cerrado, y no se resolvió como el
> arreglo propuesto suponía. No eran cuatro sitios: fue uno.** Commit `17a0714`.
> - La consulta de datos básicos trae la cifra del libro **bajo su propio nombre**,
>  no pisando el alias: `${derivedAccountBalanceSql('ua','NUMERIC')} AS
>  derived_account_balance` en
>  `backend/src/fintrack_api/controllers/getAccountController.js:592`.
> - El controlador escribe esa cifra encima del saldo **en el objeto de respuesta** y
>  borra la clave auxiliar, en `:822-824`:
>  `data.accountList[0].account_balance = accountsResult.rows[0].derived_account_balance`
>  seguido del `delete`.
> - Las ramas por tipo de cuenta siguen seleccionando `ua.*`, y no hace falta tocarlas:
>  la sobreescritura única las neutraliza a todas.
>
> **Consecuencia sobre el orden:** la dependencia que este punto declara —que 0.2 va
> antes que 0.1— ya está satisfecha, y en ese orden. La pantalla lee la derivación
> desde antes de que el escritor aterrizara.

### 0.3 Si una cuenta cerrada retiene su nombre

Decisión sin dueño. El plan de unicidad se la transfirió al de borrado el 30-08 y
ese documento **nunca abrió el espacio**. Mientras tanto tres sitios discrepan:
creación e índice del cliente la tratan como tomada, el chequeo de renombrado no.

**El arreglo:** escribirla como decisión en el plan de borrado, redactada sobre el
**estado** y no sobre la columna — *el registro de una cuenta cerrada sobrevive,
¿su nombre sigue reservado contra una cuenta nueva del mismo tipo?* Una vez
resuelta, un predicado se agrega o se quita en los tres sitios.

**Destraba:** la unidad del editor en el plan de unicidad, y acota dos unidades del
plan de borrado.

### 0.4 Las dos colas del presupuesto, plegadas en el servidor

El encabezado del tablero pone cuadro, palabra de dirección y banda de umbral sobre
un **neto de toda la cartera**, y la bandera que lo decide se inventa en el
navegador porque el contrato no la sirve.

**El arreglo, backend primero:** que `makeTotals` devuelva tres campos más,
calculados del mismo arreglo que ya tiene a mano — una bandera que sea verdadera
cuando **alguna fila** está excedida (no cuando el neto es negativo), la suma de los
restantes negativos y la suma de los positivos. Después borrar la derivación del
navegador y partir la cifra del encabezado en dos cuando ambas colas existen.

---

## 1. Pocket

Lo que aterrizó hoy no se repite acá. Queda esto, en orden:

**El comparador de prioridad no existe en ningún lado.** La regla registrada en la
sección 20.3 del registro del módulo está escrita y sin código. Va como función
exportada junto al ayudante de niveles, leyendo campos que ya vienen en la fila. Es
**prerrequisito de la casilla de próximo objetivo y del orden de la lista**.

**La casilla de próximo objetivo elige por fecha y puede promover un descubierto.**
El filtro descarta financiados y vencidos, no descubiertos. El arreglo son dos
cosas en una línea: agregar la condición al filtro y reemplazar la reducción por el
comparador de arriba.

**Dos de las cinco lecturas de la tarjeta no pintan color.** El trabajo de cinco
niveles de hoy quedó a medias: la hoja declara tres variantes de barra y tres de
porcentaje, y los tonos nuevos caen a la regla base. Faltan cuatro reglas CSS. **Es
la mitad inconclusa de lo de hoy y debería ir con ello.**

> **Remedido el 2026-08-30: el conteo se sostiene y la palabra de estado ya se
> completó.** En `frontend/src/fintrack/pages/pocket/styles/pocket-styles.css`, la
> palabra de estado sí tiene las cinco variantes — `.pocketCard__status--ok` (`:907`),
> `--neutral` (`:914`), `--info` (`:921`), `--warning` (`:925`) y `--alert` (`:929`).
> Las que siguen en tres son la barra —`.pocketCard__barFill--ok` (`:960`),
> `--warning` (`:964`), `--alert` (`:968`)— y el porcentaje —`.pocketCard__percent--ok`
> (`:1007`), `--warning` (`:1011`), `--alert` (`:1015`). Y la tarjeta compone las
> tres clases con el **mismo** tono (`ListPocket.tsx:214`, `:231`, `:239`), así que un
> bolsillo por encima de la meta o en plan pinta su palabra y deja barra y porcentaje
> en la regla base. **Faltan cuatro reglas, tal como dice el punto**:
> `barFill--info`, `barFill--neutral`, `percent--info`, `percent--neutral`.

**La barra de herramientas no existe** — sin búsqueda, sin orden, sin filtros. El
modelo a copiar es el del presupuesto. Todos los campos ya vienen en la fila, así
que no crece ninguna consulta.

**La ficha de cuenta suprime su propia petición** cuando se abre desde el dashboard,
así que los campos de bolsillo que el servidor ya sirve nunca llegan. El arreglo es
borrar la rama condicional. **Es prerrequisito del bloque de efectivo comprometido**,
que tampoco existe.

**La caída del proveedor de tasa es indistinguible de un defecto.** Backend primero:
que el error lleve estado de servicio no disponible; después, que los cuatro
formularios de dinero ofrezcan reintentar en vez de pasar el mensaje crudo.

**La tarjeta de ritmo promete datos que no van a llegar.** Sus dos guiones no están
diferidos: están **descartados por decisión**. El comentario que dice que esperan al
servidor es falso. Se borran las dos líneas y se corrige el comentario.

**El vocabulario está invertido en tres sitios y sobreviven seis *goal*.** Los dos
botones dicen *Commit cash* / *Release cash* donde lo mandado es *Allocate* /
*Release*, y la fila del historial dice *Allocated* donde lo mandado es *Committed*
— las dos palabras están cambiadas de lugar. Un commit de copia, sin backend.

**Dos archivos sin importadores** y los defectos de la hoja legada, incluida una
declaración que es CSS inválido.

---

## 2. Budget

**La partición de tres lecturas con filtro de dos.** El arreglo: ensanchar el tipo
del filtro a tres valores, y que el predicado llame al ayudante de umbral en vez de
comparar contra una segunda copia del 75. Así el filtro y el cuadro leen el umbral
del único sitio que lo posee.

**La palabra de dirección se deriva del signo en cinco superficies** mientras el
servidor manda la bandera. El arreglo: cambiar la firma del ayudante para que reciba
la bandera servida en vez del restante. Cuatro de los cinco llamadores ya la tienen
a mano; el quinto es el encabezado y espera a 0.4.

**El modal imprime `Left $0.00`** donde las otras cuatro pantallas no imprimen nada:
falta aplicar la guarda que el propio modal ya calcula.

**La confirmación bloqueante no existe.** El guardado llama directo. El arreglo: un
segundo estado pendiente junto al que ya existe para el borrado, disparado cuando el
mes es pasado o el rango es abierto, con una frase que **nombre el mes** — una
confirmación que no lo nombra no descarga la decisión. **Prerrequisito del lápiz del
nivel 3**, que hoy está apagado por una constante y que además refuta la decisión de
mes pasado con su propia comparación.

**El encabezado del porcentaje dice lo contrario de lo que es.** Dos cadenas
idénticas. `% of budget spent`.

**El aviso de categoría con monedas mezcladas se sirve y no se pinta**, porque el
arreglo del arreglo es que el arreglo de avisos es posicional y el cliente toma el
primero. Se resuelve etiquetando los avisos en el servidor, o seleccionando en el
cliente sin tocar el contrato.

**El nivel 1 no tiene estado vacío.** El nivel 2 ya lo resolvió — copiar esa frase y
esa clase, no inventar un segundo tratamiento. Y dejar de imprimir importes cuando
el servidor no nombró moneda.

**El total remanente del dashboard resta mensual menos vida entera**, y no lo lee
nadie. El arreglo correcto es **borrarlo**, no repararlo: la respuesta mensual ya la
sirve bien el endpoint de estado del presupuesto.

**El horizonte de planificación es una constante del cliente** donde la decisión dice
que es regla de negocio del servidor. Nombrarla en el backend, servirla, y borrar la
constante.

**La serie mensual tiene cero llamadores.** Es la superficie nueva más grande que
queda y no destraba nada, por eso va última.

---

## 3. Backdating

**Lo único que su propio autor lista como pendiente es la verificación**, y no se
corrió ninguno de los diecisiete chequeos. Dos solo pueden correrse ahora y uno ya
no puede correrse nunca: la comparación fila por fila contra la columna dejó de ser
posible cuando los escritores cambiaron.

**El arreglo:** ejercer la aplicación contra la base de desarrollo, empezando por el
chequeo de que la serie se recalcula alrededor de una inserción retrofechada y por el
de que el techo que el servidor impone es el que la pantalla mostró — los dos que el
trabajo de derivación pudo romper en silencio. **Depende de 0.2**, porque uno de los
chequeos compara la ficha contra las listas y la ficha todavía lee la columna.

Y una constancia para cuando se haga: el saldo inicial en modo mes devuelve el saldo
**posterior al movimiento más viejo del mes**, no el que se arrastra al período. Un
movimiento retrofechado va a mover esa cifra visiblemente, y eso es la definición
encontrándose con una fila retrofechada, no una regresión.

---

## 4. Borrado de cuenta

**El borrado que la interfaz ofrece aborta en el `DELETE`, no en el `COMMIT`.** Las
tres claves foráneas son restrictivas y **no diferidas**, así que la anulación entera
se revierte y las filas compensatorias recién escritas se descartan. Dispara sobre
cualquier cuenta con historial, incluida su propia fila de apertura.

**El arreglo:** escribir la cola de borrado como un ayudante llamado desde los dos
puntos — desprender los punteros de contraparte, sanear la identidad del texto
superviviente, borrar las filas propias del objetivo, y recién entonces borrar el
objetivo. **Depende de 0.1 y del emparejamiento**, y una decisión lo bloquea: qué
etiqueta neutra reemplaza al nombre borrado en las descripciones supervivientes.

**Las filas compensatorias nunca debitan la cuenta que se borra**, y cuando la
contraparte es la cuenta de frontera las dos patas caen sobre ella y se cancelan. El
arreglo: elegir el par entre la cuenta afectada y **el objetivo**, y agregar el
objetivo al conjunto bloqueado.

**El cliente todavía dicta los ajustes.** El servidor deriva los saldos desde hoy,
pero toma del cuerpo de la petición **quiénes** son los afectados y **cuánto** se les
ajusta. El arreglo es el endpoint de evaluación, que no existe: calcular la
proyección de contraparte en el servidor dentro de la transacción y reducir el cuerpo
a un eco que se compara y se rechaza si difiere.

**El borrado suave es inejecutable dos veces:** interpola un identificador que no
está en el alcance, y si se quitara esa línea fallaría por aridad — el texto lleva
dos marcadores y se le pasa un arreglo de uno. El arreglo mecánico es agregar el
parámetro. Pero una decisión gobierna si vale la pena: **si el borrado suave se
retira o se promueve a la operación de cierre**. Las dos cosas están escritas y no
pueden ser ambas.

**La creación de cuenta sigue sin postear el saldo de la cuenta que financia.** Hoy
se derivó la cifra y **se dejó la escritura comentada** en los dos controladores. El
arreglo: descomentarlas, quitarles el cuarto argumento que el escritor no acepta, y
enrutarlas por el escritor derivado de 0.1.

> **Corregido el 2026-08-30: las dos escrituras existen y van por el escritor
> derivado.** En el árbol de trabajo, sin commitear.
> - `accountCreationController.js:402`, guardada por `if (isTransfer)` con la razón
>  escrita al lado — sin importe inicial no hay fila de contraparte, así que no hay
>  proyección que haya cambiado.
> - `accountCategoryCreationcontroller.js:489`, guardada por `if (!isAccountOpening)`
>  por el mismo motivo.
> - Y una tercera que este punto no contaba, `accountCreationController.js:910`, sin
>  guarda porque en ese camino la fila de contraparte siempre se escribe.
>
> Las tres llaman a `setAccountBalanceFromLedger(client, accountId, userId)`, con tres
> argumentos, **después** de `recordTransaction`. El cuarto argumento que el arreglo
> temía no existe.

---

## 5. Unicidad de nombre

**Ninguna de las cinco pantallas lee el estado triple** que la primera unidad
construyó para eso. Dos calculan la colisión y la descartan; tres ni siquiera
consultan el hook.

**El arreglo:** en cada pantalla, agregar la comparación contra *tomado* a la
expresión que deshabilita — **nunca contra *distinto de libre***, porque el estado
desconocido no debe deshabilitar, y eso ya está decidido. Dos de las cinco pueden
embarcar ya; la del editor depende de 0.3.

**La unidad del formulario de bolsillo tiene la premisa anulada.** Esa pantalla ya no
escribe una fila de cuenta, y la migración declara explícitamente que **no** hay
restricción de unicidad sobre la tabla nueva, con su razón: dos metas pueden
legítimamente llamarse igual. **El arreglo es reescribir la unidad en el plan antes
de escribir código**, y la decisión que lo gobierna es toda la unidad: si dos metas
pueden compartir nombre. Si la respuesta de la migración se mantiene, la unidad se
tacha.

---

## 6. Debts

**El titular se elige por el signo de un neto**, así que el tablero dice *you owe*
mientras una cifra de cobrables debajo lo contradice. El arreglo: sustantivo fijo
para el tablero y la dirección sobre la cifra que sí la describe. Las dos etiquetas
direccionales ya existen una fila más abajo.

**El conteo de saldados se calcula, viaja y se descarta.** El arreglo del cliente son
tres líneas. Pero **necesita un cambio de backend y una decisión**: la consulta de la
lista no sirve una bandera de saldado, así que la lista no puede pintar la tercera
categoría que el titular pasaría a reclamar; y los cuatro caminos de lectura no
filtran cuentas cerradas, de modo que *saldado* mezclaría a quien pagó con quien fue
retirado. Esa es la misma decisión que 0.3.

**Cada fila deduce su dirección del signo** y etiqueta como deudor a un saldado. Las
dos banderas del servidor ya viajan y **están comentadas dos líneas más arriba**. El
arreglo es descomentarlas y ramificar en tres estados.

**Siete cifras del titular caen a cero literal.** El arreglo tiene un acoplamiento
obligatorio: quitar esos respaldos **arma la trampa del formateador**, que imprime
`$0.00` ante un nulo porque el parámetro por defecto solo dispara con indefinido. Hay
que guardar el formateador en el mismo commit o el arreglo reintroduce el defecto que
quita.

**La ventana del extracto se calcula con el reloj del navegador.** El ayudante que lo
resuelve ya existe: dos llamadas, ningún helper nuevo.

**El importe formateado a mano**, las filas indexadas por posición, la clase escrita
con punto inicial y el borde de depuración: cuatro arreglos de una línea cada uno.

---

## 7. Tracker UX

**La regla de la tarjeta fija posición absoluta y desplazamiento superior sin declarar
ni alto ni borde inferior**, así que su alto es lo que sea su contenido. **Es la tarea
uno del plan y la puerta de las otras dos**: hasta que el alto tenga origen nombrado,
cualquier cambio de maqueta se escribe contra una suposición.

**El envío disfrazado de afordancia de nota** y **el formulario sin manejador de
envío** van en el mismo commit — el botón que agrega el primero es a lo que se
engancha el segundo. Los dos esperan dos decisiones abiertas: si el envío se muda o
la tarjeta se encoge, y si el glifo desaparece o se redefine.

**El error de tipeo visible** va en un commit que lo diga, no de paso.

> **Corregido el 2026-08-30, después de escribirse este archivo: los dos puntos de
> arriba ya se ejecutaron, y el envío se hizo en cinco commits, uno por pantalla.**
> - El envío se mudó al pie de la tarjeta, a lo ancho, y el formulario lo declara:
>  `onSubmit={onSaveHandler}` más `general_components/formSubmitBtn/FormSubmitBtn.tsx`
>  en `tracker/expense/Expense.tsx:827` y `:897`, `income/Income.tsx:456` y `:512`,
>  `transfer/Transfer.tsx:750` y `:846`, `debts/Debts.tsx:647` y `:714`,
>  `profitNloss/PnL.tsx:601`. Commits `a8d9457`, `e82c99b`, `878915a`, `4623c78`,
>  `fc77d8d`.
> - **La decisión abierta que este punto declaraba bloqueante quedó resuelta de
>  hecho**, y en el sentido de mudar el envío y no de encoger la tarjeta. Este
>  documento no la cierra: la registra como ejecutada y deja que el plan de tracker
>  la formalice.
> - El error de tipeo cerró en su propio commit, `035661b`, y el título dice hoy
>  `'Category / Subcategory'` en `Expense.tsx:343`.
> - Residuo que nadie agenda: `tracker/components/CardNoteSave.tsx` quedó **sin ningún
>  importador** en `frontend/src`.

**La migración a tokens está diferida por decisión**, no pendiente por descuido.

---

## 8. Overview

**Fase 0, escribir acá:** casi hecha, es documentación. La propiedad de la bandera
está decidida.

**Fases 1 y 2, reescribir los documentos antes de cualquier código.** El catálogo de
indicadores y el contrato fueron escritos contra el modelo retirado: el catálogo
todavía lista el tipo de cuenta retirado como vivo, y **ningún documento de Overview
menciona el saldo derivado**. Todo indicador definido como suma sobre cuentas tiene
que nombrar la derivación compartida como su fórmula, o se implementa dos veces.

**Fase 3, reescribir lo que está en la rama antes de fusionar.** Es la única fase con
código y la más dañada. Tres reescrituras obligatorias: el dominio de bolsillo contra
las tablas nuevas; **toda** lectura de saldo contra la derivación compartida, porque
seis sitios suman la columna almacenada; y conversión de moneda antes de agregar.

**El defecto silencioso, y es el que importa:** el código de esa rama filtra por el
tipo de cuenta retirado y une la tabla de extensión que la migración dejó en pie a
propósito. **No falla: devuelve cero.** Fusionarla como está embarca una tarjeta que
miente sin romperse.

Rebasar 182 commits y después reescribir cuesta más que levantar el esqueleto de
archivos y reautorar el SQL sobre la rama viva. El corte en tres capas, los
validadores y el cableado de rutas valen; la capa de base de datos no.

**Fases 4, 5 y 6, escribir acá.** Nada existe en la rama, de ningún lado.

Y una cosa que la pantalla viva tiene y ningún documento agenda: **un cuadro de
estado pintado desde un número aleatorio**, con un comentario que dice que falta
definir la regla. Se borra; no se pinta cuadro hasta que el payload traiga estado.

---

## Correcciones del 2026-08-30 — sólo mediciones

Este archivo se midió sobre la cabeza `be6ebbf`. **La cabeza es hoy `e919a89`**, y entre las
dos entraron doce commits más el escritor derivado que está en el árbol de trabajo sin
commitear. Ninguna decisión se cerró, se borró ni se reordenó; ningún punto cambió de
posición en la lista.

| punto | qué se corrigió |
|---|---|
| 0.1 — el escritor único de saldo | **Está hecho, y hecho como el arreglo lo describe**: la función nueva recibe cliente, cuenta y dueño, su `SET` es la expresión exportada del camino de lectura, el escritor viejo está borrado y los cinco llamadores están puestos después de insertar las filas. Lo que sigue debiéndose es el **segundo** escritor, el del camino de borrado |
| 0.2 — la ficha de cuenta | **Está cerrado, y no como este punto supuso.** No eran cuatro consultas con una línea cada una: la consulta de datos básicos trae la cifra derivada bajo su propio nombre y el controlador la escribe encima de la respuesta, en un solo sitio. La dependencia de orden que el punto declara ya quedó satisfecha en ese orden |
| 1 — Pocket, las cuatro reglas CSS | El conteo se sostiene: faltan cuatro. La palabra de estado ya tiene sus cinco variantes; la barra y el porcentaje siguen en tres, y la tarjeta compone las tres clases con el mismo tono |
| 4 — la creación de cuenta | **Las dos escrituras comentadas ya existen**, más una tercera que este punto no contaba, y las tres van por el escritor derivado con tres argumentos. El cuarto argumento que el arreglo temía no existe |
| 7 — Tracker UX | **El envío disfrazado y el formulario sin manejador cerraron en cinco commits, uno por pantalla**, y el error de tipeo en el suyo. Se anota que la decisión que este punto daba por bloqueante quedó resuelta de hecho, en el sentido de mudar el envío |

**Se dejó intacto a propósito.** Los cuatro puntos de la sección 0 conservan su orden y su
redacción. Las decisiones que cada punto nombra como bloqueantes siguen abiertas: si una
cuenta cerrada retiene su nombre (0.3), si las dos colas del presupuesto se pliegan en el
servidor (0.4), qué etiqueta neutra reemplaza al nombre borrado, si el borrado suave se
retira o se promueve, y si dos metas pueden compartir nombre. El punto 5 ya registraba por sí
mismo que la unidad del formulario de bolsillo tiene la premisa anulada, y esa marca se
confirma: esa pantalla escribe en la tabla de bolsillos y no en la de cuentas.

**Queda dudoso.**
- La sección 3 depende de correr la aplicación contra la base de desarrollo. Ninguno de los
  diecisiete chequeos se corrió en este pase, y ninguno se puede dar por corrido.
- La sección 8, Overview, describe una rama que este árbol no tiene desplegada; sus cuatro
  frentes no se remidieron.
- Los archivos de bolsillos citados por línea están modificados y sin commitear, así que sus
  anclas se vuelven a mover con el próximo guardado.
