======================
LISTO
error> something went wrong with the movement_types table listo
deshabilitar value en account creation  del tipo income source y el msg valid. listo
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
se CAMBIO el endpoint a movement trnsactions, y se adecuaron los tipos del setKpiData y el ApiRespDataType esperado en overviewFetchAll relacionado con el type safeGuard.
else if (
        (endpoint.key === 'MovementExpenseTransactions' ||
          endpoint.key === 'MovementDebtTransactions' ||
          endpoint.key === 'MovementPocketTransactions' ||
          endpoint.key === 'MovementIncomeTransactions') &&
        isLastMovementRespType(data)
      ) {
        console.log('going to MovementTransactions');
        results[endpoint.key] = { status: 'success', data };
      }

INcome movement tracker no se refleja en overview
error de typing income vs incom
MovementIncomeTransactions
  url: `${dashboardMovementTransactions}?start=&end=&movement=income&user=${userId}`,
 kpiData.LastIncomeMovements: null,
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

=================
PENDIENTE
AGREAGAR LAST MOVEMENTS de INVESTMENts
=================
TODAS LAS DETAIL PAGES ESTAN PENDIENTES
definir el disenio y lo sobre todos los datos
DONDE SE METERAN LA PARTE DE EDICION
EN LOS PAGE DETAIL? O SE HARA UN A LISTA ADMIN?
definir los campos que se pueden editar
LA EDICION SE DEBE CONSIDERAR LAS INTERRELACIONES ENTRE LAS TABLAS DE BBDD.
estrategias de borrado de informacion defnir.
=================
PENDIENTE
BOTON DE REGRESO DE POCKET DETAIL
desde ListPocket
=================
PENDIENTE
LS F LAS FECHAS DE LAS TRANSACCIONES tracker NO DEBERIAN SER AFUTURO,
=================
efecto NET WORTH CALCULATION
accion> verificar con usuario cliente

SI NETWORTH SE DEFINE COMO INCOME - EXPENSES.
el saldo de las cuentas bank, investmen, etc que se abrieron con un monto
mayhor que 0, no interviene en la ecuacion.
Tal vez el concepto aqui seria que forma parte de el patrimonio. mas bien.
las cuentas bank que se abren con saldo positivo, se desconoce de donde viene el saldo,
 por lo que se les asocia una cuenta slack, 
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
LISTO
when creating an account it is not rendered at overview listo
incluir los movimientos d investment, poceket, en el overviwwe, listo
revisar el monthly avg saving. listo
=================
LISTO
RESULTA QUE SI SE QUIERE SALDAR UNA DEUDA CON UN DEBTOR, SE HACE DESDE TRACKER HACIENDOLE UN LEND A ESE DEBTOR. listo

los movimientos debt, se pueden hacer desde tracker y cuando se abre un nuevo debtor profile, por lo que se debe renderizar no solo el tracker sino tambien la apertura de la d cuenta del debtor como un movimiento DEBT. LISTO
================================

proyeta seguridad, confianza y mejor imagen.
como aprovechar las oportunidades.
como ser efectivo.
como navegar el laberitno de la vida o el poder

===========================
pendiente
RESULTA QUE EL SERVIDOR TEINE UNA FECHA DISTINTA A DONDE ESTA EL USUARIO. QUE IMPLICACIONES TENDRIA ESO?
como resolveer lo de la fecha del serevidor, como obtenerla.
===========================
LISTO
en debt creation borrowind no funciona?listo.
===========================
listo
Al parecer no hay restriccion de saldo, para prestar u a un debtor desde debtor creation, colocar la limitacion de fundos. Verificar backend. LISTO
hay que arreglar es donde mostrar el error de restriccion de fondos. en debts. frontend.
===========================
PENDIENTE
HAY QUE ARREGLAR LA RESTRICCION DE FONDOS, CUANDO SE CREA UN PROFILE DEBTOR.
===========================
listo
tampoco se reflejan los expenses na en las listas de summaries

=======================
CAMBIAR LEND BORROW BANK INVESTMENT POCKET DEL FRONTEND TRACKER DE TRANSFER Y DEBTS, POR ICONOS, Y AGREGARLES TOOLTIPS - ESTO ES DISENO, HAY QUE BUSCAR LAS FIGURAS REPRESENTATIVAS DE ESOS CONCEPTOS.
=======================
meter account type id en transactions para no hacer join, revisar, almomento de mostrar los movimientos SERIA REDUNDANTE . LISTO.

UTILIZAR LOS ID EN LOS QUERYIES Y NO LOS NAME. HABRIA QUE CAMBAIAR BASTANTES QUEERIES. DEJARLO PARA VERSION DEFINITIVA.

LIMPIAR CONSOLE.LOGS.

como hacer validation en linea osea no esperar el submit

no resetear los datos, si iaparece un error del servidor, pero como se hace, manualmente el usuario>? despues de somter l el formulario?

lend y borrow se registran al reves en la description de las transacciones. al hacer el tracker de debt. verificar esto.

ningun debt se muestra en overview, ni los opening, ni los tracker listo.

account opening de categorias no se muetra,m y esta bien asi. porque no hay desembolsos.

el tracker de expense tampoco se muestra en overview . listo

yo eliminaria value en income account opening. listo.

 income sigue apareciendo negativo en overview. listo

acortar duracion de mensajes de warning error al to user, y quitar el mensaje de arriba, revisar el mensaje que aparece en el top de los forms

aparece doblemensaje de error en e tracker.

estilos de bigBoxResult, los estilos en linea colocarlos en un css. listo para algunos, revisar todos.

MINIMIZAR LOS CONSOLE.LOG DEL BACKEND. RETARDAN LAS BUSQUEDAS.

HACER UNA VERSION DEFINITIVA,. DONDE SE OPTIMIZAN LOS QUERIES PG CON INDEX. y hacer vistas donde haga falta. PROBAR.

LAS TABLAS DE TRANSACTION S SE PUEDE SIMPLIFICAR ASOCIANDOLAS A UNA TABLA DE ENTRIES DE CADA TRANSACTION

===========================
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
