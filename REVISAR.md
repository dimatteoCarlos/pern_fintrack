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

