TÓPICOS LISTOS, PENDIENTES Y CONSULTAS AL CLIENTE

AUTENTICATION
REVISAR Y COMPLETAR LA AUTENTICATION CON REFRESH TOKEN. listo

VALIDAR EL MONTO S TARGET EN LINEA AL CREAR UNA CUENTA POCKET
VERIFICAR AUTH REFRESH TOKEN Y LA LOGICA DE REFRESH TOEKN AUTOMATICO.


GENERAL
 como hacer deployment, como verificar componentes no usados o rotos,


en expense movement, la cuenta source registrada en la transaction debe ser distinta del id de la cuenta category . El account_id en la tabla transactions, corresponde a la cuenta destino del expense, en este caso category_budget.Listo.

revisar signos de los montos, de las transferencias de reverse expense y reverse income.Listo

y verificar si se incluye en la bbdd de transacciones. deshabilitar la opcion de reverse que no se este usando, evluar si pueden ser simultaneas?. Listo, Expense Reverse puede ser simultanea con Income Reverse.Listo.

arreglar style media query de transfer para To:. reducir tamano de fuente de From y To, en el media query. Listo 

====  EDICIÓN Y ELIMINACIÓN: Establecer una estrategia para editar y eliminar datos, y definir los campos editables y sus interrelaciones en la base de datos.

Implantar transacciones de reverso para las cuentas expense e income source, de manera de poder realizar reversos manuales entre cuantas, en caso de error de usuario.

Implantar edicion de cuentas, datos solamente, no transacciones. Edicion simlple.

 -- ================== BUGS:

El orden de las transacciones debe ser primero el retiro o withdraw y despues received o deposit.

DEBTS. Revisar la presentacion de los miovimientos debts en el overview, , deberian ser del ultimo al primero , es decir descendentes en fecha y hora.
Reflejar los nombres y apellidos de los debtors, con primera letra en mayuscula.

EXPENSE. si se crea una cuenta con mas de 25 caraceteres, se muestra un error warning, pero igualmente se crea con categoria en blanco. errores de pg.

arreglar los colores de los toast de acuerdo con e tipo de error o mensaje. En creacion de cuentas, perfiles, etc.

porque se muestran varios toast renderizados, con la misma informacion?

FUNCIONALIDAD Y LÓGICA DE NEGOCIO
New Pocket deberia validar como requerido el Target Amount.

Implantar eliminacion de cuentas.

Considerar en accounting, listar todas las cuentas, inclueyendo income, expense, debtors, investment, banck, pocket, para luego usarlo como centro de edicion de du cuentas.

Cálculo de Net Worth: Aclarar con el cliente la definición de Net Worth y si su cálculo debe incluir activos (bancos, inversiones) y pasivos (deudas).

Manejo de Pocket Savings: Definir si los montos de Pocket Savings son cuentas separadas o están distribuidos en otras cuentas.

Estructura de Creacion de Categorías y Subcategorias: Implementar una nueva estructura para manejar categorías y subcategorías.

Ajustar los formularios del frontend, para que envien acount_id al backend, pqara que este realice las busquedas de las cuentas no por nombre sino por id de las cuentas. En progreso.

modificar el backend para que en las transacciones se haga la busqueda por account_id y no por nombre account_name. Se modifico considerando ambas opciones, priorizando las busqueda por account id, en transaction between accounts. Listo

Exportación de Datos: Habilitar la exportación de movimientos en formatos como PDF, Excel y .csv.

Balance de Inversiones: Aclarar el cálculo del balance total de las inversiones.

Página de Detalle de Ingresos: Definir si se debe crear una página de detalle para las cuentas de income.

BACKEND Y SEGURIDAD
la hora de transaction-atual-ate enel controller transfer between accounts, tiene 4 horas adicionales con respecto al momento que se hace la transaction?.

como guardar los montos numericos en la bbdd como number o decimal, y no como string, o porque se recuperan como strings?. los campos account_starting_amount: '0.00', account_balance: '75.00',

Autenticación de Usuarios: Implementar la autenticación de usuarios y verificar el userId antes de permitir el acceso a las funciones principales.

Cálculo de Inversiones: Calcular los valores de las cuentas de inversión, comparando el capital invertido con el balance real.

Establecer la regla de negocio, para el manejo de fechas y coherencias entre fechas. Por ejemplo, al realizar una transaccion entre cuentas, no puede ser de cuentas con fechas en el futuro, o realizar transacciones en fechas anteriores a la creacion de las cuentas.

