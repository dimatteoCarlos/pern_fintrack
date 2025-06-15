user = c109eb15-4139-43b4-b081-8fb9860588af

PENDIENTESf

modificar transactions table para registrar el balance nuevo de la cuenta.
la regla de negocio de registra account_id, corresonde al tipo de transaccion rgistrodo,
 por ejemplo si es un deposito, esntonces account_id done se hizo el deposito, la contraparte withdraw, se refleja donde se hizo el withdraw y si es nuevo con monto 0, seria account-oening, pero si hubo transaction con monto distinto de 0, entonces se refleja movimiento account opening, pero trancsactiontype el tipo de trnsaccion correspondiente. cnuevo saldo on su respectio 
 
ENDPOINTS
GET informacion de cuenta segun su account_id LISTO.
GET los movimientos de una determinada cuenta segun su account_id.
buscar archivo trbyid.md

ent r en tracker transfer, al presionar el boton de seleccion de tio de cuenta para la cuenta de bottom card, se desabilita el raio los radio input, y pareceria que se hace submit. LISTO


mejorar la descrioption de rtransaction received, para que apareczca el nombre de la cuenta obejeto del movimiento. hacer una helper o util function.


===========================
PENDIENTE
AL HACER UN TRACKER BORROW A CUENTA DBTOR EX SB NO SE VE LA DESCRIPTION EN OVERVIEW

si no se hace la seleccion de la cuenta, no se muestra la validacion en DEBTS tracker.
eberia aparecer un loading, 
deisabled boton mas en tracer e when loading
===========================
TODAS LAS DETAIL PAGES ESTAN PENDIENTES
definir el disenio y lo sobre todos los datos
DONDE SE METERAN LA PARTE DE EDICION
EN LOS PAGE DETAIL? O SE HARA UN A LISTA ADMIN?
definir los campos que se pueden editar
LA EDICION SE DEBE CONSIDERAR LAS INTERRELACIONES ENTRE LAS TABLAS DE BBDD.
estrategias de borrado de informacion defnir.
=================
PENDIENTE
BOTON DE REGRESO DE POCKET DETAIL . LISTO
CATEOGRY DETAL
DEBTOR DETAIL
ACCOUNT DETAIL
INVESTMENT DETAIL NO EXISTE.
=================
LISTO .
lend y borrow se registran al reves en la description de las transacciones. al hacer el tracker de debt. 
----------

investment creada con deposito inicial se muestra en los movements, pero no muestra LA description tr es deposit
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
de debt a tracker , tambpoco se refleja como pocket movments, EL MONTOO SAVED SI, PERO NO EL AVG.
EL ORDEN DE MOVEMENTS DEBERIA SER EN FECHA DESC.
--------------------------
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
agregar cuentas de ajuste positivo y negativo, a donde? en accounting, para bank e investment.
edicion para pocket y budget, en cuenta a desired date y target, y budget.
eliminacion de cuentas.
add money se puede s hacer con ajuste positivo, que so depositos externos / retiros con ajuste netgativo.
simplificar al descripcion en overview y colocar un dropdown para mostrar el completo description.
===========================
PENDIENTE
Arreglar mensajes largos (no fund) ui de tracker . MAS O MENOS
arreglar mensaje de no funds. MAS O MENOS UNA LA

===========================
PENDIENTE
updated_at no se actualiza automaticamente en tracker
y al hacer la creacion de debt account createDebtor. 
VERIFICAR EN TODAS LAS TRANFERENCIAS ENTRE CUENTAS, TANTO TRACKER COM CREATE ACCOUNTS.
===========================
PENDIENTES
se crea una cuenta slack cuando se crea una cuenta bank. para equilibrio.
pero si hay un error, no deberia crearse.

===========================
PENDIENTE
APLICAR DEBOUNCE A TEXTAREAS  
===========================
PENDIENTE
LS F LAS FECHAS DE LAS TRANSACCIONES tracker NO DEBERIAN SER AFUTURO,
acutalizar los updated_at en bbdd tables.
=================
listo
deshabilitar el save button en new account, cuando isLoading, y asi con loos demas new forms  and so on.
=================
PENDIENTE
* el usuario id userId , debe ser verificado antes de entrar al tracker de fintrack.
TRANCADO CON EL USER AUTHENTICATION. SOBRE TODO DONDE GUARDAR LAS CLAVES O ACCESS TOKEN Y REFRESH TOKEN

