TÓPICOS LISTOS, PENDIENTES Y CONSULTAS AL CLIENTE

> **REMEDIDO EL 2026-09-06 SOBRE LA RAMA `main`, CABEZA `20de666d`.**
>
> Cada elemento que cambió de estado en esta pasada se verificó contra el árbol
> de trabajo de ese día, y el archivo y la línea que lo prueban van entre
> paréntesis al lado. Un cambio de estado sin prueba no cuenta.
>
> **Qué NO se remidió — no leerlo como medido:**
>
> - Los elementos que ya estaban marcados LISTO antes de esta pasada **no se
>   reauditaron uno por uno**. Tres resultaron falsos mientras se verificaba otra
>   cosa y quedaron corregidos aquí; el resto conserva su estado anterior sin
>   comprobar.
> - **Nada se probó en un navegador.** Ningún formulario enviado, ninguna
>   pantalla redimensionada, ninguna sesión dejada expirar. Todo elemento cuya
>   prueba es visual o interactiva queda PENDIENTE con la comprobación que le
>   debe un humano escrita al lado.
> - **Ninguna base de datos fue leída**, ni local ni remota, y la aplicación
>   nunca se levantó. Los elementos sobre tipos de columna almacenados, desfases
>   de hora y estabilidad en producción no son verificables desde el código y
>   quedan PENDIENTE.
> - **Nada se midió fuera de `main`.** Los hallazgos que viven en otras ramas
>   quedan fuera de esta pasada.
> - `backend/src` y `frontend/src` se barrieron buscando marcas de trabajo
>   pendiente en los comentarios — `TODO`, `FIXME`, `HACK`, `XXX` — y **no hay
>   ninguna**: cero coincidencias en ambos árboles. Ese barrido no aportó
>   elementos.
>
> Los conteos por grupo están en `summary-issues.md` y la misma lista en inglés
> en `issues-en.md`. Los tres archivos cuentan lo mismo a esta fecha:
> **125 elementos — 81 LISTO, 44 PENDIENTE.**
>
> **Cómo se corrigió cada defecto, con el código.** Las entradas de abajo dicen
> qué quedó resuelto y con qué prueba. El código antes y después, el razonamiento
> de por qué se eligió ese arreglo y no el otro, y la lección que deja, están en
> `FIXES-LOG.md`, una entrada por corrección.

---


GESTION DE MULTIPLES SESIONES. PENDIENTE. Sigue siendo una decision de diseno nunca tomada; no hay codigo que la implemente ni que la impida.
Como se gestionan: 
Multiples sesiones de un mismo usuario. 
Multiples usuarios. 
Multiples sesiones de un mismo usuario en distintos dispositivos. 

AUTENTICACION

Al hacer SIGN OUT, se redirige a Sign In, en vez de ir al menu principal. LISTO.

Revisar la validacion cruzada entre campos password, new password y confirm password en el frontend.LISTO.

Revisar Responsiveness de frontend de formularios de authentication: Sign In, Sign Up, Update user data, Change Password.LISTO.

Revisar validacion en tiempo real en SignUP, de los campos "password" y "confirmPassword". El caso edge es: cuando se introdujeron los dos campos y son diferentes, y en vez de ajustar confirmPassword, se ajusta password para que coincidan los dos, no se valida sino hasta que se edita confirmPassword. LISTO

Revisar y completar la autentication con refresh token. LISTO

Validar el monto target en linea al crear una cuenta pocket. LISTO.

Verificar auth refresh token y la logica de refresh toekn automatico.LISTO.

Porque expira la sesion, si existe un refresh token, que deberia estar actualizado?. PENDIENTE. **El mecanismo ya esta medido, el sintoma no.** La cookie de refresco se escribe sin vida util: ni `maxAge` ni `expires` (`backend/src/utils/authUtils/cookieConfig.js:10-15`), asi que es una cookie de sesion y muere al cerrar el navegador, mientras el token que lleva dentro esta firmado por 8.9 dias (`backend/src/utils/authUtils/authFn.js:95-98`). Falta la comprobacion humana: cerrar el navegador, reabrirlo y confirmar que la sesion se perdio con el token todavia vigente.

Como hacer para recordar al usuario y mantenerlo activo mientras refresh token este vigente. Verificar si esto es deseable. PENDIENTE. Bloqueado por la misma cookie sin vida util del punto anterior, y por una decision de producto sobre cuanto debe durar el recuerdo.

Definir y aplicar un esquema de roles de autorizacion. PENDIENTE. **Definido y nunca aplicado.** La escalera de roles, el guardia de administrador y la fabrica de autorizacion dinamica existen los tres (`backend/src/auth_api/middlewares/authMiddleware.js:228-294`) y **ningun archivo de rutas importa alguno de ellos**: cada ruta protegida usa solo verificacion de token o de propiedad.

ADICIONALES PENDIENTES:

### Tabla de issues pendientes

| #   | Problema                                        | Ubicación              | Severidad | Propuesta                  |
| :-- | :---------------------------------------------- | :--------------------- | :-------- | :------------------------- |
| 1   | La bandera de autenticacion en memoria se separaba del token en almacenamiento | `auth_utils/invalidateSession.ts:29-55` + `auth/hooks/useAuth.ts:170-229` | 🔴 Alta | **LISTO 2026-09-06.** Una sola funcion limpia almacenamiento y estado juntos y es el unico camino que limpia cualquiera de los dos; el arranque de sesion revalida el token guardado contra el servidor en cada montaje y llama a esa funcion cuando falla |
| 2   | Un 401 no terminaba la sesion ni redirigia | `auth_utils/authFetch.ts:56-96`, `auth_utils/authRefreshManager.ts:59-69`, `components/protectedRoute/ProtectedRoute.tsx:40-53` | 🔴 Alta | **LISTO 2026-09-06.** Reintento unico detras de un refresco de vuelo unico; el refresco fallido guarda la direccion de retorno e invalida la sesion; el guardia de ruta redirige llevando la razon de expiracion |
| 2b  | Un token roto respondía 403, indistinguible para el cliente de una negativa de dominio | `auth_api/middlewares/authMiddleware.js:21-25`, `:110-113` | 🔴 Alta | **LISTO 2026-09-09** (`2f641f3a`). El arreglo **no** era ampliar `authFetch.ts:58` a 403, como decía este renglón: ver el bloque de abajo |
| 3   | La validacion de campos no se limpia en el formulario de cuenta nueva | `pages/forms/newAccount/NewAccount.tsx` | 🟡 Media | **PENDIENTE.** No verificable leyendo codigo. Falta la comprobacion humana: llenar el formulario, provocar un error de validacion, cambiar el tipo de cuenta y ver si el mensaje se limpia |
| 4   | El indicador de carga persistia despues de un error | `hooks/useFetchLoad.ts:137-151` | 🟡 Media | **LISTO 2026-09-06** para la capa de carga: el hook baja la bandera en su `finally` pase lo que pase, y expone un reseteo que limpia datos, error y fallo juntos. El reseteo del toast en cada formulario sigue pendiente de comprobacion humana |
| 5   | El manejador que abre el registro usaba el estado equivocado | `auth/components/authPage/AuthPage.tsx:255-260` | 🟢 Baja | **LISTO 2026-09-06.** Pone el modo de inicio de sesion en falso y fija el estado de interfaz de registro, que es el estado correcto para abrir el registro |

