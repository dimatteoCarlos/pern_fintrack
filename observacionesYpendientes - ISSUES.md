user = 397ec169-a453-45ce-bf5f-71b3b820b0ee

https://www.youtube.com/watch?v=zcPj4eEnhyM
===========================
ISSUES
============================
INCOME TRACKER PRESENTA UN ERROR DE CUENTAS DE ORIGEN O DESTINO NO ENTONCTARADAS, PENDIENTE.

MENSAJES DE TOAST, RESETEAR DESPUES DE SUBMIT PENDIENTE

LIMPIAR VARIABLES DE DATOS S DESPUES DE SUMBIT PENDIENTE.

Arreglar validacion de numeros, montos, target,  budget, amount, value ,  tracker.
SE UTILIZARON F VARIOS ENFOQUES DE VALIDACION Y RENDERIZADO. LISTO.
EXPENSE  LISTO.
INCOME  LISTO.
DEBTS  LISTO.
TRANSFER LISTO,
PNL LISTO, 

ACTUALIZAR LA VALIDACION D PARAMETROS EN FORMULARIOS PARA CREACION CUENTAS PENDINTE LISTO ACEPTA ZERO

 Hacer validacion en tiempor real para selection dropdown, como se hizo en Debts.LISTO

Debts. Se uso validacion personalizada, puntual para validacion en real time, y validacion al someter el formulario. LISTO.

DEBTS, parece que hay una inversion entre lend y borrow, n en la description de los movimientos. Revisado, toma en cuenta la transaccion considerando el movimiento de la cuenta, no la del usuario.ademas ORdena por fechas. LISTO.

pendiente. calculo de valores de investment account como capital invertido vs factual balance.

ordenar por fecha descendente los movimientos pnl, y todos losdemas,  mostrados en overview. listo. 

error en http://localhost:5173/fintrack/budget/category/housing/account/9

listo. Calculo de networth

usar toastify para mensajes al usuario , error y success EN LA CREAION DE UENTAS. LISTO.

net worth considerando assests (bank+investment)-cuentas por pagar. PENDIENTE

TAMBIEN SE DEBE ACLARAR, QUE ES LO QUE LLAMAN SAVING GOALS, AQUI STA TOMADO COMO LOS TARGET DE LOS POCKETS SOLAMENTE.

//---OPCIONES DE MANEJO DE POCKET SAVINGS
LOS MONTOS DE POCKET SAVING ESTAN APARTE, Y NO EN LAS CUENTAS DE BANCO NI DE INVERSION. SON CUENTAS SEPARADAS.

//-----
OTRA OPCION ES CONSIDERAR QUE LOS MONTOS DE LOS POCKET SAVING, ESTAN REPARTIDOS  EN LAS CUENTAS DE BANCO Y DE INVESTMENT, PARA LO UAL SE DEBE ENTONCES REALIZAR LOS RESPECTIVOS CALCULOS PARA EL RENDERIZADO, O PARA NO TOMAR EN CUENTA LOS MONTOS DE LOS POCEKT UBICADOS EN CUENTAS.?? 

//List Category LISTO
// en el backend: generar la data segun estructura de los datos a renderizar, es decir,
//agrupar para cada categoria, expenses y  budgets, y cualquier otra; la sumatoria de los expense se refleja en el total_balance, y la sumatoria de los budget de cada categoria seria el budget por categoria o por subcategoria? hay que definir esto, no ESTA claro el manejo de las subcategorias. ,  y el status refleja el estado de lo disponible en el presupuesto,  seria el resultado de la resta entre el expense-budget  de cada categoria,

============================
CATEOGRY DETAIL. LISTO.
EN EL BACKEND
determinar en que router se colocaran los controladores para obtener las cuentas por nombre de categoria.
Resp. app.use('/api/fintrack', fintrack_routes);,
router.use('/account', accountRoutes), 
router.get('/category/:categoryName', getAccountsByCategory); listo.
http://localhost:5000/api/fintrack/account/category/:${categoryName}/?user=${userId}

realizar el query pra obtener la informacion de las cuentas asociadas a la categoryName. listo.