=================
PENDIENTE
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
======================
OJO EN NINGUNA PARTE SE REFLEJA EL BALANCE TOTAL DE INVESTMENT
PODRIA AGREGARSE UN TOTAL INVESTMENT, O SE LE COLOCA ENCIMA AL TITULOS DE LOS INVESTMENT BALANCE. 
======================
LISTO
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
PARA UN TRACKING COMPLETO SE DEBERIA CONSIDEERAR CUENTAS DE AJUSTES POSITIVO Y NETGABTIVO , PARA CUENTAS DE AHORRO QUE GENERANI INTERESES, PERDIDAS Y GANANCIAS EN CUENTAS DE INVERSION,DEPOSITOS Y RETIROS DE CUENTAS BANCARIAS,POR EJEMPLO TENER UNA CUENTA CASH PARA REFLEJAR DEPOSITOS Y RETIROS DE CUENTAS BANK. 

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
  const originRoute = useLocation().pathname;
  const navigateTo: NavigateFunction = useNavigate();
  const createNewPocket = (originRoute: string) => {
    navigateTo(originRoute + '/new_pocket', {
      state: { previousRoute: originRoute },
    });
  };

        <OpenAddEditBtn
            btnFunction={createNewCategory}
            btnFunctionArg={originRoute}
            btnPreviousRoute={originRoute}
          >
===========================
PENDIENTE
RESULTA QUE EL SERVIDOR TEINE UNA FECHA DISTINTA A DONDE ESTA EL USUARIO. QUE IMPLICACIONES TENDRIA ESO?
como resolveer lo de la fecha del serevidor, como obtenerla.
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
UTILIZAR LOS ID EN LOS QUERYIES Y NO LOS NAME. HABRIA QUE CAMBAIAR BASTANTES QUEERIES. DEJARLO PARA VERSION DEFINITIVA. REALMENTE VALE LA PENA?. 
LIMPIAR CONSOLE.LOGS.

como hacer validation en linea osea no esperar el submit

hacer el debounces en los notes input textarea

no resetear los datos, si iaparece un error del servidor, pero como se hace, manualmente el usuario>? despues de somter l el formulario?


ningun debt se muestra en overview, ni los opening, ni los tracker LISTO

account opening de categorias no se muetra,m y esta bien asi. porque no hay desembolsos.

el tracker de expense tampoco se muestra en overview . LISTO

yo eliminaria value en income account opening. LISTO.

 income sigue apareciendo negativo en overview. LISTO

acortar duracion de mensajes de warning error al to user, y quitar el mensaje de arriba, revisar el mensaje que aparece en el top de los forms

aparece doblemensaje de error en e tracker.

estilos de bigBoxResult, los estilos en linea colocarlos en un css. LISTO para algunos, revisar todos.

HACER QUE LOS SUMMARY LIST SE MUEVAN CON SCROLL MIENTRA LO DEMAS SE QUEDA FIJO.  HABERLO DICHO CUANODO ESTABA HACIENDO EL DISENIO, VERDAD. AHORITA MAS CONCENTRADO EN EL BACKEND Y TERMINAR LO QUE FALTA EN FUNCION DEL ALCANCE ORIGINAL. DESPUES VEREMOS.

MINIMIZAR LOS CONSOLE.LOG DEL BACKEND. RETARDAn EL RENDERIZADO EN FRONTEND.

HACER UNA VERSION DEFINITIVA,. DONDE SE OPTIMIZAN LOS QUERIES PG CON INDEX. y hacer vistas donde haga falta. PROBAR.

LAS TABLAS DE TRANSACTION S SE PUEDE SIMPLIFICAR ASOCIANDOLAS A UNA TABLA DE ENTRIES DE CADA TRANSACTION

HACER QUE APAREZCA "NO OPCION" EN LOS SELECTOR ACCOUNT"S, CUANDO NO HAY OPCIONES O NO HAY DATA. EN LOS DROPDOWN SELECTORS.

QUE SE QUIERE COLOCAR EN EL BOTON SEE MORE DE OVERVIEW?

VERICFICAR QUE SE PUEDE EDITAR Y QUE NO. SU INTERCONEXION EN LA BASE DE DATOS. Y DONDE EN EL FRONTEND. SIF FUERA UNA WEB, S LO HARIA EN UNA PAGINA ADMIN, MOSTRANDO LA LISTA DE CUENTAS POR TIPO. A SELECCIONAR.
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