**Detalle del renglón 2b — por qué el arreglo estaba en el backend.** `403` en
esta app significa casi siempre *estás autenticado y aun así no*: propiedad del
recurso (`authMiddleware.js:212`), un bolsillo o una cuenta de presupuesto ajenos
(`pocketController.js:10`, `budgetController.js:83,172`), transacciones de una
cuenta ajena (`getTransactionsForAccountById.js:118`), la cuenta de compensación
reservada (`deleteAccountService.js:1601`) y **la contraseña actual incorrecta**
(`userController.js:352`, con `403: Current password wrong (NO logout)` escrito en
`:293`). Ampliar la rama de reintento del cliente a 403 habría deslogueado a quien
sólo se equivocó tecleando.

El defecto real era que `handleTokenError` —invocado sólo desde los dos guardias
de autenticación, `verifyToken:152` y `verifyUser:170`— devolvía 403 en dos de las
tres comprobaciones de `jwt.verify` (firma alterada, `nbf` futuro) y en el caso sin
nombre. Las tres son fallos al establecer **quién** es el llamante, y un token
nuevo las arregla: eso es un 401. Los tres pasaron a 401 y el frontend no se tocó,
porque la rama de 401 de `authFetch.ts:56-96` ya pide un refresco de vuelo único,
reintenta una vez e invalida la sesión si el refresco falla
(`authRefreshManager.ts:59-69`).

**Lo que estaba roto en la práctica.** En el arranque de sesión el 403 se saltaba
esa rama, así que `useAuth.ts:206-211` atrapaba el lanzamiento genérico y cerraba
la sesión **sin haber intentado el refresco ni una vez**, aun con la cookie de
refresco viva. Y en el cambio de contraseña, un token roto se le reportaba al dueño
como un error de tecleo suyo (`useAuth.ts:503-504`).

**Fuera del alcance, anotado:** el endpoint de refresco devuelve 403 para una firma
de refresco inválida (`authRefreshToken.js:36,124`). Es la misma inconsistencia
semántica y **no** es un defecto vivo: `authRefreshManager` invalida ante cualquier
rechazo del refresco, sin mirar el código de estado.

---

BACKEND
Organizar la asignacion de la duracion de cookies y tokens. PENDIENTE. El ayudante de cookie fija banderas pero **ninguna vida util** (`backend/src/utils/authUtils/cookieConfig.js:8-23`), y las duraciones viven en cuatro sitios cuyos comentarios contradicen sus valores: token de acceso de 1h (`backend/src/utils/authUtils/authFn.js:59-62`), token de refresco de 8.9d (`:95-98`), y un campo de respuesta de 3600 segundos rotulado *60 minutos* en un endpoint (`backend/src/auth_api/controllers/authController.js:192`) y *15 minutos* en otros dos (`:335`, `backend/src/auth_api/controllers/authRefreshToken.js:112`).

**NUEVO 2026-09-09 — El umbral de rotación del refresh token lleva un factor mil
de más, así que el token rota en cada refresco.** PENDIENTE. La vida total ya
viene en milisegundos (`authRefreshToken.js:81`) y el umbral la vuelve a
multiplicar por mil (`:86`), de modo que `limitRemLife` queda en 890 días
expresados en milisegundos contra un `remainingTime` que nunca pasa de 8.9 días:
la comparación de `:91` es siempre verdadera. El comentario declara un umbral del
10% de vida restante que nunca se aplica. Cada rotación revoca una fila e inserta
otra (`utils/authUtils/authFn.js:164-194`), así que `refresh_tokens` crece una
fila por llamada al refresco, sin tope. Se midió leyendo el punto anterior, no
estaba en esta lista.

**Ampliación del punto anterior, medida el 2026-09-09 — no es un elemento aparte.**
Tres fuentes declaran tres duraciones para el mismo refresh token, y el punto de
arriba sólo nombraba dos de ellas.
El JWT se firma por 8.9 días (`utils/authUtils/authFn.js:95-98`),
la fila de base de datos caduca a los 7 (`authController.js:149`, `:287`,
`authFn.js:180`) y la cookie no declara ninguna (`utils/authUtils/cookieConfig.js:10-15`).
Manda la más corta de las dos escritas —los 7 días, porque el endpoint filtra
`expiration_date > NOW()` (`authRefreshToken.js:42`)— y por encima de todas manda
la cookie, que muere al cerrar el navegador. Es el mismo mecanismo que el punto de
la sesión que expira con refresh token vigente, contado desde el otro lado.

GENERAL

como hacer DEPLOYMENT.Se logro hacer despliegue del FRONTEND en vercel. LISTO.
El despliegue del BACKEND en vercel, se requiere hacer adaptaciones para que opere como SERVERLESS.Listo.
Backend en vercel, aun no funciona en forma estable.PENDIENTE. La adaptacion sin servidor si esta hecha y declarada (`backend/vercel.json`); la estabilidad solo es medible en produccion y esta pasada no midio produccion.

Como verificar dinamicamente componentes no usados o rotos.LISTO. Con npx knip. Pero no funciona bien para backend. Se reorganizaron algunas carpetas.PENDIENTE buscar una mejor solucion. Confirmado abierto por ausencia: **no hay archivo de configuracion de knip ni la dependencia en ningun `package.json` del repositorio**, asi que no queda nada fijado para repetir la corrida.

POCKET DETAIL
Revisar pocket detail, para accounting view detail, y para budget pocket. No se esta renderizando los datos de las cuentas pocket saving.LISTO

CATEGORY BUDGET DETAIL
Arreglado pocket detial, ahora category detail, no recibe los datos bien, veerificar la estructura de los datos recibidos/enviados por el server.LISTO.

