# DECISIONES ABIERTAS — esperando al desarrollador

**Abierto 2026-08-25. Vive en `plan-docs/`, que está en `.gitignore`: no produce commit.**

Este archivo es lo contrario de `DECISIONS.md`. Aquel registra lo **rechazado**,
para que no se vuelva a proponer. Éste registra lo que **todavía no se decidió**,
con las opciones evaluadas, lo que gana y lo que cuesta cada una, y una
recomendación. Cuando una decisión se cierra, la opción descartada baja a
`DECISIONS.md` y la fila sale de aquí.

**Cada decisión es autónoma.** Se lee sin la conversación que la originó: dice qué
se decide, contra qué código, y qué cambia según la respuesta.

---

## Indice

| # | decide | bloquea |
| --- | --- | --- |
| D7 | Una cuenta que no existia en el mes: se oculta o se marca? | El paso 3 |

**Queda una sola.** D1 a D6 y D8, mas la pregunta del alcance del editor,
cerraron el 2026-08-29. Bajaron al
final de este archivo con la decision y el principio que cada una dejo. Los pasos
son los de la secuencia del bloque `D` de `NEXT_SESSION.md`.

---

## Cerradas el 2026-08-29 — con los principios que produjeron

Cinco decisiones del bloque de edicion y la pregunta sobre el alcance del editor.
Cuatro de ellas el desarrollador las elevo de decision puntual a **regla general**,
y esa regla es lo que hay que aplicar, no el caso que la origino.

### D1 — la ficha de detalle es la puerta canonica

**Decidido: si.** Y como principio:

> **Account Detail es el punto canonico para administrar una cuenta.** Desde ahi:
> ver, editar, borrar, y las acciones propias del dominio — transferir y ver
> asignaciones en una cuenta bancaria, registrar un movimiento en un deudor,
> asignar y liberar en un bolsillo.

El usuario no salta entre modulos para administrar un objeto. Accounting conserva
su menu modal de tres opciones como atajo.

**Acotado por el desarrollador el 2026-08-29, despues de cerrar esta decision.**
La puerta de una ficha de detalle es **solo editar**, y no es el menu de tres
opciones: es un control de edicion que abre el editor directamente, como ya hacen
el nivel 2 y el nivel 3 con su lapiz. **El borrado se ofrece unicamente desde
accounting.**

Dos consecuencias que hay que leer juntas con el principio de arriba, porque lo
recortan. Primera: el principio enumera *ver, editar, borrar*, y el borrado queda
fuera de la ficha — quien lea solo esa frase implementaria de mas. Segunda: la
regla de **D4**, no regresar nunca a una ruta cuyo recurso ya no existe, **no
alcanza a esta unidad**: sin borrado en la ficha no hay pantalla que se quede sin
sujeto, y ese era el unico riesgo real que la unidad arrastraba.

El argumento que lo decide: en una ficha de detalle el menu pierde *ver detalle*
—ya estas ahi— y sin borrado le queda una sola opcion. **Un menu de una opcion no
es un menu.**

**Lo medido el 2026-08-29, que es lo que hace falta construir:** ninguna de las dos
puertas existe todavia. `AccountActionsMenu` se renderiza en un solo sitio,
`AccountingDashboard.tsx:735`, y el lapiz de budget esta apagado por
`const SHOW_BUDGET_PENCIL = false` en `CategoryDetail.tsx:63`, que es el primer
termino del `&&` de `:158-162`.

> **Re-medido el 2026-08-30. Dos de las tres cifras cambiaron y la primera frase ya
> no es cierta.**
> - **La puerta de edicion existe y esta puesta en las cuatro fichas.** El control
>  de edicion vive en `frontend/src/fintrack/general_components/accountEditLink/AccountEditLink.tsx`
>  y lo renderizan `pages/forms/accountDetail/AccountDetail.tsx:192`,
>  `pages/forms/categoryDetail/CategoryDetail.tsx:328` y
>  `pages/forms/debtorDetail/DebtorDetail.tsx:244`. El bolsillo tiene el suyo,
>  `pages/forms/pocketDetail/PocketEditLink.tsx`, porque su editor es el del modulo
>  de pocket y no el editor de cuenta.
> - **El menu ya no se renderiza en un solo sitio.** Son dos:
>  `pages/accountingDashboard/AccountingDashboard.tsx:741` y
>  `pages/forms/pocketDetail/PocketDetail.tsx:542`. El archivo esta ademas en
>  `pages/accountingDashboard/`, no en `pages/accounting/`.
> - El lapiz de budget sigue apagado: `CategoryDetail.tsx:63` declara
>  `const SHOW_BUDGET_PENCIL = false` y es el primer termino del `&&` de `:158-162`.
>  Esa cifra se confirma sin cambios.
>
> El principio y el acotamiento de arriba no se tocan; lo que cambio es que la
> unidad que los implementa ya no esta por construir en su mayor parte.

### D2 — el control muerto del nivel 2 se borra

**Decidido: borrarlo**, con un hueco que mantenga el titulo centrado. La lista de
cuentas de una categoria es una vista intermedia por diseno; la edicion vive en el
nivel 3. El principio: **un boton sin la entidad o el id que su accion necesita es
un defecto de interfaz, y se quita — no se le inventa una navegacion.**

