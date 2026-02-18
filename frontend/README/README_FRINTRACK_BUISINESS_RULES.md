# 🏦 FinTrack App: Business Rules & Financial Architecture

This document defines the strict logic governing account creation, fund transfers, and the architectural principles that ensure the financial integrity of the **FinTrack** system.

---

## 💎 Account Initialization Rules

The system enforces specific behaviors based on the account type at the moment of creation:

| Account Type | Initial Balance Rule | Transaction Type |
| :--- | :--- | :--- |
| `bank`, `investment`, `pocket_saving`, `category_budget` | Must be **0 or positive**. | `deposit` |
| `income_source` | Always starts at **0**. | `initial-account-opening` |
| `debtor` | Based on input value; sign depends on logic. | `lend` (-) or `borrow` (+) |

---

## 🔄 Transfer Matrix (System Invariants)

To prevent financial inconsistencies, the system classifies every transfer into one of three categories:

### 🔒 1. Transfers WITHOUT Overdraft (Balance ≥ 0 Required)
These accounts must have sufficient funds to complete the transaction:
*   **From `BANK` → `DEBTOR`**: Strictly prohibited to overdraft the Bank account.
*   **Same-type transfers**: `INVESTMENT` ↔ `INVESTMENT` or `BANK` ↔ `BANK`.
*   **Primary to Hub**: `BANK` → `POCKET` or `INVESTMENT` → `POCKET`.
*   **Special Assignments**: `BANK` → `CATEGORY_BUDGET` or `BANK` → `INVESTMENT`.
*   **From `POCKET`**: Can send to any account (unless explicitly restricted).

### 💳 2. Transfers WITH Overdraft Allowed (Negative Balance Possible)
Accounts that represent external sources, manual adjustments, or obligations:
*   **From `DEBTOR` → `BANK`**: Permits the debtor account to reflect a negative state.
*   **From `SLACK` → Any account**: Used for manual adjustments and balancing.
*   **From `INCOME_SOURCE` → Any account**: Primary origin for incoming deposits.

### 🚫 3. Prohibited Transfers (Hard Blocks) (**NOTE**)
Transactions that are logically or architecturally invalid:
*   **From `CATEGORY_BUDGET`**: Cannot send funds to any account (except receiving from `BANK`).
*   **To `INCOME_SOURCE`**: These are **Origin-only** accounts; they can never receive funds.
*   **`DEBT` Transactions**: Cannot interact with any account that is not a `BANK` type.

### ** NOTE **
### Transaction Reversals (Corrections)

A functionality has been implemented to permit the reversal of transactions in **Income Source** (`income_source`) and **Budget Category Expenses** (`category_budget`) account types.

#### Purpose
The flow of transactions between these account types is restricted by the system to maintain financial tracking. This provision allows for manual adjustments in cases of registration errors, enabling the correction of information while maintaining system logic.

#### Features:
*   **Flow Management:** Allows the bypass of transfer restrictions to execute corrective movements.
*   **Balance Adjustment:** Upon execution of a reversal, the system adjusts the balances of the involved accounts (origin and destination) to reflect the state after the correction.
*   **Data Consistency:** Designed to address data entry errors, allowing the transaction history to align with the recorded movements.

---

## 📌 Role of Specialized Accounts

*   **`POCKET`**: The flexible hub. It acts as a bridge between most accounts.
*   **`BANK`**: The central clearing account. It is the mandatory intermediary for `DEBTOR`, `CATEGORY_BUDGET`, and `INVESTMENT` operations.
*   **`INCOME_SOURCE` & `SLACK`**: Source-only accounts. They exist to inject value into the system (External Income or Manual Adjustments).

---

## ⚖️ Core Design Principles

The FinTrack engine is built upon five non-negotiable principles:

1.  **Immutability**: Transactions are append-only records. Errors are corrected via reversal entries, never by editing historical data.

2.  **Traceability**: Every movement is logged with enough metadata to reconstruct the entire financial history at any specific timestamp.

3.  **Consistency**: The "Balance Invariant" must always hold: **∑(all_transactions) ≡ Current Balance**.

4.  **Atomicity**: Transfers involving multiple accounts follow the "all-or-nothing" rule (Database ACID properties).

5.  **Constraint Enforcement**: The application layer strictly validates the Transfer Matrix before committing any transaction to the ledger.

---

## 📖 Example Flows