TRANSFER
Responsiveness en transfer, al agregar una linea en To:, no se ve la ui completa. Para una ancho menor de 450 px. La altura debe ser mayor de 842 px. Y normal la altura minima esta en 722 px. ANCHO maximo pra From es 468px, y par To es 450px. LISTO.

TRANSFER. ¿Se puede ser responsive, para que no haya scroll?.Si, LISTO hasta un tamano de 360 x 700px.

Para responsiveness a alturas menores de 700px, se requiere activar el scroll dentro de cards_presentation--tracker y el main navbar container fixed sin ocultar el card. **LISTO 2026-09-06**: la tarjeta toma una altura maxima derivada del viewport y su propio desbordamiento vertical por debajo de 701 px (`frontend/src/fintrack/pages/tracker/styles/tracker-style.css:728-741`).

Para alcanzar un ancho minimo de 320 px hay que ajustar tamanos de altura y ancho del tracker navbar container. PENDIENTE. La consulta de ancho mas estrecha de esa hoja es de 370 px y solo reduce el tamano de fuente de una etiqueta (`tracker-style.css:631-635`); nada atiende los 320 px.

FIX update of total account balance. LISTO.

==== EDICIÓN Y ELIMINACIÓN: Establecer una estrategia para editar y eliminar datos.LISTO.

EDICIÓN
La estrategia a seguir es definir los campos editables y los no editbles, asi como sus interrelaciones en la base de datos. No se prevé edición de transacciones, sino implementar transferencias manuales de reverso entre cuentas. LISTO.

VISTA DE DETALLES DE CUENTA CENTRALIZADA
Desarrollar vista de detalles de cuentas y edicion de cuentas en Accounting Dashboard. LISTO.

Implantar transacciones de reverso para las cuentas expense e income source, de manera de poder realizar reversos manuales entre cuentas, en caso de error de usuario.LISTO.

Implantar edicion de cuentas, datos solamente, no transacciones. Edicion simple.LISTO.

Implantar en la edicion de TODOS LOS CAMPOS, incluyendo text areas y numericos, la validacion en tiempo real, que indique un mensaje de error en tiempo real, y limite la extension o longitud de los campos a la longitud visual en el formulario. LISTO.

ELIMINACIÓN
Desarrollar eliminacion de cuentas.LISTO.
ESTRATEGIA: desarrollar el método "Anulación Retrospectiva Total" de cuentas y transacciones. En el contexto de una aplicación de eliminación de cuentas bancarias se refiere al acto de deshacer o invalidar la existencia de una cuenta bancaria y todas sus transacciones asociadas desde su origen, como si nunca hubiera existido, pero deja registros de cuentas borradas.

ESTO IMPLICA:
Anulación de la cuenta: El cierre de la cuenta no es un cierre estándar a futuro, sino uno que borra o revierte digitalmente su registro completo en el sistema bancario.

Efecto retroactivo: La acción impacta todas las operaciones realizadas desde la apertura de la cuenta hasta el momento de la anulación, en lugar de solo detener las transacciones futuras.

Totalidad: Se eliminan o anulan todos los datos, incluyendo saldos, movimientos, comisiones, y cualquier otro registro contable o de datos personales vinculado a esa cuenta específica.

En la práctica, esto podría ser una característica técnica compleja diseñada para cumplir con normativas de privacidad (como el "derecho al olvido") o para corregir errores graves en la apertura de cuentas. A diferencia de un cierre de cuenta normal, que simplemente la marca como inactiva o cerrada a partir de una fecha determinada, una "anulación retrospectiva total" busca la eliminación completa del rastro digital de la cuenta.

FINTRACK: ACTIVIDADES O ISSUES LISTOS O PENDIENTES.

En el frontend, limitar el numero de caracteres en todos los campos de los formularios.LISTO.
Queda pendiente arreglar para creacion de cuentas de budget, NewCategory account. **LISTO 2026-09-06**: las cuatro entradas de nombre llevan los topes compartidos (`frontend/src/fintrack/pages/forms/newCategory/NewCategory.tsx:479,496,515,532`).

En el frontend. El input del datepicker, acepta otros caracteres aparte de la fecha puesta por el datepicker. LISTO,.

Optimar AccountDeletionPage, usando useReducer Hook, para manejo de estados del modal, en vez de usar funcion centralizada con useMemo.PENDIENTE. Confirmado abierto por ausencia: **`useReducer` no aparece en ningun archivo de `frontend/src`**.

POSIBLES BUGS:

El orden de las transacciones debe ser primero el retiro o withdraw y despues received o deposit?.

DEBTS. Revisar la presentacion de los movimientos debts en el overview, , deberian ser del ultimo al primero , es decir descendentes en fecha y hora. LISTO (ya figuraba resuelto en `issues-en.md` y en `summary-issues.md`; aqui habia quedado sin marcar y se reconcilia).

Reflejar los nombres y apellidos de los debtors, con primera letra en mayuscula.LISTO.

EXPENSE. si se crea una cuenta con mas de 25 caraceteres, se muestra un error warning, pero igualmente se crea con categoria en blanco. errores de pg. PENDIENTE. Falta la comprobacion humana: enviar el nombre demasiado largo y leer la fila creada en la base de datos.

arreglar los colores de los toast de acuerdo con e tipo de error o mensaje. En creacion de cuentas, perfiles, etc. **LISTO 2026-09-06**: un ayudante mapea el rango del estado de respuesta a tipo y color de fondo del toast — exito, error, advertencia e informacion — (`frontend/src/fintrack/helpers/showToastByStatus.ts:10-15`), consumido por el componente de mensaje compartido y por el modal de asignacion de bolsillo. **Defecto nuevo que deja:** escribe cuatro literales de color en vez de consumir variables de diseno (`:11-14`).

se muestran varios toast renderizados, con la misma informacion?. LISTO.

FUNCIONALIDAD Y LÓGICA DE NEGOCIO
New Pocket deberia validar como requerido el Target Amount.LISTO.

Considerar en ACCOUNTING, listar todas las cuentas, incluyendo income, expense, debtors, investment, bank, pocket, para luego usarlo como centro de EDICION y ELIMINACION de cuentas.LISTO.

Cálculo de Net Worth: Aclarar con el cliente la definición de Net Worth y si su cálculo debe incluir activos (bancos, inversiones) y pasivos (deudas)?.PENDIENTE

Manejo de Pocket Savings: Definir con usuario cliente, si los montos de Pocket Savings son cuentas separadas o están distribuidos en otras cuentas.PENDIENTE.

Estructura de Creacion de Categorías y Subcategorias: Implementar una nueva estructura para manejar categorías y subcategorías. Tipo calculadora.PENDIENTE.