FRONTEND Y UI/UX En detailed account page/view, colocar la flecha de regreso y los 3 puntos de edicion, separados del titulo. css page__content, ...position abosolute?..
Manejo de Errores: Mejorar los mensajes de error para que sean más claros para el usuario.

Cálculo de % Profit: Corregir el cálculo que muestra NaN.

Validación de Fechas: Bloquear fechas futuras en el selector de fechas para las transacciones y la creación de pockets. y determinar regla de negocios para las fechas en las transacciones entre cuentas.

Error de Monto Inicial: Revisar el error del monto inicial de la cuenta cuando no hay transacciones.

Formularios: Implementar el reseteo de los mensajes de toast y la limpieza de variables después de enviar un formulario.

Indicador de Carga: Agregar un indicador de loading en los formularios.

Descripción de Transacciones: Estandarizar y mejorar las descripciones de las transacciones.

✅ ACTIVIDADES RESUELTAS (LISTO)

Debts tracker,

si en amount se intoduce valores invalidos, y todos los ca demas campos tienen valores validos, al corregir el valor de amount, se somete inmediatemente la traansaccion. Deberia esperar a que el usuario vuelva a someter los datos.Aunque, la transaccion no se graba. Listo.

si se introducen valores validos en todos los campos, y no se introduce nada en Amount, y se presiona el boton de submit, el formulario se somte como valido, y no ddeberia ser, deberia indicar que el valor a de amount no ha sido o introducido.Aunque, la transaccion no se graba.Listo.

TRANSFER. Al hacer transfer desde cuentas a cuantas Pocket, no se reflejan el movimiento en los detalles de las cuentas individuales.Pero si se reflejan en el overview de movimientos.ItP ok.PtP ok. Listo.

Revisar todo el proceso de transfer. No se reflejan los movimientos en overview. listo

Los account detail no se estan actualizando, al realizar las transacciones o movimientos. Expense Ok. Income ok. Transfer ok. pocket ok. debts ok. LISTO.

When creating a new profile of debtor, bank accounts do not update the balances, no se actualizan los balances de las cuentas que se muestran, puede ser debido a que hay que hacer un refetch, como se hizo en tracker. Listo

PnL tracker, despues de hacer submit exitoso, al recargarse la pagina, aparece el mensaje de error de validacion de Select Account, el cual no deberia aparecer, sino hasta que haya sido introducido un valor an amount, o en algunos de los otros campos o se haya introducido cualquier caracter. Se incluyo un sid effect para mostrar mensajes de validacion en forma condicion y con base a un nuevo state hasUserInteracted. Listo

TRANSFER from investment account, no se reflejan en el movimiento de investments en el overview. Listo --

Cuenta Slack: Definir si se debe crear una cuenta slack para cada cuenta bancaria con un monto inicial. Se implemento una unica cuenta slack para el balance de todo el sistema. Listo.

Error en Income Tracker: Corregir el error que impide encontrar las cuentas de origen o destino.listo

Validar números y valores en los trackers. listo.

Hacer validación en tiempo real para dropdowns. listo.

Corregir la lógica de lend y borrow y ordenar los movimientos por fecha. listo.

Completar el cálculo del net worth. listo.

Usar toastify para mensajes al usuario. listo.

Implementar la lista de categorías. listo.

Crear endpoints y controladores en el backend. listo.

Implementar rutas y componentes del frontend. listo.

Ajustar la base de datos para zonas horarias y queries. listo.

Incluir PnL en el fintrack. listo.

Corregir el frontend de PnL. listo.

Mostrar balances de cuentas en los dropdowns. listo.

Implementar refetch para actualizar balances. listo.

Corregir bugs al crear cuentas. listo.

Implementar páginas de detalle de cuentas. listo.

Incluir depósitos y retiros en el PnL tracker. listo.

Corregir la validación para que no se borren datos. listo.

Arreglar errores de descripción de transacciones. listo.

Ajustar la lógica de debts para usar solo cuentas bancarias. listo.

Asegurar la consistencia del signo en el monto inicial. listo.

Corregir el problema de updated_at. listo.

Aplicar debounce a los textareas. listo.

Deshabilitar el botón de guardar durante la carga. listo.

Corregir mensajes de error y summary de valores cero. listo.

Solucionar el error de transferencia entre cuentas. listo.

Ajustar endpoints y manejo de tipos en overview. listo.