tambien se escribio el query para obtener la sumatoria de los parametros de balance, budget y remaining, de la categoryName,  pero se decidio hacerlo en el frontend.No se uso, en cambio, se uoso una funcion definida como calculate...  

escribir el controlador getAccountByCategory.
R. esta dentro de getAccountController. se hizo la modifiacion para considerar account_type_name.listo

---

 y realizar la totalizacion de los parametros total balance, total budget, total remaining, tomada de la informacion de las cuentas asociadas a dicha categoria. listo.

probar con insomnia. listo

---------------------
EN L FRONTEND
las rutas en el frontend sirven para mostrar el elemento o componente a mostrar.

definir el enpoint, y la ruta> LISTO
la ruta puede hacer algo asi, fintrack/budget/category/:cateogory_name

        {
          path: '/fintrack/budget/category/:categoryName',
          element: <CategoryAccountList/>,
        },

---

obtner la ruta previa,en el prop enviado por la page anterior, para el link de regreso. listo

hacer los peticions al backend, para obtener incormacion de las cuentas,listo

realizar la totalizacion de los parametros summary.listo

enviar la totalizarion de los parametros kpi a CategoryAccountList. se us a un componente ui llamado summary...listo

manejo de error, en caso que las cuentas no existan, o errores en la totalizacion de los parametros. POR MEJORAR.

obtener la ruta actual para enviarla a la proxima page , y definir como estado del link, la informacion de la cuenta. listo.

renderizar, con un compoenente CategoryAccountList, o  las cueentas asociadas a la cateogry, con su respectivo link 'category/:CaegoryName/accountId, tmbien enviarle la ruta actual como ruta previa. LISTO.

armar el renderizado de CategoryAccountList,, con la buble inform category arriba, y la lista de cuentas con sus link y estado respectivo.LISTO.

luego, hacer el componente de AccountDetail, mostrando el detalle de la cuenta seleccionada.
como igual como se hizo con accountDetail o pocektDetail, etc. SE CREO CategoryDetail. LISTO.

============================
base de datO con time zone. listo

arreglar query de list of movement para account detail, para account-opening and bank, income, investment type accounts. listo

fintrack incluir pnl, y su backend, listo.

ARREGLAR EN EL FRONTEND DE PNL, QUE EL BODY IN ENVIE EL TIPO DE CUENTA CORRECTMENTE EN EL A CASO DE INVESTMENT ACCOUNT. listo.

mostrar los balances de las cuentas dentro de las opciones de los dropdown. Listo.

ahora ocurre que al realiczar un tracker c de cualquier cuenta o movimiento que muetstre el balance de la cuenta en las opciones del dropdown, entonces, se va a tener que hace un refetch para actualizar las balances de las cuentas dentro de las opciones del dropdow. se utilizo un artificio, para que la url se actualice despues de submit , y asi con el useEffect del hook useFetch, se renderiza y actualiza las opciones del dropdown accounts.  LISTO.

??????????????????????????????????????????
CON REACT QUERY SE PUEDE HACER, PERO ESTOY USANDO ESTADOS, ASI QUE, SERA QUE SE HAGA CON UN REFETCH , UNA NUEVA PETICION, UN REFRESCAMEINTO DE LA PAGINA, o cambiar la url en forma inocua, para que el sideEffect del useFetch re-renderingm y, aplicarlo en todas las paginas del tracker, a menos que se simplifique con un componente reutilizable. 
???????????????????????????????????????

REVISAR CREACION DE CUENTAS. PENDIENTE

ACCOUNT DETAIL. LISTO.
INVESTMENT DETAIL NO EXISTE. LISTO.
BOTON DE REGRESO DE POCKET DETAIL . LISTO.
DEBTOR DETAIL .LISTO

POCKET DETAIL. listo

INCLUIR DPOSITO Y RETIRO A CUENTAS DE BANK Y INVESTMENT EN TRACKER PROFIT N LOSSES PnL. LISTO

PARA LAS TRANASCCIONES PnL, IDENTIFICAR L EL REGISTRO DE LA TRANSACCION CON EL TIPO DE TRANSACCION COMO PROFIT ADJUSTEMNT O LOSS ADJUSTMENT, INSTEAD OF DEPOSIT OR WITHDRAW. UNA OPCION ES USAR PnL con el tipo de transaction deposito / withdraw. PENDIENTE