Ajustar los formularios del frontend, para que envien acount_id al backend, pqara que este realice las busquedas de las cuentas no por nombre sino por id de las cuentas. Se ajusto para busqueda de ambos. LISTO.

modificar el backend para que en las transacciones se haga la busqueda por account_id y no por nombre account_name. Se modifico considerando ambas opciones, priorizando las busqueda por account id, en transaction between accounts. LISTO

Exportación de Datos: Habilitar la exportación de movimientos en formatos como PDF, Excel y .csv.PENDIENTE. Confirmado abierto por ausencia: **no hay biblioteca de PDF, de hoja de calculo ni de CSV en ningun `package.json` del repositorio**.

Balance de Inversiones: Aclarar con usuario Cleinte, el cálculo del balance total de las inversiones.

PÁGINA DE DETALLE DE INGRESOS: Definir si se debe crear una página de detalle para las cuentas de income. Se implemento en modo edicion con accounting dashboard,donde se puede ver el detalle de cualquier cuenta, menos la cuenta interna SLACK.LISTO.

BACKEND Y SEGURIDAD
la hora de transaction-atual-date en el controller transfer between accounts, tiene 4 horas adicionales con respecto al momento que se hace la transaction?.PENDIENTE. No verificable desde el codigo. Falta la comprobacion humana: leer una fila almacenada y comparar su marca de tiempo con el momento real de la transferencia.

como guardar los montos numericos en la bbdd como number o decimal, y no como string, o porque se recuperan como strings?. los campos account_starting_amount se ven asi: '0.00', account_balance: '75.00'.PENDIENTE. **La causa esta medida**: no hay ningun analizador de tipos registrado en `backend/src`, asi que rige el predeterminado del controlador de Postgres y una columna `numeric` llega como cadena. Falta la comprobacion humana: leer los tipos de columna en la base de datos y decidir si la cadena es el comportamiento buscado, porque la aritmetica de dinero usa una biblioteca decimal que la prefiere.

Autenticación de Usuarios: Implementar la autenticación de usuarios y verificar el userId antes de permitir el acceso a las funciones principales.LISTO.

Cálculo de Inversiones: Calcular los valores de las cuentas de inversión, comparando el capital invertido con el balance real.PENDIENTE,.

Establecer la regla de negocio, para el manejo de fechas y coherencias entre fechas. Por ejemplo, al realizar una transaccion entre cuentas, no deberia poder ser de cuentas con fechas en el futuro, o realizar transacciones en fechas anteriores a la creacion de las cuentas.PENDIENTE.

FRONTEND Y UI/UX En detailed account page/view, colocar la flecha de regreso y los 3 puntos de edicion, separados del titulo. css page\_\_content, ...position abosolute?..PENDIENTE.

Manejo de Errores: Mejorar los mensajes de error para que sean más claros para el usuario.Unificar y estandarizar manejo de errores, para que sea reusable en otras aplicaciones. PENDIENTE

Cálculo de % Profit: Corregir el cálculo que muestra NaN. **LISTO 2026-09-06**: el divisor esta guardado y el porcentaje vale cero por defecto cuando el capital invertido es cero (`frontend/src/fintrack/pages/overview/components/InvestmentAccBalance.tsx:100-117`). **Resto abierto:** la guarda compara estrictamente contra el numero cero, asi que si la API devuelve el monto como la cadena `'0.00'` — ver el punto abierto sobre valores numericos que llegan como cadenas — la guarda no lo atrapa y la division da infinito en vez de NaN.

Validación de Fechas: Bloquear fechas futuras en el selector de fechas para las transacciones y la creación de pockets. **LISTO 2026-09-06**: el selector compartido acepta una cota superior (`frontend/src/fintrack/general_components/datepicker/Datepicker.tsx:103`), el disparador de fecha de transaccion la pasa (`general_components/transactionDateTrigger/TransactionDateTrigger.tsx:31,111`) y el selector de mes se acota al mes en curso (`general_components/monthPicker/MonthPicker.tsx:149,193`). Determinar la regla de negocio para las fechas en las transacciones entre cuentas sigue PENDIENTE: existe una ventana de retrofecha en las constantes del frontend, pero ninguna regla impide una transaccion con fecha anterior a la cuenta a la que pertenece.

Error de Monto Inicial: Revisar el error del monto inicial de la cuenta cuando no hay transacciones.PENDIENTE. Falta la comprobacion humana: crear una cuenta sin transacciones y leer la pantalla.

Formularios: Implementar el reseteo de los mensajes de toast y la limpieza de variables después de enviar un formulario.PENDIENTE.

Indicador de Carga: Agregar un indicador de loading en los formularios.PENDIENTE. Varias pantallas de detalle ya leen una bandera de carga, pero ningun barrido confirma que todos los formularios la tengan. Falta la comprobacion humana, formulario por formulario.

# Descripción de Transacciones: Estandarizar y mejorar las descripciones de las transacciones.PENDIENTE, a gusto del usuario.

✅ ACTIVIDADES RESUELTAS (LISTO)

EXPENSE
en expense movement, la cuenta source registrada en la transaction debe ser distinta del id de la cuenta category . El account_id en la tabla transactions, corresponde a la cuenta destino del expense, en este caso category_budget.LISTO.

Revisar signos de los montos, de las transferencias de reverse expense y reverse income.LISTO

y verificar si se incluye en la bbdd de transacciones. deshabilitar la opcion de reverse que no se este usando, evluar si pueden ser simultaneas?. LISTO, Expense Reverse puede ser SIMULTANEA con Income Reverse, por lo que no se requiere inhabilitacion.LISTO.

arreglar style media query de transfer para To:. reducir tamano de fuente de From y To, en el media query. LISTO

Debts tracker,
si en amount se intoduce valores invalidos, y todos los ca demas campos tienen valores validos, al corregir el valor de amount, se somete inmediatemente la transaccion. Deberia esperar a que el usuario vuelva a someter los datos.Aunque, la transaccion no se graba. LISTO.

si se introducen valores validos en todos los campos, y no se introduce nada en Amount, y se presiona el boton de submit, el formulario se somte como valido, y no ddberia ser, deberia indicar que el valor de amount no ha sido o introducido. Aunque, la transaccion no se graba.LISTO.

TRANSFER. Al hacer transfer desde cuentas a cuantas Pocket, no se reflejan el movimiento en los detalles de las cuentas individuales.Pero si se reflejan en el overview de movimientos.ItP ok.PtP ok. LISTO.

Revisar todo el proceso de transfer. No se reflejan los movimientos en overview. LISTO

