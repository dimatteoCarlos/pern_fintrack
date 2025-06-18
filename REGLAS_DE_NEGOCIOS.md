BUSINESS RULES

When creating a new account of type: bank, investment, pocket_saving, category_budget, the initial or a starting amount balance will always be 0 or positive (deposit transaction)
When creating a new account of type: income_source, the initial or a starting amount balance will always be 0 (initial-account-opening)
When creating a new account of type: debtor, the initial or a starting amount balance will be the input amount value and the  sigh will depend on the tye transaction type lend (-) or borrow (+) . initial-lend/borrow
---
Here is a structured summary of the transfer rules you mentioned, categorized into **allowed**, **restricted**, and **overdraft-permitted**:

### **🔒 Transfers WITHOUT Overdraft (Balance ≥ 0 Required)**
1. **From `BANK` → `DEBTOR`** (strictly no overdraft)
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
