empezar creando el usuario.
comenzar con crear cuentas de bank, expense, pocket_saving, investment, income_source
tracker de expense
Hacer seguimiento del comportamiento del currency, en las tablas.
Fijar el currency en usd.
Hasta definir que es lo que se quiere hacer con la seleccion del currency a cop?
Una plataforma que haga seguimiento a multiples monedas, me parece engorroso, por lo menos al principio, y hay varias maneras de manejarlo:
1.- seleccion solo una moneda por defecto para todo.
2.- si los tracker seleccionan una moneda distinta al usd, entonces se registra y ya, pero el monto debe estar en la moneda por defecto o usd. se registraria el monto y el currency origen, pero se guarda usd.
3.- Se puede incorporar una libreria que haga conversiones actualizadas de la moneda seleccionada a la moneda usd por defecto, para guardar todos los datos y calculos, etc.
6.- llevar el seguimiento de datos multimonedas, y esto seria, que todos las transacciones se pudieran llevar en multimonedas, y los reportes en multimonedas, lo que quiere decir que seria una capa o subdivision, sobre todos los procesos, para reflejar las monedas que concuerden, asi como llevar historicos de tasas de cambio, etc.
esto lo veo que es una complicacion innecesaria.

# verificar los currency en todas las tablas incluyendo las tablas especificas.

pendiente el calculo de los promedio9s de income y de expenses
separar en el componente de goal savings lo corresponidnete a promedios mnesuales de income y expense.

determinar los estados globales, cuales serian globales y cuales loclaes en los componentes.

una vez probado el tracker de expense, seguir con los otros trackers...

y luego armar las paginas de detalles: account detail, debtor detail, pocket detail, etc.

incorporar las funciones de agreagar dinero a una cuenta, modificar el balance para incoporar ganancias, de pronto se pudiera crear una cuenta de ganacias por inversion, realizar transferencias entre cuentas bancarias, debtors y pocket saving, no lo se todavia.
como se maneja las ediciones, es decir si se quiere editar un balance de cuenta, como se debe registrar la transaccion, > edicion, balance viejo monto, nuevo monto?. y luego el balance se cambia en el user_accounts,
que se puede editar: la incormacion de lasl cuentas bank,, no lo se.

si se quivoca en la trasaccion, entonces se deberia poder editar la transaccion, pero eso involucra deshacer todas las operaciones involucradas, dependiendo del tipo de operacion, por ejemplo:
borrar cuentas, se borrarian todas las transacciones asociadas, modificar balance de una cuenta, involucra modificar las transacciones o registrar una transaccion de modificacion, pero igual no tiene sentido, porque lo que interesa es que todos los balances cuadren.

como llevar el retorno de las cuentas, se deberia entonces poder reiniciar el balances de cuentas de banco y de investment, pero entonces como llevarias el calculos de lo que se ha ganado o perdido, por cuenta, porque se debe comparar siempre con el monto incial de la lcuenta en un periodo determnado.

a meno que la edicion de los balances se cuente como una operacion mas, desde una cuenta ficticia?

const user = import.meta.env.VITE_USER_ID;

adaptar en el backend al uso de multimoneda.

/dashboard/multicurrency/balance/summary/
router.use('/dashboard/multicurrency', dashboardMulticurrencyRoutes)
multicurrency.routes
dashboardMulticurrencyRoutes.js
//GET SUMMARY OF CATEGORIES, POCKETS, AND DEBTORS
router.get('/balance/summary/', dashboardMulticurrencydAccountSummaryList);

AGREGAR CURRENCY A LAS TABLAS ESPECIFICAS, PARA BUDGET Y PARA TARGET CATEGORIES Y POCKET_SAVINGS

last movements
desde el backend< MOVEMENT NAME>
expenseMovementsResponseType

{
"movement_type_name": "expense",
"account_id": 13,
"account_name": "housing_want",
"account_balance": "128057.73",
"budget": "200.00",
"currency_code": "usd",
"account_type_id": 5,
"account_type_name": "category_budget",
"category_name": "housing",
"subcategory": "",
"category_nature_type_name": "want",
"account_starting_amount": "50.00",
"account_start_date": "2025-04-02T03:20:48.157Z",
"description": "gastos en pesos.Transaction: deposit.Received 1100 cop from account CASH of type: bank account, to housing_want of type category_budget. Date: 4/11/2025, 8:00:00 PM",
"transaction_actual_date": "2025-04-12T00:00:00.000Z",
"amount": "1100.00"
},

ene l query del backend hacer> numbers, CAST(XXXX as float) a account_balance, budget, account_starting_amount, amount

lo que se va arenderizar en last movments
{
categoryName: 'Category Name', //category of expense
record: 'Record', //data or title?
description: 'Description', //data
date: new Date(),
},

Category Name > account_name o category_name

description > description.split('.')[0] equivale al note
date > transaction_actual_date

endpoint>
/api/fintrack/dashboard/movements/movement/?movement=expense&user=eacef623-6fb0-4168-a27f-fa135de093e1

urlLatestMovement =

hacer un userEffect>

const user = import.meta.env.VITE_USER_ID;
//STATES---------------------
const [bankAccountsToRender, setBankAccountsToRender] =
useState<AccountToRenderType[]>(ACCOUNT_DEFAULT);

//DATA FETCHING
//Creo que los data fetching deberian hacerse desde la pagina principal y pasar los props a los componentes.
//por ahora pasar userId por params, pero deberia manejarse en el backend con auth
//bank accounts balance
const urlBankAccounts = `${url_get_accounts_by_type}/?type=bank&user=${user}`;
const {
data: bankAccountsData,
isLoading,
error,
} = useFetch<MovementByNameResponseType>(urlBankAccounts);

useEffect(() => {
function infoToRender() {
const newBankAccounts: AccountToRenderType[] =
bankAccountsData &&
!isLoading &&
!error &&
!!bankAccountsData.data.accountList?.length
? bankAccountsData.data?.accountList?.map((acc, indx) => ({
nameAccount: acc.account*name,
concept: 'balance', //it is important to know the data structure from backend
balance: acc.account_balance,
type: acc.account_type_name,
id: acc.account_id ?? `${acc.account_name + '*' + indx}`,
currency: acc.currency_code ?? defaultCurrency,
}))
: ACCOUNT_DEFAULT;

      setBankAccountsToRender(newBankAccounts);
    }
    //---
    updateBankAccounts();

}, [bankAccountsData, isLoading, error]);

// const { data, isLoading, error } =
// useFetch<ExpenseAccountsType>(url_accounts);
console.log('accounts:', bankAccountsData, error, isLoading);

if (isLoading) {
return <div>Loading...</div>;
}

---

yo agregaria el amount y el currency_code

---

habria que oner operativo las transactions tracker de debt
last debts
nombre y apellido, debtor/lend, date, amount, description,
diem
idem

---

separa el componente income and expense de goals

el fecth de saving, income, expense total y avg, va a tner que hacerse desde overview, y parsarlo com o props, a saving goals, pero tambien hay que calcular el balance de pocket saving y el target,

# en el backend t en total balance account of each type account, falto el balance de los pocket saving

revisar get accoutn by id
pero la que se debe usar es account summaryu list por tipo de cuenta category y debtor.

usar get accounts by type, para mostrar cuentas de de pocket

el total balacne of each type account deberia contemplar multimonedas, y presentar po tipo de moneda

PARA EL ESADO GLOBAL
debtor> dashboard total account balance,
modificar para multinmoneda
