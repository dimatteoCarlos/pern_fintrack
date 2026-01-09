TÓPICOS LISTOS, PENDIENTES Y CONSULTAS AL CLIENTE

AUTENTICATION
Revisar y completar la autentication con refresh token. LISTO

Validar el monto target en linea al crear una cuenta pocket. LISTO. 

Verificar auth refresh token y la logica de refresh toekn automatico.LISTO.

Como hacer para recordar al usuario y mantenerlo activo mientras refresh token este vigente. PENDIENTE

--------------------------------

BACKEND
Organizar la asignacion de la duracion de cookies y tokens. PENDIENTE.

GENERAL
 como hacer DEPLOYMENT, como verificar dinamicamente componentes no usados o rotos.PENDIENTE.

 POCKET DETAIL
 Revisar pocket detail, para accounting view detail,  y para budget pocket. No se esta renderizando los datos de las cuentas pocket saving.LISTO

 CATEGORY BUDGET DETAIL
 Arreglado pocket detial, ahora category detail, no recibe los datos bien, veerificar la estructura de los datos recibidos/enviados por el server.LISTO.
 
TRANSFER
Responsiveness en transfer, al agregar una linea en To:, no se ve la ui completa. Para una ancho menor de 450 px. La altura debe ser mayor de 842 px. Y normal la altura minima esta en 722 px. ANCHO maximo pra From es 468px, y par To es 450px. LISTO.

FIX update of total account balance. LISTO.


====  EDICIÓN Y ELIMINACIÓN: Establecer una Establecer estrategia para editar y eliminar datos.
EDICIÓN
La estrategia a seguir es definir los campos editables y los no editbles, asi como sus interrelaciones en la base de datos. No se prevé edición de transacciones, sino implementar transferencias manuales de reverso entre cuentas. LISTO.

VISTA DE DETALLES DE CUENTA CENTRALIZADA
Desarrollar vista de detalles de cuentas y edicion de cuentas en Accounting Dashboard. LISTO.

Implantar transacciones de reverso para las cuentas expense e income source, de manera de poder realizar reversos manuales entre cuentas, en caso de error de usuario.LISTO.

Implantar edicion de cuentas, datos solamente, no transacciones. Edicion simple.LISTO.

Implantar en la edicion de TODOS LOS CAMPOS, incluyendo text areas y numericos, la validacion en tiempo real, que indique un mensaje de error en tiempo real, y limite la extension o longitud de los campos a la longitud visual en el formulario. LISTO.

ELIMINACIÓN
Desarrollar eliminacion de cuentas.LISTO.
ESTRATEGIA: desarrollar el método "Anulación Retrospectiva Total" de cuentas y transacciones.  En el contexto de una aplicación de eliminación de cuentas bancarias se refiere al acto de deshacer o invalidar la existencia de una cuenta bancaria y todas sus transacciones asociadas desde su origen, como si nunca hubiera existido, pero deja registros de cuentas borradas.

ESTO IMPLICA:
Anulación de la cuenta: El cierre de la cuenta no es un cierre estándar a futuro, sino uno que borra o revierte digitalmente su registro completo en el sistema bancario.

Efecto retroactivo: La acción impacta todas las operaciones realizadas desde la apertura de la cuenta hasta el momento de la anulación, en lugar de solo detener las transacciones futuras.

Totalidad: Se eliminan o anulan todos los datos, incluyendo saldos, movimientos, comisiones, y cualquier otro registro contable o de datos personales vinculado a esa cuenta específica. 

En la práctica, esto podría ser una característica técnica compleja diseñada para cumplir con normativas de privacidad (como el "derecho al olvido") o para corregir errores graves en la apertura de cuentas. A diferencia de un cierre de cuenta normal, que simplemente la marca como inactiva o cerrada a partir de una fecha determinada, una "anulación retrospectiva total" busca la eliminación completa del rastro digital de la cuenta.

 ACTIVIDADES O ISSUES LISTOS O PENDIENTES.
 
Optimar AccountDeletionPage, usando useReducer Hook, para manejo de estados del modal, en vez de usar funcion centralizada con useMemo.PENDIENTE.

POSIBLES BUGS:

El orden de las transacciones debe ser primero el retiro o withdraw y despues received o deposit?.

DEBTS. Revisar la presentacion de los movimientos debts en el overview, , deberian ser del ultimo al primero , es decir descendentes en fecha y hora.