### D3 — efectivo se edita como banco

**Decidido: el mismo formulario.** Y el principio, que es sobre la forma del
editor y no sobre este tipo:

> La arquitectura es **una configuracion de cuenta con diferencias por tipo**, no
> un formulario por tipo. `BankForm`, `CashForm`, `InvestmentForm` solo se
> justifican si las diferencias lo exigen, y aqui no lo hacen.

**Medido:** cero cuentas de tipo efectivo en `fintrack_dev`, y la palabra no
aparece ni una vez en `frontend/src`. La fila del catalogo,
`005_base_catalogs.sql:43`, se queda inerte: borrarla costaria una migracion y no
corrige ningun estado incorrecto.

> **Re-verificado el 2026-08-30, sin cambios.** El literal `'cash'` sigue sin
> aparecer en `frontend/src`, y `005_base_catalogs.sql:43` sigue siendo
> `(7, 'cash')` dentro del `INSERT` de `:36-44`. La medicion de cuentas en
> `fintrack_dev` no se re-tomo: este pase no consulto ninguna base.

### D4 — el retorno tras borrar

**Decidido: a la raiz del modulo de origen**, reusando el `originRoute` que el
handler del dashboard ya arma. El principio:

> **Despues de eliminar una entidad, nunca regresar a una ruta cuyo recurso ya no
> existe.**

Y una medicion que reduce el alcance: `EditAccount.tsx` no contiene ninguna
referencia a borrado, y el borrado se invoca desde el menu de accounting. La regla
se aplica al camino de borrado, no al editor.

### D5 — el mes tope lo dice el servidor

**Decidido: el endpoint de transacciones devuelve el mes corriente en la zona del
dueno.** El principio:

> **El navegador no es la autoridad financiera.** Zona del usuario en el servidor,
> y de ahi el mes contable corriente.

**Cambia contrato**, asi que lleva su requisito de frontend escrito en el plan que
posee el endpoint. Conecta con la misma regla que gobierna el mes en budget.

### El alcance del editor — deudor si, bolsillo no

**Decidido: bolsillo queda fuera de edicion hasta que el modulo este definido por
completo.** Deudor se queda como esta.

**Lo medido:** el editor cubre bolsillo hoy — `accountEditSchema.ts:168` declara
sus campos y `accountEditController.js` escribe meta, fecha y nota. Y ese
controlador contiene **cero** referencias a `exchange_rate` o
`currencyAmountConversion`: escribe la meta sin convertir. Es la corrupcion viva
que `POCKET_DECISIONS.md` seccion 15.5 registra.

> **Re-medido el 2026-08-30: la mitad de frontend ya se ejecuto, la de backend no.**
> - `frontend/src/fintrack/editionAndDeletion/validations_zod/accountEditSchema.ts`
>  ya **no** declara campos de bolsillo. `ACCOUNT_EDIT_SCHEMA_CONFIG` (`:61`) tiene
>  hoy cinco claves — `bank` (`:63`), `investment` (`:64`), `income_source` (`:68`),
>  `category_budget` (`:74`) y `debtor` (`:146`) — y `pocket_saving` no esta entre
>  ellas. La decision quedo aplicada por ese lado.
> - `backend/src/fintrack_api/controllers/accountEditController.js:89-102` conserva
>  el `case 'pocket_saving'` del `switch`, que sigue aceptando `target`,
>  `desired_date` y `note`. El camino sigue abierto en el servidor aunque ninguna
>  pantalla lo llame.
> - La ausencia de FX se confirma: `accountEditController.js` sigue con **cero**
>  ocurrencias de `exchange_rate` y de `currencyAmountConversion`.

Sacar bolsillo del editor cumple la decision y **elimina la corrupcion sin escribir
el arreglo de FX** para un camino que se retira. Queda una consecuencia que
aceptar: hasta que la rama del modulo de pocket se integre, un bolsillo no se
podra editar por ningun camino. Eso es exactamente lo que la decision pide.

**No cubierto por esto:** las filas ya escritas con la meta sin convertir. Son
reparacion de datos y no tienen plan.

### D6 — la altura del textarea sale del atributo de filas

**Decidido: el atributo `rows` del `textarea`, con `height: auto` y
`resize: none`.** Es una unidad de lineas de texto, no un valor de pixel, asi que
no codifica nada crudo ni obliga a acunar un token. El principio: **no se acuna un
token del sistema de diseno para resolver un caso tan especifico**; si en pantalla
queda corto, el token se plantea entonces y como decision propia del sistema.

El campo lleva la clase `input__container` (`UniversalDynamicInput.tsx:119-128`),
cuyo `height: 2.625em` de `forms-styles.css:165-172` es una sola linea, contra un
maximo de 90 caracteres.

