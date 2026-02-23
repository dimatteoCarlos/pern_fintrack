fintrack - BUSINESS RULES

ACCOUNT CREATION:
You can create account of types: bank, investment,pocket_saving, category_budget, debtor or income_source.

When creating a new account of type: bank, investment, pocket_saving, category_budget, the initial or a starting amount balance will always be 0 or positive (deposit transaction).

When creating a new account of type: income_source, the initial or a starting amount balance will always be 0 (initial-account-opening).

When creating a new account of type: debtor, the initial or a starting amount balance will be the input amount value and the  sigh will depend on the transaction type lend (-) or borrow (+). initial-lend or initial-borrow.

TRANSACTION DIRECTIONS IN ACCOUNTS:

Plus and minus symbols in trasaction description of a specific account, will indicate the "direction" of the transaction, always relative to the account in question.

For example, when viewing a Debtor account, a minus sign indicates a withdrawal (an outflow of funds from that specific account). The transaction Description always reflects the direction of funds from the account-holder's perspective.

"In any account, a positive sign represents a cash inflow (deposit/credit), meaning money has been added to the balance. Vice versa, a negative sign indicates a cash outflow (withdrawal/debit), showing that the account has disbursed funds."

Thus, for any account transaction: 
"Positive (+) = Account Inflow (Deposit/Credit)
Negative (−) = Account Outflow (Withdrawal/Debit/Disbursement)"

For example, In a Debtor account, a minus sign denotes a withdrawal/disbursement. All transaction descriptions are shown relative to the account account-owner's perspective.

ABOUT ACCOUNT BALANCES

FOR BANK AND INVESTMENT ACCOUNT TYPES
For Bank and Investment accounts, the signs represent the net position of the funds:

A Positive Sign (+) indicates a Surplus, meaning the account holds a credit balance or has achieved growth.

A Negative Sign (-) indicates a Deficit, representing an overdraft in bank accounts or a shortfall in investment capital.

FOR INCOME_SOURCE ACCOUTN TYPE
Conversely, for income source accounts, a negative balance indicates that disbursements have been made. These outflows are reflected as credits (deposits) in the respective destination accounts.

BALANCE FOR DEBTOR ACCOUNT TYPE
This system uses a cash-flow approach that differs from traditional accounting. A positive sign (+) always represents an inflow (money entering the account), while a negative sign (-) indicates a disbursement (money exiting the account).

Consequently, in a 'Debtor' account type,thus,
 A negative balance means the account has provided funds (representing an account payable from our perspective).
 
 A positive balance means it has received funds (representing an account receivable). This logic prioritizes tracking the physical movement of money over standard debit/credit conventions.

EXAMPLES OF BOTH CASES FOR "DEBTOR TYPE ACCOUNT": 
To make this crystal clear, here are the two scenarios for a Debtor Account named "John Doe":

1. Case: Negative Balance (We owe him)
Transaction: John Doe pays $500 for a company expense using his own money.
Ledger Entry: -$500.00
Meaning: The money exited John's personal pocket. Therefore, the system shows a negative balance, indicating we have a debt to him (Account Payable).

2. Case: Positive Balance (He owes us)
Transaction: The company gives John Doe a $200 cash advance.
Ledger Entry: +$200.00
Meaning: Money entered John's account. Therefore, the system shows a positive balance, indicating he is now a debtor and owes us that money (Account Receivable).

Quick Examples
If you see...	Direction of Money	What it means
+$1,000	Inflow	The account holder received money.
-$1,000	Outflow	The account holder disbursed (spent) money.

BALANCE FOR CATEGORY_BUDGET ACCOUNT TYPE
This type of account represents the expenses made.

Understanding Your Budget (Expense) Balances
Account Type: Category/Budget
In this app, budget categories work as "cost containers." They track the total amount of money that has flowed into a specific expense.
Positive Balance (+): This represents your Accumulated Spending. When you buy something, money "enters" that category, increasing the total. A positive sign (+) shows how much value has been consumed in that area.
The Cash-Flow Way: Unlike traditional accounting books (ledger way) that use complex "debits" and "credits," we use a Directional Flow approach. We show you the literal path of your money.
Key Rule: In a budget account, a (+) sign doesn't mean you have "extra cash"—it means you have spent that total amount.

Cash Flow Example
If you spend $100 on Gas using your Bank Account:
Account	Flow Sign	Meaning
Bank Account	-$100.00	Money left your bank.
Gas (Budget)	+$100.00	Money accumulated in your Gas expense.

How to read your balances:
Food Category is +$500: You have spent a total of $500 on food.

This method prioritizes the physical movement of money—where it leaves a source (negative) and arrives at a destination (positive) AccountingCoach.

Reference Guide: Cash Flow & Balance Logic
This table explains the meaning of balances for each account type based on the direction of money.
Account Type	Positive Sign (+)	Negative Sign (-)	Account Concept
Bank / Cash	Surplus: Available funds or positive balance.	Deficit: Overdraft or negative balance.	Deposits vs. Withdrawals
Investment	Gain / Deposit: Value increase or capital injection.	Loss / Withdrawal: Value decrease or funds removed.	Capital Performance
Debtor (Person)	Accounts Receivable: You lent money; they owe you.	Accounts Payable: They paid for you; you owe them.	Loans & Debts
Budget (Expense)	Accumulated Expense: Total money "sent" to this category.	Refund / Adjustment: Money returned from an expense.	Cost Accumulator
Income (Source)	Income Received: Funds that entered your system.	Disbursement: Funds sent from this source to other accounts.	Origin of Funds
Summary for Developers & Users
"The Destination Rule":
Negative Sign (-): Always identifies the ORIGIN (where the money came from).
Positive Sign (+): Always identifies the DESTINATION (where the money went or accumulated).
Integration Example:
If you transfer $50 from your Bank account to the Food category:
Bank is recorded as -$50 (Origin).
Food is recorded as +$50 (Destination/Accumulated Expense).