Reflejar los nombres y apellidos de los debtors, con primera letra en mayuscula.LISTO.

EXPENSE. si se crea una cuenta con mas de 25 caraceteres, se muestra un error warning, pero igualmente se crea con categoria en blanco. errores de pg.

arreglar los colores de los toast de acuerdo con e tipo de error o mensaje. En creacion de cuentas, perfiles, etc.

se muestran varios toast renderizados, con la misma informacion?. LISTO.

FUNCIONALIDAD Y LÓGICA DE NEGOCIO
New Pocket deberia validar como requerido el Target Amount.LISTO.

Considerar en ACCOUNTING, listar todas las cuentas, incluyendo income, expense, debtors, investment, bank, pocket, para luego usarlo como centro de EDICION y ELIMINACION de cuentas.LISTO.

Cálculo de Net Worth: Aclarar con el cliente la definición de Net Worth y si su cálculo debe incluir activos (bancos, inversiones) y pasivos (deudas)?.PENDIENTE

Manejo de Pocket Savings: Definir con usuario cliente, si los montos de Pocket Savings son cuentas separadas o están distribuidos en otras cuentas.PENDIENTE.

Estructura de Creacion de Categorías y Subcategorias: Implementar una nueva estructura para manejar categorías y subcategorías.PENDIENTE.

Ajustar los formularios del frontend, para que envien acount_id al backend, pqara que este realice las busquedas de las cuentas no por nombre sino por id de las cuentas. Se ajusto para busqueda de ambos. LISTO.

modificar el backend para que en las transacciones se haga la busqueda por account_id y no por nombre account_name. Se modifico considerando ambas opciones, priorizando las busqueda por account id, en transaction between accounts. LISTO

Exportación de Datos: Habilitar la exportación de movimientos en formatos como PDF, Excel y .csv.PENDIENTE.

Balance de Inversiones: Aclarar con usuario Cleinte,  el cálculo del balance total de las inversiones.

PÁGINA DE DETALLE DE INGRESOS: Definir si se debe crear una página de detalle para las cuentas de income.
Se implemento en modo edicion con accounting dashboard,donde se puede ver el detalle de cualquier cuenta, menos la cuenta interna SLACK.LISTO. 

BACKEND Y SEGURIDAD
la hora de transaction-atual-date en el controller transfer between accounts, tiene 4 horas adicionales con respecto al momento que se hace la transaction?.PENDIENTE.

como guardar los montos numericos en la bbdd como number o decimal, y no como string, o porque se recuperan como strings?. los campos account_starting_amount se ven asi: '0.00', account_balance: '75.00'.PENDIENTE

Autenticación de Usuarios: Implementar la autenticación de usuarios y verificar el userId antes de permitir el acceso a las funciones principales.LISTO. 

Cálculo de Inversiones: Calcular los valores de las cuentas de inversión, comparando el capital invertido con el balance real.PENDIENTE,.

Establecer la regla de negocio, para el manejo de fechas y coherencias entre fechas. Por ejemplo, al realizar una transaccion entre cuentas, no deberia poder ser de cuentas con fechas en el futuro, o realizar transacciones en fechas anteriores a la creacion de las cuentas.PENDIENTE.

FRONTEND Y UI/UX En detailed account page/view, colocar la flecha de regreso y los 3 puntos de edicion, separados del titulo. css page__content, ...position abosolute?..PENDIENTE.

Manejo de Errores: Mejorar los mensajes de error para que sean más claros para el usuario.Unificar y estandarizar manejo de errores, para que sea reusable en otras aplicaciones. PENDIENTE

Cálculo de % Profit: Corregir el cálculo que muestra NaN.

Validación de Fechas: Bloquear fechas futuras en el selector de fechas para las transacciones y la creación de pockets. y determinar regla de negocios para las fechas en las transacciones entre cuentas.PENDIENTE.

Error de Monto Inicial: Revisar el error del monto inicial de la cuenta cuando no hay transacciones.PENDIENTE.

Formularios: Implementar el reseteo de los mensajes de toast y la limpieza de variables después de enviar un formulario.PENDIENTE.

Indicador de Carga: Agregar un indicador de loading en los formularios.PENDIENTE.

Descripción de Transacciones: Estandarizar y mejorar las descripciones de las transacciones.PENDIENTE, a gusto del usuario.
==========================
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
PENDIENTE
Cómo hacer deployment.