> **MARCADO, no tachado — medido el 2026-08-30. La decision se ejecuto, pero con
> otro mecanismo del que decidio.**
>
> **Que afirma la decision:** la altura sale del atributo `rows` del `textarea`,
> con `height: auto` y `resize: none`, precisamente para no acunar un token ni
> escribir un valor crudo.
>
> **Que dice el codigo.** No hay ningun atributo `rows` en
> `frontend/src/fintrack/editionAndDeletion/pages/editionAccount/UniversalDynamicInput.tsx`;
> la clase `input__container` se aplica en `:120` y `:136`. La altura la fija una
> regla CSS nueva en `frontend/src/fintrack/pages/forms/styles/forms-styles.css`,
> sobre el selector doble `textarea.input__container, .input__container--note`
> (`:199-200`), expresada en unidades `lh` — una caja de linea — con cuatro lineas
> en lugar de tres, y un comentario que documenta la medicion a 360px. La regla de
> `.input__container` sigue en `:165-172` con su `height: 2.625em`, tal como dice
> la medicion de arriba.
>
> **Que necesita.** `lh` no es un pixel crudo ni un token inventado, asi que
> respeta el principio; pero no es lo que la decision nombro, y el fallback donde
> `lh` no se soporta lo dice el propio comentario: se cae a la altura de una linea.
> **Queda para el desarrollador** ratificar `lh` como la forma acordada o pedir el
> `rows` que la decision escribio.

### D8 — el boton de envio lo estiliza su propio componente

**Decidido: se queda `general_components/formSubmitBtn/styles/formSubmitBtn-style.css`**
y la apariencia base se muda alli desde `forms-styles.css:244-254`. El diff toca
las dos hojas una vez; la definicion partida se paga cada vez que alguien busca
donde se estiliza el boton. El principio, que va mas alla de este boton:

> **Un componente, una fuente de estilos.** Nunca dos hojas globales compitiendo,
> donde cual gana depende del orden de importacion y no de una decision.

Hoy `forms-styles.css` define toda la apariencia y **ningun** estado, y la hoja del
componente define solo el deshabilitado, ademas mal: hex crudo, opacidad
equivocada y `cursor` en lugar de `pointer-events`. Los cinco estados se escriben
una vez, en la hoja que sobrevive, y en su propio commit sobre todos los
formularios.

> **Re-medido el 2026-08-30: el diagnostico empeoro, no mejoro.**
> - Las lineas se movieron. `.submit__btn` en
>  `frontend/src/fintrack/pages/forms/styles/forms-styles.css` esta en `:283-293`,
>  no en `:244-254`; ese tramo hoy es `.tiles__container` y `.nature__tiles`.
> - La hoja del componente ya **no** declara solo el deshabilitado: define tambien
>  toda la apariencia base, duplicada,
>  `general_components/formSubmitBtn/styles/formSubmitBtn-style.css:10-22`. O sea
>  que las dos hojas globales ahora declaran la misma apariencia y sigue ganando la
>  del orden de importacion.
> - El deshabilitado sigue mal escrito en `:25-35`: `background-color: #ccc` en hex
>  crudo, `opacity: 0.7` y `cursor: not-allowed` en lugar de `pointer-events: none`.
> - Aparecio ademas un modificador `.submit__btn--light` en `:66-95` que si declara
>  `:hover`, `:focus-visible`, `:active` y `:disabled`. La decision se tomo sobre
>  dos hojas y hoy hay dos hojas mas un modificador con estados propios.


---

## D1 · Dónde vive la entrada a editar una cuenta

**Qué se decide.** Si editar una cuenta sigue siendo una acción que sólo ofrece el
accounting dashboard, o si la ficha de detalle pasa a ser la puerta canónica y la
lista queda como atajo.

**El estado hoy.** Sólo el dashboard abre el editor, con `handleEditAccount` en
`AccountingDashboard.tsx:492-503`. Cuatro fichas de detalle renderizan un control
muerto — un `<div id='edit' className='flx-col-center icon3dots'>` sobre un
`<Link to='edit'>` comentado — en `AccountDetail.tsx:193`, `CategoryDetail.tsx:328`,
`DebtorDetail.tsx:208` y `PocketDetail.tsx:161`.

> **Medido el 2026-08-30: este párrafo describe un estado que ya no existe.**
> El literal `id='edit'` no aparece en ningún `.tsx` de `frontend/src`; la única
> mención que queda es el comentario de
> `general_components/accountEditLink/AccountEditLink.tsx:5`, que dice explícitamente
> que ese componente reemplazó al `<div id='edit' className='icon3dots'>` de las
> cuatro pantallas. Los cuatro controles muertos son hoy enlaces vivos:
> `AccountDetail.tsx:192`, `CategoryDetail.tsx:328`, `DebtorDetail.tsx:244`, y el
> bolsillo con su propio `PocketEditLink.tsx`.
> `handleEditAccount` se movió a `AccountingDashboard.tsx:488-500`, en
> `pages/accountingDashboard/`.

**Opción A — seguir concentrado en el dashboard.**
- A favor: un solo handler, un solo `previousRoute` que armar, un solo sitio donde
  el borrado deja la pantalla sin sujeto. Ya funciona.