Incluir movimientos de inversiones en el overview. listo.

Revisar el cálculo del monthly avg saving. listo.

Corregir la funcionalidad borrow en la creación de deudas. listo.

Arreglar la restricción de fondos. listo.

Corregir que los expenses no se reflejaban en los resúmenes. listo.

Estandarizar los estilos. listo.

Minimizar los console.log del backend. listo.

Añadir el placeholder "no opción" en los selectores. listo.
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

Considerar en accounting, listar todas las cuentas, inclueyendo income, expense, debtors, investment, banck, pocket, para luego usarlo como centro de edicion de du cuentas.

Cálculo de Net Worth: Aclarar con el cliente la definición de Net Worth y si su cálculo debe incluir activos (bancos, inversiones) y pasivos (deudas).

Manejo de Pocket Savings: Definir si los montos de Pocket Savings son cuentas separadas o están distribuidos en otras cuentas.

Estructura de Creacion de Categorías y Subcategorias: Implementar una nueva estructura para manejar categorías y subcategorías.

Balance de Inversiones: Aclarar el cálculo del balance total de las inversiones.

Página de Detalle de Ingresos: Definir si se debe crear una página de detalle para las cuentas de income.

CONSULTAR PREFERENCIAS DE USUARIO Establecer la regla de negocio, para el manejo de fechas y coherencias entre fechas. Por ejemplo, al realizar una transaccion entre cuentas, no puede ser de cuentas con fechas en el futuro, o realizar transacciones en fechas anteriores a la creacion de las cuentas.

Backend y Seguridad
Listo
Implantar un metodo de autenticacion a la app fintrack, considerando: -- Modal para el ingreso del usuario: SIGN UP, SIGN IN, SIGN OUT.

Autenticación de Usuarios: Implementar la autenticación de usuarios y verificar el userId antes de permitir el acceso a las funciones principales.

Cálculo de Inversiones: Calcular los valores de las cuentas de inversión, comparando el capital invertido con el balance real.

minizar los console.log del backend.

Pendiente
AUTENTICACION dual, es decir, para acceso a traves de web, y a traves de mobile-web.

Incluir aspectos de seguridad, como tokens JWT, uso de cookies, envio por headers, Refresh Tokens, usuario logueado persistente.

Proteccion CSRF y XSS.

Frontend y UI/UX
Listo
Revisar la presentacion de los miovimientos debts en el overview, , deberian ser del ultimo al primero , es decir descendentes en fecha y hora.

Arreglar los colores de los toast de acuerdo con e tipo de error o mensaje. En creacion de cuentas, perfiles, etc.

Cálculo de % Profit: Corregir el cálculo que muestra NaN.

Formularios: Implementar el reseteo de los mensajes de toast y la limpieza de variables después de enviar un formulario.

Descripción de Transacciones: Estandarizar y mejorar las descripciones de las transacciones.

Revisar signos de los montos, de las transferencias de reverse expense y reverse income.

Arreglar style media query de transfer para To: y reducir tamano de fuente de labels From y To, en el media query.

Debts tracker, se corrigió que el formulario no se sometiera inmediatamente al corregir un valor inválido.

Debts tracker, se corrigió que el formulario se sometiera como válido sin un valor en Amount.

Cuando se hace transferencia desde cuentas a Pocket, no se reflejan los movimientos en los detalles individuales, pero sí en el overview. (Nota: El issue original indica "listo", por lo que lo mantengo así).

Los account detail se actualizan al realizar transacciones.

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

Revisar el cálculo del monthly avg saving.

Estandarizar los estilos.

Añadir el placeholder "no opción" en los selectores.

Pendiente
Reflejar los nombres y apellidos de los debtors, con primera letra en mayúscula.

EXPENSE: si se crea una cuenta con mas de 25 caracteres, se muestra un error warning, pero igualmente se crea con categoria en blanco. errores de pg.

porqué se muestran varios toast renderizados, con la misma informacion?

En detailed account page/view, colocar la flecha de regreso y los 3 puntos de edicion, separados del titulo. css page__content, ...position abosolute?..

Manejo de Errores: Mejorar los mensajes de error para que sean más claros para el usuario.

Validación de Fechas: Bloquear fechas futuras en el selector de fechas para las transacciones y la creación de pockets.

Error de Monto Inicial: Revisar el error del monto inicial de la cuenta cuando no hay transacciones.

Indicador de Carga: Agregar un indicador de loading en los formularios.