---
Here is a structured summary of the transfer rules mentioned, categorized into **allowed**, **restricted**, and **overdraft-permitted**:

### **🔒 Transfers WITHOUT Overdraft (Balance ≥ 0 Required)**
1. **From `BANK` → `DEBTOR`** (strictly BANK should not overdraft)
2. **Between same-type accounts**:
   - `INVESTMENT` ↔ `INVESTMENT`
   - `BANK` ↔ `BANK`
3. **Primary accounts to `POCKET`**:
   - `BANK` → `POCKET`
   - `INVESTMENT` → `POCKET`
4. **From `POCKET` to any account** (unless otherwise restricted)
5. **From `BANK` to special accounts**:
   - `BANK` → `CATEGORY_BUDGET`
   - `BANK` → `INVESTMENT`

### **💳 Transfers WITH Overdraft Allowed (Negative Balance Possible)**
1. **From `DEBTOR` → `BANK`** (overdraft permitted in `DEBTOR`)
2. **From `SLACK` to any account** (manual adjustments)
3. **From `INCOME_SOURCE` to any account** (income deposits)

### **🚫 Prohibited Transfers**
1. **From `CATEGORY_BUDGET`**:
   - `CATEGORY_BUDGET` → *Any account* (except `BANK` → `CATEGORY_BUDGET`)
2. **To `INCOME_SOURCE`**:
   - *Any account* → `INCOME_SOURCE` (always blocked)
3. **`DEBT` transactions**:
   - `DEBT` ↔ *Any non-`BANK` account*

### **📌 Key Rules**
- **`POCKET`**: Flexible hub (receives from most accounts, sends anywhere)
- **`BANK`**: Central clearing account for `DEBTOR`, `CATEGORY_BUDGET`, `INVESTMENT`
- **`INCOME_SOURCE`**: Origin-only accounts (cannot receive funds)
- **`SLACK`**: Generally Origin-only accounts (it could receive funds in older versions, not in the recent version)

### **5 Core Design Principles**
1. **Immutability**: Transactions are append-only (reversals require new entries)
2. **Traceability**: Full historical reconstruction capability
3. **Consistency**: ∑(transactions) ≡ current balance (invariant)
4. **Atomicity**: All-or-nothing execution
5. **Constraint Enforcement**: Strict adherence to transfer rules

The system design emphasizes auditability through strict transaction typing and clear invariants.

//---spanish

Aquí tienes un resumen estructurado de las reglas de transferencia que mencionaste, clasificadas en **permitidas**, **restringidas** y **con overdraft permitido**:
### **🔒 Transferencias SIN overdraft permitido (siempre balance ≥ 0):**
1. **De `BANK` → `DEBTOR`** (prohibido sobregirar).  
2. **Transacciones entre cuentas del mismo tipo**:  
   - `INVESTMENT` ↔ `INVESTMENT`  
   - `BANK` ↔ `BANK`  
3. **De cuentas principales a `POCKET`**:  
   - `BANK` → `POCKET`  
   - `INVESTMENT` → `POCKET`  
4. **De `POCKET` a cualquier cuenta** (excepto restricciones posteriores).  
5. **De `BANK` a cuentas especiales**:  
   - `BANK` → `CATEGORY_BUDGET`  
   - `BANK` → `INVESTMENT`  

---

### **💳 Transferencias CON overdraft permitido (balance puede ser negativo):**
1. **De `DEBTOR` → `BANK`** (permite sobregiro en `DEBTOR`).  
2. **De `SLACK` a cualquier cuenta** (ej: ajustes manuales).  
3. **De `INCOME_SOURCE` a cualquier cuenta** (ej: ingresos).  

---

### **🚫 Transferencias PROHIBIDAS (en cualquier caso):**
1. **Desde `CATEGORY_BUDGET`**:  
   - `CATEGORY_BUDGET` → *Cualquier cuenta* (excepto `BANK` → `CATEGORY_BUDGET`, que sí está permitido).  
2. **Hacia `INCOME_SOURCE`**:  
   - *Cualquier cuenta* → `INCOME_SOURCE` (bloqueado en todos los casos).  
3. **Transacciones con `DEBT` (deuda)**:  
   - `DEBT` ↔ *Cualquier cuenta que no sea `BANK`*.  

---

### **📌 Notas clave:**
- **`POCKET`** es flexible: puede recibir de casi cualquier cuenta y enviar a cualquier destino (salvo las prohibiciones generales).  
- **`BANK`** actúa como intermediario permitido para `DEBTOR`, `CATEGORY_BUDGET`, e `INVESTMENT`.  
- **`SLACK` e `INCOME_SOURCE`** son fuentes, no pueden recibir fondos (excepto ingresos externos).  

---

### **Ejemplo de flujo válido:**  
`INCOME_SOURCE` → `BANK` → `INVESTMENT` ✅  

### **Ejemplo de flujo prohibido:**  
`CATEGORY_BUDGET` → `POCKET` ❌  

5. principios de diseño:

Inmutabilidad: Los registros de transacciones no deben modificarse, solo revertirse con transacciones inversas.

Trazabilidad: Cada movimiento debe poder reconstruir su estado exacto en cualquier momento histórico.

Consistencia: Las operaciones deben mantener invariantes como: ∑(transacciones) = balance_actual.

Atomicidad: Cada transferencia debe completarse totalmente o fallar completamente.