Los account detail no se estan actualizando, al realizar las transacciones o movimientos. Expense Ok. Income ok. Transfer ok. pocket ok. debts ok. LISTO.

When creating a new profile of debtor, bank accounts do not update the balances, no se actualizan los balances de las cuentas que se muestran, puede ser debido a que hay que hacer un refetch, como se hizo en tracker. LISTO

PnL tracker, despues de hacer submit exitoso, al recargarse la pagina, aparece el mensaje de error de validacion de Select Account, el cual no deberia aparecer, sino hasta que haya sido introducido un valor an amount, o en algunos de los otros campos o se haya introducido cualquier caracter. Se incluyo un sid effect para mostrar mensajes de validacion en forma condicion y con base a un nuevo state hasUserInteracted. LISTO

TRANSFER from investment account, no se reflejan en el movimiento de investments en el overview. LISTO --

Cuenta Slack: Definir si se debe crear una cuenta slack para cada cuenta bancaria con un monto inicial. Se implemento una unica cuenta slack para el balance de todo el sistema. LISTO.

Error en Income Tracker: Corregir el error que impide encontrar las cuentas de origen o destino.LISTO

Validar números y valores en los trackers. LISTO.

Hacer validación en tiempo real para dropdowns. LISTO.

Corregir la lógica de lend y borrow y ordenar los movimientos por fecha. LISTO.

Completar el cálculo del net worth. LISTO.

Usar toastify para mensajes al usuario. LISTO.

Implementar la lista de categorías. LISTO.

Crear endpoints y controladores en el backend. LISTO.

Implementar rutas y componentes del frontend. LISTO.

Ajustar la base de datos para zonas horarias y queries. LISTO.

Incluir PnL en el fintrack. LISTO.

Corregir el frontend de PnL. LISTO.

Mostrar balances de cuentas en los dropdowns. LISTO.

Implementar refetch para actualizar balances. LISTO.

Corregir bugs al crear cuentas. LISTO.

Implementar páginas de detalle de cuentas. LISTO.

Incluir depósitos y retiros en el PnL tracker. LISTO.

Corregir la validación para que no se borren datos. LISTO.

Arreglar errores de descripción de transacciones. LISTO.

Ajustar la lógica de debts para usar solo cuentas bancarias. LISTO.

Asegurar la consistencia del signo en el monto inicial. LISTO.

Corregir el problema de updated_at. LISTO.

Aplicar debounce a los textareas. LISTO.

Deshabilitar el botón de guardar durante la carga. LISTO.

Corregir mensajes de error y summary de valores cero. LISTO.

Solucionar el error de transferencia entre cuentas. LISTO.

Ajustar endpoints y manejo de tipos en overview. LISTO.

Incluir movimientos de inversiones en el overview. LISTO.

Revisar el cálculo del monthly avg saving. LISTO.

Corregir la funcionalidad borrow en la creación de deudas. LISTO.

Arreglar la restricción de fondos. LISTO.

Corregir que los expenses no se reflejaban en los resúmenes. LISTO.

Estandarizar los estilos. LISTO.

Minimizar los console.log del backend. LISTO.

Añadir el placeholder "no opción" en los selectores. LISTO.

LÓGICA DE NEGOCIO

Implantar transacciones de reverso para las cuentas expense e income source, de manera de poder realizar reversos manuales entre cuentas, en caso de error de usuario. LISTO.

PENDIENTES
Implantar eliminacion de cuentas.

Corregir la lógica de lend y borrow y ordenar los movimientos por fecha.

Completar el cálculo del net worth.

Validar números y valores en los trackers.LISTO.

Hacer validación en tiempo real para dropdowns.

Implementar la lista de categorías.

Crear endpoints y controladores en el backend.LISTO.

Ajustar la base de datos para zonas horarias y queries.

Incluir PnL en el fintrack.LISTO.

Ajustar la lógica de debts para usar solo cuentas bancarias.LISTO.

Corregir la funcionalidad borrow en la creación de deudas.

Arreglar la restricción de fondos.LISTO.

Corregir que los expenses no se reflejaban en los resúmenes.LISTO.

Pendiente
Implantar edicion de cuentas, datos solamente, no transacciones. Edicion SIMPLE.LISTO.

El orden de las transacciones debeRIA ser primero el retiro o withdraw y despues received o deposit.

New Pocket deberia validar como requerido el Target Amount.LISTO.

Ajustar los formularios del frontend, para que envien acount_id al backend, para que este realice las busquedas de las cuentas no por nombre sino por id de las cuentas. LISTO.

Exportación de Datos: Habilitar la exportación de movimientos en formatos como PDF, Excel y .csv.

A Definir con Cliente
EDICIÓN Y ELIMINACIÓN: Establecer una estrategia para editar y eliminar datos, y definir los campos editables y sus interrelaciones en la base de datos.LISTO.

Considerar en accounting, listar todas las cuentas, incluyendo income, expense, debtors, investment, banck, pocket, para luego usarlo como centro de edicion de cuentas.LISTO.

Cálculo de Net Worth: Aclarar con el cliente la definición de Net Worth y si su cálculo debe incluir activos (bancos, inversiones) y pasivos (deudas).

Manejo de Pocket Savings: Definir si los montos de Pocket Savings son cuentas separadas o están distribuidos en otras cuentas.

Estructura de Creacion de Categorías y Subcategorias: Implementar una nueva estructura para manejar categorías y subcategorías.

Balance de Inversiones: Aclarar el cálculo del balance total de las inversiones.

Página de Detalle de Ingresos: Definir si se debe crear una página de detalle para las cuentas de income.Definida en accounting. LISTO.

CONSULTAR PREFERENCIAS DE USUARIO Establecer la regla de negocio, para el manejo de fechas y coherencias entre fechas. Por ejemplo, al realizar una transaccion entre cuentas, no puede ser de cuentas con fechas en el futuro, o realizar transacciones en fechas anteriores a la creacion de las cuentas.

Backend y Seguridad
LISTO
Implantar un metodo de autenticacion a la app fintrack, considerando: -- Modal para el ingreso del usuario: SIGN UP, SIGN IN, SIGN OUT.

Autenticación de Usuarios: Implementar la autenticación de usuarios y verificar el userId antes de permitir el acceso a las funciones principales.

Cálculo de Inversiones: Calcular los valores de las cuentas de inversión, comparando el capital invertido con el balance real.

# minizar los console.log del backend.

PENDIENTES Y DESEABLES.
AUTENTICACION dual, es decir, para acceso a traves de web, y a traves de mobile-web. No necesario. LISTO.

Incluir aspectos de seguridad, como tokens JWT, uso de cookies, envio por headers, Refresh Tokens, usuario logueado persistente.. LISTO.