LA TRANSFERENCIA DESDE INVESTMENT A POCKET, NO SE REFLEJA BIEN EN EL BALANCE DE INVESTMENT, SALEN 2, Y AUMENTA 1, ESO NO SE ENTIENDE TRANSFER DESDE INVESTMENT A POCKET. LISTO.

entender probabilidad con crystall ball
stimacion / risks / etc.
---------------------------------------


validacion 
cambiar validacion para que no se borre cuando hay errores. LISTO

manejo y administracion de usuarios mediante authentication PENDIENTE

=====================================
PENDIENTE
EDICION

VERICFICAR QUE SE PUEDE EDITAR Y QUE NO. SU INTERCONEXION EN LA BASE DE DATOS. Y DONDE EN EL FRONTEND. SIF FUERA UNA WEB, S LO HARIA EN UNA PAGINA ADMIN, MOSTRANDO LA LISTA DE CUENTAS POR TIPO. A SELECCIONAR.

DONDE SE METERAN LA PARTE DE EDICION
EN LOS PAGE DETAIL? O SE HARA UN A LISTA ADMIN?
estrategia para edicion > PENDIENTE
definir los campos que se pueden editar
en el proceso de LA EDICION SE DEBE CONSIDERAR LAS INTERRELACIONES ENTRE LAS TABLAS DE BBDD.
estrategias de borrado de informacion defnir.
edicion para pocket y budget, en cuenta a desired date y target, y budget.
eliminacion de cuentas. PENDIENTE EDICION.
------------------
No hay un INCOME account detail 
INCOME DETAIL NO EXISTE. PENDIENTE.
 NO ESTA CONSIDERADO COMO DETAIL, SINO COMO LAST MOVEMENT DE BANK ACCOUNT BALANCE.

======================
BUGS POR ARREGLAR 
AL CREAR CUENTAS INCOME NO SE REFLEJAN EN LOS MOVIMIENTOS. LISTO.

AL CREAR CUENTAS POCKET NO SE REFLEJAN EN LOS MOVIMIENTOS COMO ACCOUNT OPENING.LISTO 

CUENDO SE CREAR UNA CUENTA DEBTOR, APARECE PERO SIN DESCRIPCION DE LA TRANSACCION. LISTO

AL CREAR UNA T CTA INVESTMENT, SI SE REFLEJA EN LOS MOVIMIENTOS PERO NO APARECE LA ESCRIPCION DE LA TRANASACCION. LISTO.
====================
si no hay cuentas creadas empezar con un mensaje modal con detalles de cuentas creadas y cuentas faltantes, o decir que no se tienen las cuentas necesarias y  e ir a crearlas. BUENO AQUI COLOCQUE NO OPTIONS COMO PLACEHOLDER DENTRO DE LOS DROPDOWNS CUANTO NO HAY CUENTAS CREADAS. NO HAY MENSAJE AL USAURIO PARA CREACION DE CUENTAS NI REDIRECCION, POR AHORA.
=======================
dashboardTotalBalanceAccountByType
cuando no consigue cuentas por tipo mestra el error 400 y error while getting account by type
400. No available accounts of type category_budget

loso error message que se muestran al cleinte, sale solo el status code. PENDIENTE MEJORAR ERROR HANDLING.

cuando son cero, aparecen con el signo negativo en el summary de overview. LISTO.
=======================
LISTO.
renderizar el periodo, y el balance inicial y final de la cuenta LISTO.

renderizar las ultimas transacciones de una cuenta por account_id, en overview account_detail.LISTO

modificar transactions table para registrar el balance nuevo de la cuenta. LISTO

MODIFICAR transaction controllers and createion controller to consider record balance . LISTO
 
ENDPOINTS
GET informacion de cuenta segun su account_id LISTO.

GET las transacciones de una determinada cuenta segun su account_id. LISTO.

enter en tracker transfer, al presionar el boton de seleccion de tipo de cuenta para la cuenta de bottom card, se desabilita el radio de los radio input, y pareceria que se hace submit. LISTO
------------------------------
PENDIENTE
MEJORAR LA DESCRIPCION DE LA TRANSACCION. Hablar con el cliente,pra incorporar sus preferencias. 
ERROR ACCOUNT STARTING AMOUNT CUANDO NO HAY TRANSACTIONES