- En contra: obliga a salir del módulo donde estás parado para tocar el objeto que
  estás mirando. Y desde que `EditAccount` absorbió la escritura del budget, con el
  lápiz apagado por `SHOW_BUDGET_PENCIL = false` en `CategoryDetail.tsx:64`, **el
  módulo de budget se quedó sin ninguna forma de cambiar un budget sin salir de él.**

**Opción B — la ficha de detalle es la puerta canónica, la lista es atajo.**
- A favor: es la práctica establecida en apps de finanzas personales — un objeto se
  edita donde se inspecciona. Y repone la capacidad que budget perdió, dentro de
  budget.
- En contra: cuatro handlers en vez de uno, y abre el caso de borrado de **D4**.

**Recomendación: opción B.** El argumento decisivo no es el de práctica sino el
concreto: hoy hay una capacidad perdida en un módulo, y ésta es la que la repone.

### Cuatro puertas cubren siete tipos de cuenta — el mapeo, medido

Una puerta no es un tipo de cuenta, y confundirlos hace creer que faltan pantallas.
`ACCOUNT_TYPE_DETAIL_PAGE`, en `AccountingDashboard.tsx:60-67`, manda **tres tipos a
la misma pantalla**:

| tipo de cuenta | ruta | pantalla | ¿tiene puerta? |
| --- | --- | --- | --- |
| `bank` | `/fintrack/overview/accounts` | `AccountDetail` | sí |
| `investment` | `/fintrack/overview/accounts` | `AccountDetail` | sí, **la misma** |
| `income_source` | `/fintrack/overview/accounts` | `AccountDetail` | sí, **la misma** |
| `category_budget` | `/fintrack/budget/account` | `CategoryDetail` | sí |
| `debtor` | `/fintrack/debts/debtors` | `DebtorDetail` | sí |
| `pocket_saving` | `/fintrack/budget/pockets` | `PocketDetail` | sí |
| `cash` | **no está en el mapa** | cae al `||` de `:444-446`, o sea `AccountDetail` | **por accidente** — ver **D3** |

Así que `investment` e `income_source` no necesitan puerta propia: la de
`AccountDetail` los sirve. El único tipo realmente descubierto es `cash`.

> **Corregido el 2026-08-30. El mapa se movió y perdió una entrada.**
> `ACCOUNT_TYPE_DETAIL_PAGE` está en `AccountingDashboard.tsx:57-63`, no en
> `:60-67`, y la rama `||` por defecto está en `:440-441`, no en `:444-446`.
> Declara **cinco** claves: `bank`, `income_source`, `investment`, `debtor` y
> `category_budget`. **`pocket_saving` ya no está en el mapa**, así que la fila de
> la tabla que le adjudica `/fintrack/budget/pockets` es falsa: hoy caería por el
> `||` igual que `cash`. Esto no es un hueco nuevo — el módulo de pocket se
> reconstruyó contra su propia tabla `pockets` y sus propias rutas, y su ficha se
> alcanza desde ahí — pero la tabla de arriba ya no describe el mapa.

---

## D2 · Qué hace el control muerto de `CategoryAccountList`

**Qué se decide.** El quinto `<div id='edit'>`, en `CategoryAccountList.tsx:253`,
no puede abrir el editor de cuenta. Hay que decidir qué hace en su lugar.

> **MARCADO, no tachado — medido el 2026-08-30. La premisa de esta decisión
> desapareció.**
>
> **Qué afirma:** existe un quinto control muerto en el nivel 2 del módulo de
> budget, y hay que decidir qué hace.
>
> **Qué dice el código.** El archivo está en
> `frontend/src/fintrack/pages/forms/categoryDetail/CategoryAccountList.tsx`, y no
> contiene `id='edit'` ni `icon3dots` — el literal no sobrevive en ningún `.tsx`
> del proyecto. Esa pantalla monta hoy un editor de budget por cuenta:
> importa `budget/components/budgetEditModal/BudgetEditModal.tsx` (`:13`), lleva
> `editingAccountId` en estado (`:94`), lo resuelve en `:103-105` y guarda con
> `setCurrentBudget(editingAccount.accountId, ...)` en `:137`.
>
> **Qué necesita.** La decisión cerrada arriba eligió borrar el control y dejar un
> hueco para conservar la simetría de la cabecera. En el código no quedó ni el
> control ni un hueco: quedó una acción distinta y viva. **Si el nivel 2 debe
> además ofrecer algo en la cabecera es una decisión nueva**, y se deja abierta al
> desarrollador.

**Por qué no puede.** `CategoryAccountList` es el nivel 2 del módulo de budget. Su
ruta se identifica por `categoryName`, su título de cabecera es el nombre de la
categoría, y la pantalla **lista varias cuentas**. No hay un `accountId` que pasarle
a `/fintrack/account/<accountId>/edit`. `PLAN_EDIT_BLOCK` §7.3.1 lo trataba como el
quinto caso de un mismo patrón; quedó corregido el 2026-08-25.

**Opción A — borrarlo.**
- A favor: es un control que no puede actuar; quitarlo deja la cabecera honesta.
- En contra: la cabecera pierde su tercer elemento y el título deja de estar
  centrado entre dos iconos, como en las otras cuatro pantallas.

