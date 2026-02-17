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

### 🚫 3. Prohibited Transfers (Hard Blocks)
Transactions that are logically or architecturally invalid:
*   **From `CATEGORY_BUDGET`**: Cannot send funds to any account (except receiving from `BANK`).
*   **To `INCOME_SOURCE`**: These are **Origin-only** accounts; they can never receive funds.
*   **`DEBT` Transactions**: Cannot interact with any account that is not a `BANK` type.

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