EN la DESCRIPCION DE LA CREACION DE UNA CUENTA INVESTMENT, NO SE VE LA HORA EN QUE SE HACE LA TRANSACTION.LISTO.

===========================
asegurar el criterio del signo para el start account amount sea coherente en todas las cuentas a crear. OBSERVACION
===========================
AHORA RESULTA QUE ADD ACCOUNT PARA CREAR UNA CUENTA NUEVA NO FUNCIONA. LISTO.

TAMPOCO RECONOCE LOS MOVEMENTS POCKET SAVING, INCOME, ETC. LISTO.

CUANDO SE ABRE UNA CUENTA, DEBTOR, CON UN PRESTAMO INICIAL DESDE UNA CUANTA BANK EXISTENTE, COMO DEBE REGISTRARSE ELM MOVIMIENTO, COMO ACCOUNT-OPENING, O M COMO DEBT?. LISTO.

CREO QUE HAY QUE ABSTRAERSE DE LOS MOVIMIETNTOS Y PENSAR EN EL TIPO DE TRANSACCIONES MAS BIEN.

EL ACCOUNT OPENING DEBERIA APARECER EN LA CUENTA QUE SE ABRIO, Y LA CUENTA BANK I HIZO UN LEND, DEBERIA APARECER COMO UN DEBT,. AUNQUE , NO SE HIZO DESDE EL TRACKER DE MOVEMENTS PUEH.. LISTO Y REVISAR OTRA VEZ. 
=================

===========================

AL HACER UN TRACKER BORROW A CUENTA DBTOR NO SE VE LA DESCRIPTION EN OVERVIEW. LISTO.

si no se hace la seleccion de la cuenta, no se muestra la validacion en DEBTS tracker.LISTO

Deberia aparecer un loading, ?

investment creada con deposito inicial se muestra en los movements, pero no muestra LA description tr es deposit. LISTO

cuando se crea una cuenta pocket o una investment no se refleja en el overview. LISTO.

cuando se hace un borrow desde tracker a c una cuenta debtor, no se refleja la descriptcion en overview. LISTO.

cuando se crea una cuenta pocekt no se refleja en los movimientos en overview. LISTO.

cuando se crea una cuenta c expense o category obj la descripcion no se refleja en los movimientos en overview. LISTO.

hacer una helper o util function. PARA estandarizar la descripcion de las transacciones.PENDIENTE.

=================
LISTO .
lend y borrow se registran al reves en la description de las transacciones. al hacer el tracker de debt. 
----------
======================
OJO EN NINGUNA PARTE SE REFLEJA EL BALANCE TOTAL DE INVESTMENT. PENDIENTE REVISAR CON CLIENTE YA QUE NO SE CONSIDERO EN EL ORIGINAL.

PODRIA AGREGARSE UN TOTAL INVESTMENT, O SE LE COLOCA ENCIMA AL TITULOS DE LOS INVESTMENT BALANCE.????? 
======================
LA NUEVA FORMA DE MANEJAR E INTRODUCIR LAS CATEGORIAS Y SUBCATEGORIAS, ESTA PENDIENTE IMPLEMENTARLA,. PENDIENTE.
---------------
disable save in new profile, new cat, i y s plusvg btn en tracker 
en new pocket, fecha futuro. se queda abierto el datepicker despues de darla a sae
---------------
se mustra como account-opening. initial borrow y me parece bien

arreglar el %Profit NaN
***********************
debt tracker - 
arreglar mensajes
borrow debtor a un investment - no se refleja como investment
si se refleja como debtor - ojo cual era la regla de negocios. para investment dest.
osea las cuentas investment pueden ser (deposit/w, borrow/l, )
de debt a tracker , tambpoco se refleja como pocket movments, EL MONTO SAVED SI, PERO NO EL AVG.

EL ORDEN DE MOVEMENTS DEBERIA SER POR FECHA 
-----------------------------------
MEJOR CONTROL
ES MAS FACIL PARA ESTA VERSION, QUE DEBTS SEA SOLO CON BANK ACCOUNTS, LISTO YA SE CAMBIO
y colocar lend y borrow al lado de la cuenta del usuario. LISTO
crar referencia mas complex para transacction entre cuentas.
------------------------------------
MENSAJES EN TRACKER.