**Opción B — que abra acciones de la categoría, no de una cuenta.**
- A favor: la cabecera nombra una categoría, así que un menú de categoría es lo
  coherente con lo que la pantalla dice ser.
- En contra: **no existe todavía ninguna acción de categoría.** Renombrar o borrar
  una categoría no está construido, así que esto abre un módulo, no un control.

**Recomendación: opción A, y la simetría se resuelve con un hueco, no con un
control.** Un `<div>` vacío que ocupe el mismo espacio mantiene el título centrado
sin prometer una acción. La opción B es un trabajo con alcance propio y no debe
entrar de contrabando dentro de `U7`.

---

## D3 · Qué hace el editor con una cuenta de tipo `cash`

**Qué se decide.** `cash` es un tipo de cuenta del catálogo que el frontend
desconoce por completo. Antes de abrir las puertas hay que decidir si el editor lo
sirve o lo rechaza.

**Lo medido (2026-08-25).** `005_base_catalogs.sql:36-44` declara **siete** tipos:
`bank`, `investment`, `debtor`, `pocket_saving`, `category_budget`, `income_source`
y `cash`. La palabra `cash` **no aparece en ninguna parte de `frontend/src`**: ni en
el mapa de iconos `ACCOUNT_TYPE_DATA`, ni en el mapa de rutas
`ACCOUNT_TYPE_DETAIL_PAGE` (`AccountingDashboard.tsx:60-67`), ni en la configuración
de campos `accountEditSchema.ts`, que cubre los otros seis. Una cuenta `cash` llega
hoy al detalle sólo por la rama `||` por defecto de `AccountingDashboard.tsx:444-446`.

> **Re-medido el 2026-08-30. El hecho central se sostiene; dos cifras y un conteo
> no.** El literal `'cash'` sigue sin aparecer en `frontend/src`, y
> `005_base_catalogs.sql:36-44` sigue declarando los siete tipos. Pero el mapa de
> rutas está en `AccountingDashboard.tsx:57-63` y la rama `||` en `:440-441`; y
> `editionAndDeletion/validations_zod/accountEditSchema.ts` ya **no cubre los otros
> seis, sino cinco**: `ACCOUNT_EDIT_SCHEMA_CONFIG` (`:61`) declara `bank`,
> `investment`, `income_source`, `category_budget` y `debtor`, y perdió
> `pocket_saving` al aplicarse la decisión sobre el alcance del editor. Así que hoy
> son **dos** los tipos sin configuración de campos, no uno — y el segundo lo está
> por decisión tomada, no por descuido.

**Antes de decidir, medir:** si no existe ninguna cuenta `cash` en las copias
locales, la decisión es barata en cualquier dirección.

**Opción A — darle configuración de campos, reusando la de `bank`.**
- A favor: `basicAccountConfig` ya existe y `bank` la consume tal cual
  (`accountEditSchema.ts:65`); una cuenta de efectivo tiene los mismos campos que
  una bancaria. Cierra el hueco por completo.
- En contra: sirve un tipo que quizá nadie usa, y suma superficie que mantener.

**Opción B — rechazarlo explícitamente en el editor.**
- A favor: honesto sobre lo que el frontend soporta, y barato.
- En contra: deja una cuenta que la base permite crear sin forma de editarla. Un
  callejón sin salida es justamente lo que **D1** está resolviendo en budget.

**Recomendación: opción A si existe alguna cuenta `cash`; si no existe ninguna,
opción A igual.** Cuesta una línea — la misma constante que ya consume `bank` — y
evita volver a esto cuando aparezca la primera. Lo que sí hay que decidir aparte es
si el tipo se ofrece al **crear** una cuenta, que es otro formulario y otro alcance.

**Aparte, en el sentido inverso:** el mapa de iconos carga una clave `other` que no
es un tipo de cuenta — `other` es un *category nature type*
(`005_base_catalogs.sql:49-54`). Entrada muerta, se borra sin decisión.

---

## D4 · A dónde vuelve un borrado hecho desde una ficha de detalle

**Qué se decide.** Abrir las puertas de **D1** crea un camino que hoy no existe:
entrar al editor desde una ficha, borrar la cuenta, y volver.

**Por qué es nuevo.** Desde el dashboard el retorno cae en una lista con una fila
menos, que es un estado válido. Desde la ficha, el `previousRoute` apunta al detalle
de una cuenta que ya no existe.

**Opción A — volver a la raíz del módulo de origen.**
- A favor: siempre existe. Y es donde el usuario habría llegado igual tras cerrar la
  ficha.
- En contra: hay que llevar el módulo de origen en el state. Ya existe el campo:
  `handleEditAccount` pasa `originRoute` (`AccountingDashboard.tsx:492-503`).

**Opción B — volver siempre al accounting dashboard.**
- A favor: un solo destino, cero estado que llevar.
- En contra: saca al usuario del módulo en el que estaba trabajando. Es exactamente
  la fricción que **D1** existe para quitar.

**Recomendación: opción A**, reusando el `originRoute` que el handler del dashboard
ya arma. No hace falta un mecanismo nuevo, sólo que las cuatro puertas lo llenen.

---