Frontend y UI/UX
LISTOS
Revisar la presentacion de los miovimientos debts en el overview, , deberian ser del ultimo al primero , es decir descendentes en fecha y hora.

Arreglar los colores de los toast de acuerdo con e tipo de error o mensaje. En creacion de cuentas, perfiles, etc.

Cálculo de % Profit: Corregir el cálculo que muestra NaN.

Formularios: Implementar el reseteo de los mensajes de toast y la limpieza de variables después de enviar un formulario.

Descripción de Transacciones: Estandarizar y mejorar las descripciones de las transacciones.

Revisar signos de los montos, de las transferencias de reverse expense y reverse income.

Arreglar style media query de transfer para To: y reducir tamano de fuente de labels From y To, en el media query.

Debts tracker, se corrigió que el formulario no se sometiera inmediatamente al corregir un valor inválido.

Debts tracker, se corrigió que el formulario se sometiera como válido sin un valor en Amount.

Cuando se hace transferencia desde cuentas a Pocket, no se reflejan los movimientos en los detalles individuales, pero sí en el overview. (Nota: El issue original indica "LISTO", por lo que lo mantengo así).

Los account detailS se actualizan al realizar transacciones.

Al crear un nuevo perfil de deudor, los balances se actualizan después de un refetch.

En el PnL tracker, se incluyó un side effect para mostrar mensajes de validación de forma condicional.

TRANSFER from investment account se reflejan en el movimiento de investments en el overview.

Cuenta Slack: Se implementó una única cuenta slack para el balance total.

Error en Income Tracker: Se corrigió el error que impedía encontrar las cuentas de origen o destino.

Usar toastify para mensajes al usuario.

Implementar rutas y componentes del frontend.

Corregir el frontend de PnL.

Mostrar balances de cuentas en los dropdowns.

Implementar refetch para actualizar balances.

Corregir bugs al crear cuentas.

Implementar páginas de detalle de cuentas.

Incluir depósitos y retiros en el PnL tracker.

Corregir la validación para que no se borren datos.

Asegurar la consistencia del signo en el monto inicial.

Corregir el problema de updated_at.

Aplicar debounce a los textareas.

Deshabilitar el botón de guardar durante la carga.

Corregir mensajes de error y summary de valores cero.

Solucionar el error de transferencia entre cuentas.

Ajustar endpoints y manejo de tipos en overview.

Originalmente no se considera en el disenio el cálculo del monthly avg para INVESTMENT.

Estandarizar los estilos.

# Añadir el placeholder "no opción" en los selectores.

PENDIENTES
Reflejar los nombres y apellidos de los debtors, con primera letra en mayúscula.LISTO.

EXPENSE: si se crea una cuenta con mas de 25 caracteres, se muestra un error warning, pero igualmente se crea con categoria en blanco. errores de pg.

porqué se muestran varios toast renderizados, con la misma informacion?.Parece que se renderiza en varios sitios.

En detailed account page/view, colocar la flecha de regreso y los 3 puntos de edicion, separados del titulo. css page\_\_content, ...position abosolute?..

Manejo de Errores: Mejorar los mensajes de error para que sean más claros para el usuario.

Validación de Fechas: Bloquear fechas futuras en el selector de fechas para las transacciones y la creación de pockets. Se implemento en el modulo de edicion de cuentas.

Error de Monto Inicial: Revisar el error del monto inicial de la cuenta cuando no hay transacciones.

Indicador de Carga: Agregar un indicador de loading en los formularios.

---

# DEFECTOS INCORPORADOS EL 2026-09-06

Los que siguen ya estaban medidos y registrados en otros documentos, o se
midieron en esta pasada, y no figuraban en esta lista. Se incorporan con su
ubicación exacta. Ninguno se corrigió: esta pasada es documentación, no código.

## Configuración regional y formato de dinero

**La moneda por defecto del formateador de dinero no se encuentra en el catálogo
de monedas.** PENDIENTE. Está declarada en mayúsculas
(`frontend/src/fintrack/helpers/functions.ts:39`) y todas las claves del catálogo
son minúsculas (`frontend/src/fintrack/helpers/currencyConstants.ts:22-58`), así
que leer el catálogo con ese valor falla contra el propio defecto de la función,
devuelve indefinido, y el formateador de números cae en silencio a la
configuración regional del equipo donde se ejecuta. El silencio es el defecto
entero: nada lanza excepción y la cifra igual se imprime, con separadores que no
son los que el mapa declara.

**Quince apariciones vivas de la etiqueta de configuración regional española en
once archivos del frontend, con la interfaz en inglés.** PENDIENTE. El detalle
sitio por sitio está en `plan-docs/ongoing/PLAN_FX_DISPLAY.md`, sección 2. Se
concentran en las vistas previas de conversión y en la tarjeta de auditoría de
cambio, que nombran una configuración regional que no es la del lector ni la de
la moneda.

**Las dos constantes de formato de fecha no coinciden en qué idioma habla la
interfaz.** PENDIENTE. Una es una configuración regional española y la otra
inglesa (`frontend/src/fintrack/helpers/constants.ts:81-86`); la segunda lleva su
razón escrita al lado — un mes deletreado convierte la configuración regional en
el idioma de la interfaz — y la primera no.

**Un comentario apunta a un rango de líneas que ya no contiene lo que dice.**
PENDIENTE. La nota de la tarjeta superior del tracker cita el archivo de
constantes en las líneas 57 a 59
(`frontend/src/fintrack/pages/tracker/components/TopCard.tsx:213`); la constante
que describe vive hoy en las líneas 83 a 86.

## Hojas de estilo

Los tres defectos catalogados que `CLAUDE.md` nombra, ahora medidos sobre las 80
hojas de estilo de `frontend/src`.

**Ocho variables de diseño consumidas y definidas en ningún sitio.** PENDIENTE.
Un par de color mal escrito dos veces en la hoja del panel general
(`frontend/src/fintrack/pages/overview/styles/overview-styles.css:284-285`), un
tamaño de fuente y una altura de línea en la barra principal
(`frontend/src/fintrack/general_components/mainNavbar/styles/mainNavbar.css:135-136`)
y cuatro pasos de espaciado en los estilos de página compartidos
(`frontend/src/fintrack/pages/styles/generalStyles.css:63,67,71,75`). Cada una
resuelve a nada en tiempo de ejecución.