===========================
PENDIENTES
exportar movimientos o transacciones, con boton
descargar en pdf.
descargar en excel.
exportar .csv , google sheet

agregar cuentas de ajuste positivo y negativo, a donde? en accounting, para bank e investment. LISTO SE CONSIDERO UN PAGE MOVIMIENTO TRACKER PnL.



add money se puede s hacer con ajuste positivo, que so depositos externos / retiros con ajuste netgativo. NO, YA SE HIZO CON PNL EN EL TRACKER.

===========================
LISTO
Arreglar mensajes largos (no fund) ui de tracker . MAS O MENOS
arreglar mensaje de no funds. MAS O MENOS UNA LA

===========================
LISTO
updated_at no se actualiza automaticamente en tracker y al hacer la creacion de debt account createDebtor. 
VERIFICAR EN TODAS LAS TRANFERENCIAS ENTRE CUENTAS, TANTO TRACKER COM CREATE ACCOUNTS.
===========================
PENDIENTES
se crea una cuenta slack cuando se crea una cuenta bank. para equilibrio.
pero si hay un error, no deberia crearse.

===========================
LISTO
APLICAR DEBOUNCE A TEXTAREAS  
===========================
PENDIENTE
LS F LAS FECHAS DE LAS TRANSACCIONES tracker NO DEBERIAN SER AFUTURO,
acutalizar los updated_at en bbdd tables.
=================
LISTO
deshabilitar el save button en new account, cuando isLoading, y asi con loos demas new forms  and so on.
=================
PENDIENTE
* el usuario id userId , debe ser verificado antes de entrar al tracker de fintrack.
TRANCADO CON EL USER AUTHENTICATION. SOBRE TODO DONDE GUARDAR LAS CLAVES O ACCESS TOKEN Y REFRESH TOKEN

=================
LISTO
* en el caso que no haya datos para renderizar, deberia ser un warning y no un error.
por ejemplo> [400] No accounts available of type pocket_saving.. dashboardAccountSummaryList
Error while getting account balances
=================
CATEGORY
HACER UN RESUMEN POR SUBCATEGORIA DE CATOGORY
ahorita se puede hacer un resumen por category_nature
 
ahorita no puedes hacer un resumen por subcategoria, pues, para eso se debe tracker los montos por subcategoria, es decir, debe etructurarse las cuentas por subcategoria.
CATEGORY NATURE - SUBCAT 1, SUBCAT2, SUBCAT3

OSEA, LAS CUENTAS SERIAN ALGO ASI>
SUBCAT1.CATEGORY_X.NATURE_x
Y EL PPTO Y LOS GASTOS SE LLEVARIAN POR SUBCATEGORY, Y AL MOMENTO DE MOSTRARLOS SERIAN AGRUPACIONES DE 
BALANCES DE LAS SUBCATEGORIAS PERTENECIENTES A U A UNA CATEGORY_NATURE O A UNA CATEGORY TOTAL.

O
CATE_1.NATURE_1.SUBCAT_1.

*********************
error> something went wrong with the movement_types table LISTO
deshabilitar value en account creation  del tipo income source y el msg valid. LISTO
======================
LISTO
era un error de bad typeying
expense tracker exp
no se registra t la transferencia entre cuentqas bank y account cateory budget. 
Destination or Source account not found
transferBetweenAccounts
🚀 ~ sourceAccountInfo: undefined
=================
LISTO
se CAMBIO el endpoint a movement trnsactions, y se adecuaron los tipos del setKpiData y el ApiRespDataType esperado en overviewFetchAll relacionado con el type safeGuard. ubicado en el archivo overviewFetchAll.
INcome movement tracker no se refleja en overview. LISTO
era un error de typing income vs incom

=================
OJO