## D5 · De dónde sale el mes tope de `AccountDetail`

**Qué se decide.** `AccountDetail` va a pasar de una ventana fija de dos meses a un
mes seleccionable, como ya hizo `CategoryDetail`. El `MonthPicker` necesita un techo
— el mes más nuevo que se puede pedir — y hay que decidir quién lo dice.

**El estado hoy.** `AccountDetail.tsx:113-127` arma la ventana con `new Date()` del
navegador. *(Verificado el 2026-08-30: `const tdy = new Date()` sigue en `:113`.)* `CategoryDetail` lo retiró y lee `referenceMonth` y `currentMonth` del
store de budget. **Ese store no sirve aquí:** una cuenta de banco, inversión, fuente
de ingreso, bolsillo o deudor no pertenece al módulo de budget.

El piso no es problema: sale del `account_start_date` que la pantalla ya lee.

**Opción A — que el endpoint de transacciones devuelva el mes corriente en el
calendario del dueño.**
- A favor: la respuesta que la pantalla ya pide trae también su propio techo, sin
  petición extra. El backend ya sabe resolver hoy en la zona del dueño, con
  `todayInZone` y `getUserTimeZone`.
- En contra: cambia un contrato, así que **lleva su entrada de integración en
  `PLAN_D`**.

**Opción B — pedirlo al endpoint del budget, que ya lo sirve en `meta`.**
- A favor: cero cambio de backend.
- En contra: una petición extra por pantalla, a un módulo con el que la cuenta no
  tiene relación. Contradice la regla de mínimo número de peticiones.

**Opción C — calcularlo con `new Date()` en el navegador.**
- Descartada. Es el defecto que todo el trabajo de zona horaria quitó del backend;
  reintroducirlo en el frontend lo devuelve por la puerta de atrás.

**Recomendación: opción A.** Un campo en una respuesta que ya viaja, contra una
petición entera a otro módulo.

---

## D6 · Cómo se fija la altura del textarea de la nota

**Qué se decide.** El campo de nota debe tener altura fija, suficiente para los 90
caracteres que admite. Hay que decidir con qué se expresa esa altura, porque la
regla de estilo prohíbe valores crudos y prohíbe inventar nombres de token.

**Lo medido.** El `textarea` lleva la clase `input__container`
(`UniversalDynamicInput.tsx:119-128`), cuyo `height: 2.625em` en
`forms-styles.css:165-172` es **una sola línea**. El `maxLength` es 90.

> **Medido el 2026-08-30: esto ya se resolvió, y no con la opción A.** Ver el
> bloque marcado en la decisión cerrada correspondiente, más arriba en este mismo
> archivo. En resumen: no hay atributo `rows` en
> `editionAndDeletion/pages/editionAccount/UniversalDynamicInput.tsx` — la clase se
> aplica en `:120` y `:136` — y la altura la fija una regla nueva en `lh` sobre
> `textarea.input__container, .input__container--note`
> (`forms-styles.css:199-200`), con cuatro líneas y no tres. La regla de
> `.input__container` sigue en `:165-172`.

**Opción A — el atributo `rows` del `textarea`, más `height: auto` y `resize: none`.**
- A favor: `rows` es una unidad de líneas de texto, no un valor de pixel, así que no
  hardcodea nada ni necesita token. La altura sigue al tamaño de fuente heredado.
- En contra: la altura exacta depende del `line-height` vigente, así que hay que
  verificar en pantalla que tres líneas alcanzan para 90 caracteres al ancho real.

**Opción B — acuñar un token de altura para campos multilínea.**
- A favor: un valor con nombre, reutilizable por cualquier otro textarea.
- En contra: **acuñar un token es una decisión del sistema de diseño, no de este
  arreglo**, y la regla dice explícitamente que no se inventan nombres de token.

**Recomendación: opción A**, y si en pantalla queda corta, entonces sí se plantea el
token — pero como decisión propia del sistema de diseño, no dentro de este commit.

---

## D7 · Una cuenta que no existía en el mes: ¿se oculta o se marca?

**Qué se decide.** Al navegar el tablero de budget a un mes anterior, hoy se listan
cuentas que en ese mes todavía no existían. Hay que decidir qué hace la lectura con
ellas.

**Lo medido (2026-08-25).** El guardia existe en la **escritura**:
`budgetAllocationService.js:222-238` rechaza un mes posterior al corriente y
cualquier mes anterior al mes de apertura de la cuenta. **En la lectura no hay
equivalente**: `account_start_date` no aparece ni una vez en
`budget_services/services/budgetCalculationService.js`.

> **Re-medido el 2026-08-30: la asimetría se sostiene, el tramo se corrige.** El
> guardia de escritura va de `budgetAllocationService.js:217` a `:236`: resuelve el
> mes corriente en `:217`, rechaza el mes posterior en `:222-225` y el anterior a la
> apertura en `:231-234`, comparando contra `account_start_month`, que la consulta
> de `:114-117` deriva con `date_trunc('month', ua.account_start_date AT TIME ZONE $3)`.
> En la lectura sigue sin haber equivalente: `account_start_date` aparece **cero**
> veces en `budgetCalculationService.js`. La decisión no perdió su premisa.