Cómo verificar componentes no usados o ROTOS.

LÓGICA DE NEGOCIO

Implantar transacciones de reverso para las cuentas expense e income source, de manera de poder realizar reversos manuales entre cuentas, en caso de error de usuario. LISTO.

PENDIENTES
Implantar eliminacion de cuentas.

Corregir la lógica de lend y borrow y ordenar los movimientos por fecha.

Completar el cálculo del net worth.

Validar números y valores en los trackers.

Hacer validación en tiempo real para dropdowns.

Implementar la lista de categorías.

Crear endpoints y controladores en el backend.

Ajustar la base de datos para zonas horarias y queries.

Incluir PnL en el fintrack.

Ajustar la lógica de debts para usar solo cuentas bancarias.

Corregir la funcionalidad borrow en la creación de deudas.

Arreglar la restricción de fondos.

Corregir que los expenses no se reflejaban en los resúmenes.

Pendiente
Implantar edicion de cuentas, datos solamente, no transacciones. Edicion SIMPLE.

El orden de las transacciones debeRIA ser primero el retiro o withdraw y despues received o deposit.

New Pocket deberia validar como requerido el Target Amount.

Ajustar los formularios del frontend, para que envien acount_id al backend, para que este realice las busquedas de las cuentas no por nombre sino por id de las cuentas. En progreso.

Exportación de Datos: Habilitar la exportación de movimientos en formatos como PDF, Excel y .csv.

A Definir con Cliente
EDICIÓN Y ELIMINACIÓN: Establecer una estrategia para editar y eliminar datos, y definir los campos editables y sus interrelaciones en la base de datos.

Considerar en accounting, listar todas las cuentas, inclueyendo income, expense, debtors, investment, banck, pocket, para luego usarlo como centro de edicion de cuentas.

Cálculo de Net Worth: Aclarar con el cliente la definición de Net Worth y si su cálculo debe incluir activos (bancos, inversiones) y pasivos (deudas).

Manejo de Pocket Savings: Definir si los montos de Pocket Savings son cuentas separadas o están distribuidos en otras cuentas.

Estructura de Creacion de Categorías y Subcategorias: Implementar una nueva estructura para manejar categorías y subcategorías.

Balance de Inversiones: Aclarar el cálculo del balance total de las inversiones.

Página de Detalle de Ingresos: Definir si se debe crear una página de detalle para las cuentas de income.

CONSULTAR PREFERENCIAS DE USUARIO Establecer la regla de negocio, para el manejo de fechas y coherencias entre fechas. Por ejemplo, al realizar una transaccion entre cuentas, no puede ser de cuentas con fechas en el futuro, o realizar transacciones en fechas anteriores a la creacion de las cuentas.

Backend y Seguridad
LISTO
Implantar un metodo de autenticacion a la app fintrack, considerando: -- Modal para el ingreso del usuario: SIGN UP, SIGN IN, SIGN OUT.

Autenticación de Usuarios: Implementar la autenticación de usuarios y verificar el userId antes de permitir el acceso a las funciones principales.

Cálculo de Inversiones: Calcular los valores de las cuentas de inversión, comparando el capital invertido con el balance real.

minizar los console.log del backend.
===================
PENDIENTES Y DESEABLES.
AUTENTICACION dual, es decir, para acceso a traves de web, y a traves de mobile-web.

Incluir aspectos de seguridad, como tokens JWT, uso de cookies, envio por headers, Refresh Tokens, usuario logueado persistente.

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

Añadir el placeholder "no opción" en los selectores.
==================
PENDIENTES
Reflejar los nombres y apellidos de los debtors, con primera letra en mayúscula.

EXPENSE: si se crea una cuenta con mas de 25 caracteres, se muestra un error warning, pero igualmente se crea con categoria en blanco. errores de pg.

porqué se muestran varios toast renderizados, con la misma informacion?.Parece que se renderiza en varios sitios.

En detailed account page/view, colocar la flecha de regreso y los 3 puntos de edicion, separados del titulo. css page__content, ...position abosolute?..

Manejo de Errores: Mejorar los mensajes de error para que sean más claros para el usuario.

Validación de Fechas: Bloquear fechas futuras en el selector de fechas para las transacciones y la creación de pockets.

Error de Monto Inicial: Revisar el error del monto inicial de la cuenta cuando no hay transacciones.

Indicador de Carga: Agregar un indicador de loading en los formularios.