EL NET WORTH MOSTRADO, ES REALMENTE UN OPERATIVE PROFIT, NO ES EL NET WORTH REAL SEGUN LA DEFINICION EN CONTABILIDAD, YA QUE ESTE SE CALCULA CONSIDERANDO POR EJEMPLO LOS DEBTS (RECEIVABLES O PAYAIBLAES), LOS SALDOS EN INVESTMENT, ASI COMO ACTIVOS Y PASIVOS NO REGISTRADOS O TRACKEADO S AQUI. 

efecto NET WORTH CALCULATION
accion> verificar con usuario cliente

SI NETWORTH SE DEFINE COMO INCOME - EXPENSES. (OPERATIVE PROFIT)
el saldo de las cuentas bank, investmen, etc que se abrieron con un monto
mayhor que 0, no interviene en la ecuacion. (ACTIVOS CORRIENTES)
Tal vez el concepto aqui seria que forma parte de el patrimonio. mas bien.
las cuentas bank que se abren con saldo positivo, se desconoce de donde viene el saldo,
 por lo que se les asocia una cuenta slack, . PUDIERA ASOCIARSE UNA CUENTA CASH, PARA LLEVAR EL CONTROL DE LO QUE SE DEPOSITA/RETIRA DE AFUERA., bueno seria lo mismo que slack, pero con un nombre entendible.
=================
PENDIENTE
LA FECHA DE DESIRED DATE, DEBERIA BLOQUEARSE PARA FECHAS ANTERIORES A LA FECHA ACTUAL NOW.
DE POCKET NEW POCKET.
  
 /date validation
    // hay establecer regla para la fecha> validar que la fecha no sea mayor que el proximo dia habil? o que no sobrepase el lunes de la prox semana? o no sea mayor que el dia de hoy? o puede ser futura pero en el mismo mes actual? o libre para realizar simulaciones, aunque esto en caso de tener que hacer conversiones monetarias habria que preverlo?
    // const accountStartDateNormalized =
    //   validateAndNormalizeDate(account_start_date);
    // console.log(
    //   '🚀 ~ createAccount ~ accountStartDateNormalized:',
    //   accountStartDateNormalized
    // );         
===========================
LISTO
RESULTA QUE EL SERVIDOR TEINE UNA FECHA DISTINTA A DONDE ESTA EL USUARIO. QUE IMPLICACIONES TENDRIA ESO?
como resolveer lo de la fecha del serevidor, como obtenerla. SE COLOCSARON TIME ZONE EN LA BBDD. LISTO.
=================

LISTO
AGREAGAR LAST MOVEMENTS de INVESTMENts LISTO.
=================
LISTO
AHORA NO SE FREFLEJA N LOS MONTOS NI LAS TRANSFERENCIA PARA INESTINVESTMENT

=================
LISTO
ACTIVAR EL VALUE PARA CUENDO SE CREA UNA CUENTA BANK, Y DESACTIVARLO PARA CUENTAS INVESTMENT O INCOME
AL DESACTIVARLO PARA INCOME O INVESTMENT, SE QUEDA DESACTIVADO PARA BANK.
se ajusto el state     setIsDisabledValue(false);

=================
LISTO
incluir los movimientos d investment, No se reflejan en la lista de overview, PENDIENTE
when creating an account it is not rendered at overview LISTO
revisar el monthly avg saving. LISTO
=================
LISTO
RESULTA QUE SI SE QUIERE SALDAR UNA DEUDA CON UN DEBTOR, SE HACE DESDE TRACKER HACIENDOLE UN LEND A ESE DEBTOR. LISTO

los movimientos debt, se pueden hacer desde tracker y cuando se abre un nuevo debtor profile, por lo que se debe renderizar no solo el tracker sino tambien la apertura de la d cuenta del debtor como un movimiento DEBT. LISTO
================================

proyeta seguridad, confianza y mejor imagen.
como aprovechar las oportunidades.
como ser efectivo.
como navegar el laberitno de la vida o el poder


===========================
LISTO
en debt creation borrowind no funciona?LISTO.
===========================
LISTO
HAY QUE ARREGLAR LA RESTRICCION DE FONDOS, CUANDO SE CREA UN PROFILE DEBTOR. en el backend.
Al parecer no hay restriccion de saldo, para prestar u a un debtor desde debtor creation, colocar la limitacion de funds. Verificar backend. LISTO
hay que arreglar es donde mostrar el error de restriccion de fondos. en debts. frontend.
===========================