Hoy esas cuentas se pintan con budget y gasto en cero, que se lee como *una cuenta
que existía y no hizo nada*, no como *una cuenta que no existía*.

**Opción A — excluirlas de la lectura.**
- A favor: el tablero de un mes muestra exactamente lo que ese mes tenía. Es lo que
  haría un extracto.
- En contra: **cambia los totales del mes**, y hay que verificar que el héroe y los
  encabezados de categoría se reconcilien con la lista más corta. Y una cuenta que
  desaparece al cambiar de mes puede leerse como un fallo si nada lo explica.

**Opción B — mostrarlas marcadas como no aplicables, sin cifra.**
- A favor: el usuario ve que la cuenta existe hoy y por qué no tiene número allí.
  Encaja con la regla de que una cifra ausente se pinta como guion, nunca como cero.
- En contra: alarga la lista con filas que no aportan al mes, y necesita un estado
  visual nuevo que hoy no existe.

**Recomendación: opción A, excluirlas.** Un tablero mensual es un extracto de ese
mes, y una cuenta que no existía no pertenece a él ni siquiera como guion. La contra
—que desaparezcan sin explicación— se cubre con el contador de la barra de filtros,
que ya dice cuántas filas hay.

---

## D8 · Cuál de las dos hojas se queda con `.submit__btn`

**Qué se decide.** El botón de submit está declarado en dos hojas globales a la vez,
y ninguna le da los cinco estados. Hay que decidir cuál sobrevive antes de escribir
los estados, o se escriben dos veces.

**Lo medido.** `pages/forms/styles/forms-styles.css:244-254` define toda la
apariencia del botón y **no declara `:hover`, `:focus-visible`, `:active` ni
`:disabled`**. `general_components/formSubmitBtn/styles/formSubmitBtn-style.css`
declara sólo el estado deshabilitado, como `background-color: #ccc; opacity: 0.7;
cursor: not-allowed` — hex crudo, opacidad equivocada, y `cursor` en lugar de
`pointer-events: none`. Las dos son globales, así que cuál gana depende del orden de
importación, no de una decisión.

> **Corregido el 2026-08-30.** El tramo de `forms-styles.css` es `:283-293`, no
> `:244-254` — ahí hoy están `.tiles__container` y `.nature__tiles`. Y la hoja del
> componente ya no declara sólo el deshabilitado: repite además **toda la apariencia
> base** en `formSubmitBtn-style.css:10-22`, con la misma altura, el mismo radio y
> el mismo par de colores. El deshabilitado sigue en `:25-35` con los tres defectos
> descritos. Se sumó un modificador `.submit__btn--light` en `:66-95` que sí declara
> los cuatro estados interactivos. El diagnóstico de fondo — dos hojas globales
> compitiendo por orden de importación — se agravó: ahora compiten por la apariencia
> completa, no sólo por un estado.

**Opción A — que se quede la hoja del componente, `formSubmitBtn-style.css`.**
- A favor: el componente es el dueño del botón; su hoja es donde alguien lo va a
  buscar. Deja `forms-styles.css` como lo que dice ser, la hoja de los formularios.
- En contra: hay que mover la apariencia base, así que el diff toca las dos hojas.

**Opción B — que se quede `forms-styles.css`.**
- A favor: la apariencia base ya está ahí; el diff es más pequeño.
- En contra: deja la definición de un componente fuera del componente, que es lo que
  produjo el desacuerdo. Y `forms-styles.css` ya es una hoja global sobrecargada.

**Recomendación: opción A.** El diff más grande se paga una vez; la definición
partida se paga cada vez que alguien busca dónde se estiliza el botón.

---

## Decisiones cerradas el 2026-08-25 — registradas, no re-litigables

| # | decisión | por qué |
| --- | --- | --- |
| 1 | **Volver de una vista marca la tarjeta con un realce transitorio; no reabre el modal de acciones** | Una hoja de acciones es un selector que la elección consume. Dos de sus tres acciones — editar y borrar — no encadenan con nada, así que reabrirla le pone un modal encima a quien ya terminó. El problema real era otro: `:focus-visible` no se enciende tras un `.focus()` programático que sigue a una navegación táctil, así que el regreso funcionaba sin verse |
| 2 | **El botón de submit se arregla en su propio commit, sobre todos los formularios** | Es un cambio transversal; mezclarlo con un commit de funcionalidad haría ilegibles los dos |
| 3 | **`AccountDetail` muestra el balance al cierre del mes seleccionado, no el saldo vivo** | La cifra ya se sirve: en modo mes el endpoint devuelve `summary.finalBalance` (`getTransactionsForAccountById.js:464-476`). El campo `Current Balance` de `AccountDetail.tsx:201-204` lee `account_balance`, que sólo coincide con el mes en curso |