*   **Valid Flow ✅**: `INCOME_SOURCE` → `BANK` → `INVESTMENT`  
*   **Invalid Flow ❌**: `CATEGORY_BUDGET` → `POCKET` (Violates Category Budget lock)
*   **Invalid Flow ❌**: `BANK` → `INCOME_SOURCE` (Violates Origin-only rule)

# TRANSACTION DIRECTIONS AND ACCOUNT LOGIC

This document outlines the directional cash-flow logic used in this system. Our approach prioritizes the **physical movement of money** over traditional debit/credit accounting conventions to provide a clearer perspective for the user.

---

## 1. Transaction Directions

In any account, the plus ($+$) and minus ($-$) symbols in a transaction description indicate the **direction** of funds relative to that specific account.

*   **Positive sign (+):** Represents a **Cash Inflow** (Deposit/Credit). Money has been added to the balance.
*   **Negative sign (-):** Represents a **Cash Outflow** (Withdrawal/Debit/Disbursement). The account has disbursed funds.

> **Perspective Note:** The transaction description always reflects the direction of funds from the perspective of the specific account holder.

---

## 2. Understanding Account Balances

The meaning of a balance changes depending on the **Account Type**.

### Bank and Investment Accounts
These represent the net position of funds.
*   **Positive (+):** Indicates a **Surplus** (credit balance or growth).
*   **Negative (-):** Indicates a **Deficit** (bank overdraft or investment shortfall).

### Income Source Accounts
*   **Negative (-):** Indicates that disbursements have been made. These outflows are reflected as credits (deposits) in the respective destination accounts.

### Debtor Account Type
This type tracks money owed to or by people (e.g., "John Doe"). It prioritizes the physical path of the money:
*   **Negative (-):** The account has provided funds. This represents an **Account Payable** (we owe them).
*   **Positive (+):** The account has received funds. This represents an **Account Receivable** (they owe us).

#### Practical Examples for Debtor Accounts:

| Case | Transaction | Entry | Meaning |
| :--- | :--- | :--- | :--- |
| **Negative Balance** | John Doe pays $500 for a company expense. | `-$500.00` | Money left John's pocket. We owe him (Payable). |
| **Positive Balance** | The company gives John Doe a $200 advance. | `+$200.00` | Money entered John's account. He owes us (Receivable). |

---

## 3. Category / Budget Accounts (Expense Tracking)

Budget accounts act as **"cost containers."** They track the total amount of money that has flowed into a specific expense.

*   **Positive Balance (+):** Represents **Accumulated Spending**. When you spend money, it "enters" the category.
*   **The Logic:** A $(+)$ sign here does not mean extra cash; it means you have consumed that amount of value in that category.

### Cash Flow Example:
If you spend $100 on Gas using your Bank Account:
*   **Bank Account:** `-$100.00` (Money left your bank).
*   **Gas (Budget):** `+$100.00` (Money accumulated in Gas expense).

---

## 4. Reference Guide: Cash Flow & Balance Logic

| Account Type | Positive Sign (+) | Negative Sign (-) | Account Concept |
| :--- | :--- | :--- | :--- |
| **Bank / Cash** | **Surplus:** Available funds. | **Deficit:** Overdraft. | Deposits vs. Withdrawals |
| **Investment** | **Gain / Deposit:** Value increase. | **Loss / Withdrawal:** Value decrease. | Capital Performance |
| **Debtor (Person)** | **Receivable:** You lent money. | **Payable:** You owe them. | Loans & Debts |
| **Budget (Expense)** | **Accumulated Expense:** Total spent. | **Refund:** Money returned to budget. | Cost Accumulator |
| **Income (Source)** | **Income Received:** Funds entered system. | **Disbursement:** Funds sent to others. | Origin of Funds |

---

## 5. Summary for Developers & Users

### "The Destination Rule"
*   **Negative Sign (-):** Always identifies the **ORIGIN** (where the money came from).
*   **Positive Sign (+):** Always identifies the **DESTINATION** (where the money went or accumulated).

**Integration Example:**
If you transfer $50 from your Bank account to the Food category:
1.  **Bank** is recorded as `-$50` (Origin).
2.  **Food** is recorded as `+$50` (Destination/Accumulated Expense).

---
*Reference logic based on directional flow principles, similar to resources found on [AccountingCoach](https://www.accountingcoach.com).*
