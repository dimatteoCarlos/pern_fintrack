Aquí tienes un resumen estructurado de las reglas de transferencia que mencionaste, clasificadas en **permitidas**, **restringidas** y **con overdraft permitido**:

---

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