> **Anclas corregidas el 2026-08-30, sin tocar ninguna de las cuatro decisiones.**
> En la fila 3: `summary.finalBalance` se arma hoy en
> `getTransactionsForAccountById.js:453` (`finalBalance: carried`) y se sirve en
> `:507` (`finalBalance: getFinalBalance()`), no en `:464-476`. El campo
> `Current Balance` está en `AccountDetail.tsx:204-207` y sigue leyendo
> `accountDetail?.account_balance`, así que el defecto que la decisión describe
> **no está corregido**. Lo que sí cambió es de dónde sale esa cifra: el endpoint de
> la ficha ya no envía la columna almacenada sino la derivada del libro —
> `getAccountController.js:592` la selecciona como `derived_account_balance` y
> `:822-824` la escribe encima de `account_balance` y borra la clave auxiliar.
> En la fila 4: el literal `id='edit'` ya no existe en ningún `.tsx`; el reemplazo
> es `general_components/accountEditLink/AccountEditLink.tsx`, que sí es un
> `<button>`/enlace y no un `div`.
| 4 | **El `<div id='edit'>` se reemplaza por un `<button>`, no se le cuelga un `onClick`** | Un `div` no toma foco, no responde al teclado y no puede declarar los cinco estados que exige la regla de estilo |

## Overlay weight is not normalised across the app — raised 2026-08-30

`--color-surface-overlay` is `rgba(17, 24, 39, 0.7)`, the only overlay value the tokens
declare, and several surfaces dim the page behind them. Dialog scrims are normally
lighter than that, because their job is to mute the ground rather than erase it, and the
tracker's date calendar dims a form the owner is halfway through filling.

**Not a blocker on any module.** What it needs is a sweep: every site that dims, what it
dims, and on which surface — and only then whether the system needs one overlay token or
two. Deciding it from the one screen that raised it is how a token gets written against a
single case.

---

## Correcciones del 2026-08-30 — sólo mediciones

Verificado contra `fix/auth-screen` en `e919a89`, **con el árbol de trabajo incluido**: ahí
están el escritor único de saldo derivado y trece archivos del módulo de bolsillos sin
commitear. **Ninguna decisión se cerró, se borró ni se reordenó.** Todo lo de abajo son
afirmaciones sobre el código.

| dónde | qué se corrigió |
| --- | --- |
| La puerta canónica de la ficha (D1), sección cerrada | La frase "ninguna de las dos puertas existe todavía" es falsa: el control de edición existe y está puesto en las cuatro fichas. Y el menú de acciones se renderiza en **dos** sitios, no en uno |
| El editor de efectivo (D3), sección cerrada | Re-verificado sin cambios; se anota que la medición sobre `fintrack_dev` no se re-tomó |
| El alcance del editor, sección cerrada | La mitad de frontend ya está aplicada — el esquema de edición perdió la clave del bolsillo — y la de backend no: el `switch` del controlador conserva su rama |
| La altura del textarea (D6), sección cerrada | **MARCADO.** Se ejecutó con una regla CSS en unidades `lh`, no con el atributo `rows` que la decisión nombró |
| El botón de envío (D8), sección cerrada | El tramo se movió y el diagnóstico empeoró: la hoja del componente hoy duplica toda la apariencia base, no sólo el deshabilitado |
| La puerta canónica (D1), sección abierta | "El estado hoy" describe cuatro controles muertos que ya no existen; el handler se movió |
| El mapeo de puertas por tipo (D1) | El mapa de rutas se movió y **perdió la clave del bolsillo**, así que la fila de la tabla que le adjudica una ruta propia es falsa |
| El control muerto del nivel 2 (D2) | **MARCADO.** La premisa desapareció: no queda control muerto, y esa pantalla monta hoy un editor de budget por cuenta |
| El editor de efectivo (D3), sección abierta | El esquema de edición cubre cinco tipos, no seis; hoy son dos los tipos sin configuración de campos |
| El mes tope (D5) | Ancla del navegador confirmada |
| La altura del textarea (D6), sección abierta | Remitida al bloque marcado de la sección cerrada |
| La cuenta que no existía en el mes (D7) | La asimetría entre escritura y lectura **se sostiene**; sólo se corrige el tramo del guardia |
| Las dos hojas del botón (D8), sección abierta | Tramo corregido y diagnóstico ampliado |
| Cerradas el 2026-08-25, filas 3 y 4 | Anclas corregidas. El defecto de la fila 3 sigue abierto en la pantalla, aunque la cifra que le llega ya es la derivada del libro |

**Se dejó intacto a propósito.** La única decisión abierta del índice — si una cuenta que no
existía en el mes se oculta o se marca (D7) — sigue abierta, y su medición se confirmó. El
punto levantado sobre el peso del velo el 2026-08-30 no se tocó: el token
`--color-surface-overlay` sigue en `frontend/src/styles/tokens.css:34` con
`rgba(17, 24, 39, 0.7)`, tal como lo describe, aunque ese archivo está modificado y sin
commitear.

**Queda dudoso.** Si la ficha de bolsillo debe seguir renderizando el menú de acciones de
cuenta (`PocketDetail.tsx:542`) es una pregunta que el acotamiento del desarrollador —
borrado sólo desde accounting, un menú de una opción no es un menú — parece responder, pero
no se cerró aquí. Y las mediciones contra `fintrack_dev` de este archivo no se re-tomaron:
este pase no consultó ninguna base de datos.