LISTO
tampoco se reflejan los expenses na en las listas de summaries
=======================
sugerencia design
CAMBIAR LEND BORROW BANK INVESTMENT POCKET DEL FRONTEND TRACKER DE TRANSFER Y DEBTS, POR ICONOS, Y AGREGARLES TOOLTIPS - ESTO ES DISENO, HAY QUE BUSCAR LAS FIGURAS REPRESENTATIVAS DE ESOS CONCEPTOS.
=======================
meter account type id en transactions para no hacer join, revisar, almomento de mostrar los movimientos
SERIA REDUNDANTE . NO SE HIZO.
=========================
MISCELANEOS
EN INVESTMENT ACCOUNT BALANCE
//PENDIENTE DEFINIR REGLA DE NEGOCIO PARA VALORAR EL STATUS SQUARE Y PASAR EL ALERT LISTO
//questions: does status have some conditional or variable style? semaforo? cual es la regla de negocio?
//seems that balanceType has at least two possible values: loss / profit or earned
//capital could be the amount of the investment or not needed?
//factual balance is datum or calculated?
//DE DONDE SE TOMA EL CAPITAL INVESTED?

UTILIZAR LOS ID EN LOS QUERYIES Y NO LOS NAME. HABRIA QUE CAMBAIAR BASTANTES QUEERIES. DEJARLO PARA VERSION DEFINITIVA. REALMENTE VALE LA PENA?. 
LIMPIAR CONSOLE.LOGS.

como hacer validation en linea osea no esperar el submit

hacer el debounces en los notes input textarea

no resetear los datos, si iaparece un error del servidor, pero como se hace, manualmente el usuario>? despues de somter l el formulario? LISTO

ningun debt se muestra en overview, ni los opening, ni los tracker LISTO

account opening de categorias no se muetra,m y esta bien asi. porque no hay desembolsos.

el tracker de expense tampoco se muestra en overview . LISTO

yo eliminaria value en income account opening. LISTO.

 income sigue apareciendo negativo en overview. LISTO

acortar duracion de mensajes de warning error al to user, y quitar el mensaje de arriba, revisar el mensaje que aparece en el top de los forms

aparece doblemensaje de error en e tracker.LISTO

estilos de bigBoxResult, los estilos en linea colocarlos en un css. LISTO para algunos, revisar todos.

HACER QUE LOS SUMMARY LIST SE MUEVAN CON SCROLL MIENTRA LO DEMAS SE QUEDA FIJO.  HABERLO DICHO CUANODO ESTABA HACIENDO EL DISENIO, VERDAD. AHORITA MAS CONCENTRADO EN EL BACKEND Y TERMINAR LO QUE FALTA EN FUNCION DEL ALCANCE ORIGINAL. DESPUES VEREMOS.

MINIMIZAR LOS CONSOLE.LOG DEL BACKEND. RETARDAn EL RENDERIZADO EN FRONTEND.LISTO

HACER UNA VERSION DEFINITIVA,. DONDE SE OPTIMIZAN LOS QUERIES PG CON INDEX. y hacer vistas donde haga falta. PROBAR.

LAS TABLAS DE TRANSACTION S SE PUEDE SIMPLIFICAR ASOCIANDOLAS A UNA TABLA DE ENTRIES DE CADA TRANSACTION

HACER QUE APAREZCA "NO OPCION" EN LOS SELECTOR ACCOUNT"S, CUANDO NO HAY OPCIONES O NO HAY DATA. EN LOS DROPDOWN SELECTORS.LISTO

QUE SE QUIERE COLOCAR EN EL BOTON SEE MORE DE OVERVIEW?


=======================
"movement_type_id" "movement_type_name"
1 "expense"
2 "income"
3 "investment"
4 "debt"
5 "pocket"
6 "transfer"
7 "receive"
8 "account-opening"

"account_type_id"	"account_type_name"
1	"bank"
2	"investment"
3	"debtor"
4	"pocket_saving"
5	"category_budget"
6	"income_source"

"transaction_type_id" "transaction_type_name"
1 "withdraw"
2 "deposit"
3 "lend"
4 "borrow"
5 "account-opening"