**Catorce bloques de regla declaran la misma propiedad dos veces.** PENDIENTE.
Dos de ellos están en el mismo archivo, sobre el mismo selector, bajo dos
consultas de altura idénticas
(`frontend/src/fintrack/pages/tracker/styles/tracker-style.css:728-741` y
`:743-749`, ambas fijando el desbordamiento vertical de la tarjeta). Los otros
doce se reparten entre las hojas de autenticación, borrado de cuenta, botón de
envío, entrada de radio, presupuesto, deudas, bolsillos y estilos generales.

**La consulta de esquema de color del sistema está invertida.** PENDIENTE. El
bloque se titula soporte de modo oscuro, pide el esquema claro y lo llena de
valores oscuros
(`frontend/src/fintrack/editionAndDeletion/pages/deletionAccount/UIComponents/accountDetailsUI/accountDetailsUI.css:163-190`),
así que un lector con el sistema en claro recibe el panel oscuro y un lector con
el sistema en oscuro no recibe nada.

**Cincuenta y nueve declaraciones llevan `!important`.** PENDIENTE. La regla de
estilo del proyecto lo prohíbe sin excepción.

**El ayudante de toast escribe cuatro literales de color.** PENDIENTE. Valores
hexadecimales y un color de texto blanco en línea, en vez de consumir variables
(`frontend/src/fintrack/helpers/showToastByStatus.ts:11-14`). Es el mismo archivo
que resolvió el punto de los colores del toast por tipo de mensaje: resuelve el
comportamiento e introduce el defecto de estilo.

## Panel general

**El total comprometido de un bolsillo se contaba dos veces en el patrimonio
neto.** RESUELTO 2026-09-06, en dos commits y en ese orden. El encabezado sumaba
el saldo de bolsillo a banco, inversión y deuda para el patrimonio neto, y otra
vez para la posición de caja, leyéndolo sobre el tipo de cuenta de bolsillo
retirado. El saldo bancario ya contenía ese dinero: el techo de la guarda de
asignación es saldo menos ya asignado, y eso sólo se sostiene si el comprometido
está dentro del saldo
(`backend/src/fintrack_api/services/pocket_services/services/pocketAllocationService.js:345-347`).

**La lectura se borró, no se repuntó** (`f4b999d9`), y ese borrado era la guarda
que hacía seguro el repunte: repuntarla a las tablas nuevas conservaría el doble
conteo, y hoy la doble suma valía cero sólo porque el tipo retirado no devolvía
cuentas, así que se habría encendido en el instante del repunte.

Después se repuntó todo lo demás al modelo de plan (`f0388039`): la tarjeta
compone sus cifras pidiéndoselas a `pocketBoardService`, que ya las calcula para
la pantalla del tablero, y tres lecturas temporales nuevas sirven la serie, la
instantánea mensual y la lista de asignaciones del mes. El widget de metas se
repuntó al mismo libro mayor y se le dio el mes de referencia, que no tenía. El
razonamiento completo está en `plan-docs/ongoing/OVERVIEW_PLAN/PLAN_OVERVIEW_RECOVERY.md`,
etapa P2.

**Las tres cifras del recuadro principal decidían si eran números mirando la
variable equivocada.** RESUELTO 2026-09-06 (`d75b4709`). La fila de gastos
comprobaba el total de ingresos en lugar del de gastos
(`frontend/src/fintrack/pages/overview/OverviewLayout.tsx:186-190`), así que un
gasto roto se imprimía como dinero real y un gasto válido se vaciaba cada vez que
fallaba ingresos.

Se corrigió también el respaldo a cero que traía la misma línea. Las tres filas
son el dinero del propio usuario: imprimir 0 ante una petición que nunca contestó
afirma que no tiene nada, que es distinto de no saberlo. La cifra viaja ahora
como nula y `BigBoxResult` pinta una raya, siguiendo la regla de que cargando,
error y vacío son tres estados distintos y ninguno es un número.

## Marcas de trabajo pendiente en los comentarios

**No hay ninguna.** El barrido de `TODO`, `FIXME`, `HACK` y `XXX` sobre
`backend/src` y `frontend/src` devuelve cero coincidencias en ambos árboles, así
que no aportó ningún elemento a esta lista. Se deja escrito porque la ausencia
también es una medición: el próximo lector no tiene que repetir el barrido.

---

# REGISTRO DEL EDITOR DE CUENTAS

**De dónde salen y por qué están aquí.** Los once se midieron el 2026-08-20 y
vivían sólo en `plan-docs/on-hold/PLAN_EDIT_BLOCK/PLAN_EditAccount.md`, sección
«U4 — el registro». **Git no rastrea ese archivo** — `plan-docs/*` está en el
archivo de exclusiones — así que borrar la carpeta destruía la única copia. Se
incorporan aquí, se remidieron el 2026-09-06 y llevan las líneas de hoy; donde el
ancla se había desplazado se da la actual y se anota el desplazamiento. Sus
etiquetas internas (E-1 … E-11) se conservan sólo como referencia hacia atrás a
ese documento.

**Hallazgo estructural al lado de los once:** el endpoint de escritura de cuenta
no lleva middleware de validación
(`backend/src/fintrack_api/routes/accountRoutes.js:104`), así que el esquema del
frontend es la única puerta sobre ese payload.

## Los dos que dejan cuentas reales sin poder editarse

**🔴 Alta — Una columna nula dejaba la cuenta entera sin poder editarse (E-1).**
**LISTO 2026-09-09** (`36353a96`). El cargador copiaba a estado de formulario
cualquier valor que no fuera `undefined`, así que un `NULL` de Postgres llegaba
como `null`, los esquemas aceptaban sólo `undefined`, y un error en un campo
abortaba el envío completo en vez de ese campo (`EditAccount.tsx:325-334`).
Columnas anulables que alcanzaba: `subcategory`
(`backend/src/db/migrations/sql_migrations/002_accounts.sql:150`), `debtor_name`
y `debtor_lastname` (`:176-177`).

**Se normalizó en la carga, no en los esquemas.** El cargador descarta ahora el
`null` junto con el `undefined`
(`frontend/src/fintrack/editionAndDeletion/pages/editionAccount/EditAccount.tsx:251`),
así que la clave llega ausente y `optionalButNotEmptySchema` la acepta
(`validations_zod/editSchemas.ts:39,55,56` →
`validations_zod/commonEditionSchemas.ts:122`). Aflojar los esquemas a `.nullish()`
habría dejado pasar un `null` al PATCH, que no lleva middleware de validación
(`backend/src/fintrack_api/routes/accountRoutes.js:104`) — el hallazgo estructural
de arriba. Las otras dos pantallas que hidratan desde el servidor ya normalizaban
así (`pages/forms/editPocket/EditPocket.tsx:143,147` y
`auth/auth_utils/profileTransformation.ts:52-59`); ésta era la única que no.

**Sin regresión en el botón de guardar:** la foto contra la que `isDirty` compara
(`EditAccount.tsx:241,259,269-277`) pierde la clave a la vez que el formulario, y
`areValuesEqual` es identidad estricta (`:79-83`), así que un formulario intacto
sigue leyéndose como limpio. En pantalla no cambia nada:
`UniversalDynamicInput.tsx:96` ya pintaba vacío para `null` y para `undefined`.

**🔴 Alta — Un bolsillo con fecha objetivo vencida no se guardaba nunca (E-2).**
**LISTO 2026-09-06.** El bolsillo salió por completo de este editor: el mapa de
tipo a esquema no tiene clave de bolsillo
(`frontend/src/fintrack/editionAndDeletion/validations_zod/editSchemas.ts:64-70`)
y el cargador deja escrito que ningún campo de fecha sobrevive ahí
(`EditAccount.tsx:252-254`). El bolsillo tiene ahora su propia pantalla, que
envía sólo los campos que cambiaron precisamente para que un plazo vencido
intacto nunca se revalide
(`frontend/src/fintrack/pages/forms/editPocket/EditPocket.tsx:249-253`). **Resto
abierto:** el propio campo de plazo sigue acotado a hoy (`EditPocket.tsx:521`),
así que un plazo vencido no puede corregirse a una fecha pasada si el dueño lo
toca.

## Los otros nueve

**La vista previa del nombre de un deudor discrepaba de lo que guarda el servidor
(E-3).** **LISTO 2026-09-06.** El cliente une apellido y nombre con coma y
espacio, y el comentario registra que ése es el separador que usan los dos
caminos de escritura
(`frontend/src/fintrack/editionAndDeletion/validations_zod/accountEditSchema.ts:175-187`),
coincidiendo con el servidor
(`backend/src/fintrack_api/controllers/accountEditController.js:219`).

**🟡 Media — El monto adeudado de un deudor no se edita en ningún sitio (E-4).**
PENDIENTE. La columna existe
(`backend/src/db/migrations/sql_migrations/002_accounts.sql:170`) y la devuelve el
endpoint de lectura, pero la rama de deudor del endpoint de escritura fija sólo
nombre, apellido y nota
(`backend/src/fintrack_api/controllers/accountEditController.js:187-191`).
Tampoco se puede reasignar la cuenta vinculada. **Decisión pendiente:** ¿el monto
adeudado pertenece a este editor, o sólo a una transacción?

**🟡 Media — Editar la meta de un bolsillo deja obsoletos sus metadatos de
cambio (E-5).** PENDIENTE. El endpoint de escritura fija la meta y no toca
ninguna de las seis columnas de cambio que la acompañan
(`backend/src/fintrack_api/controllers/accountEditController.js:91-92`), que la
migración 015 declara no nulas con el argumento escrito de que el controlador
siempre envía las seis. Después de una edición la cifra cambió y su origen
declarado sigue describiendo la conversión anterior.

**🟢 Baja — La bandera de campo obligatorio no valida nada y contradice a los
esquemas (E-6).** PENDIENTE. Su único consumidor es el asterisco de la etiqueta
(`frontend/src/fintrack/editionAndDeletion/pages/editionAccount/UniversalDynamicInput.tsx:256`,
desplazado desde 242). Hay tres discrepancias: campos marcados obligatorios cuyo
esquema es opcional — el asterisco miente —, campos no marcados cuyo esquema exige
la clave, y un campo sin asterisco que bloquea el guardado al vaciarse.
**Decisión pendiente:** ¿la bandera debe validar, o sólo rotular?

**🟢 Baja — Un campo muerto viaja en cada guardado (E-7).** PENDIENTE. El tipo de
cuenta se añade al payload con el comentario de que el controlador lo necesita
(`frontend/src/fintrack/editionAndDeletion/pages/editionAccount/EditAccount.tsx:341-344`);
el controlador nunca lo lee, resuelve el tipo consultando la fila. El comentario
es falso.

**🟢 Baja — La nota de un bolsillo vive en dos tablas y una tapa a la otra
(E-8).** PENDIENTE. El endpoint de escritura fija una nota en la fila de cuenta
compartida
(`backend/src/fintrack_api/controllers/accountEditController.js:59`) y otra vez
en la fila propia del bolsillo (`:97`); el endpoint de lectura selecciona ambas
con asterisco y la segunda tapa a la primera por orden de columna. Coherente hoy
sólo porque este endpoint es su único escritor.

**La rama de presupuesto del endpoint de escritura quedó inalcanzable (E-9).**
**LISTO 2026-09-06.** La rama ya no existe y el endpoint declara por escrito que
ignora una clave de presupuesto en el payload, porque el monto es una decisión de
cuatro partes — importe, moneda, mes y rango — que pertenece al endpoint de
presupuesto
(`backend/src/fintrack_api/controllers/accountEditController.js:104-107`); la
clave del frontend está comentada con la misma razón
(`frontend/src/fintrack/editionAndDeletion/validations_zod/editSchemas.ts:29-36`).

**🟡 Media — Los topes de longitud del frontend son más estrechos que las
columnas, y uno tiene un carácter de margen (E-10).** PENDIENTE. El nombre de
cuenta está acotado a 28 caracteres
(`frontend/src/fintrack/validations/utils/constants.ts:4-13`) contra una columna
de 50, y para una cuenta de presupuesto el servidor deriva ese nombre de
categoría, subcategoría y naturaleza, cuyos topes son 10, 10 y 5 — un peor caso
de 27 con los dos separadores. Ampliar cualquiera de los tres hace que el editor
rechace un valor que él mismo no escribió.

**🟡 Media — Tres tipos de cuenta no reciben moneda del endpoint de lectura
(E-11).** PENDIENTE. Las cuentas de banco, inversión y fuente de ingreso tienen
superficies editables idénticas y vacías — el endpoint de escritura no tiene caso
para ellas y están ausentes de su mapa de tablas
(`backend/src/fintrack_api/controllers/accountEditController.js:309-313`) —, lo
cual es correcto. La asimetría es que la unión con la moneda está comentada para
ellas en el endpoint de lectura, así que cualquier vista que lea de ahí la moneda
de una cuenta bancaria obtiene `undefined`.

---

# RECUENTO AL CIERRE DE LA PASADA DEL 2026-09-06

**125 elementos — 81 LISTO, 44 PENDIENTE.** El desglose por grupo está en
`summary-issues.md`, que debe coincidir línea por línea con `issues-en.md` y con
este archivo.
