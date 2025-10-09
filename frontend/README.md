# FinTrack

## Objective

**FinTrack** is a personal finance application built as a "double-entry accounting system", offering a comprehensive and intuitive solution for managing your money.

Its primary goal is to provide users with effective tools to track expenses, incomes, investments, debts and bank accounts; keeping records of the interactions among the different accounts and maintaining all balances updated and reconciled.

As a double-entry accounting system, it automatically reflects the updated balances of all related accounts as soon as a transaction is recorded, ensuring that your financial overview is always accurate and up to date.

FinTrack also helps users monitor savings goals and investments. 🎯📊💡

## Key Features

1. **Expenses and Income**:

   - Detailed tracking of expenses and income.
   - Categorization by categories and dates.

2. **Investment and Debt Management**:

   - Track current investments.
   - Debts records classified in debtors or lenders. 

3. **Account Balance**:

   - View updated balances for all your financial accounts.
   - Compare income and expenses in real-time.

4. **Savings Goals**:

   - Set up personalized savings goals.
   - Monitor progress toward achieving goals.

5. **Investment Projections** (not included in this version):

   - Evaluate investment scenarios based on historical data and future estimates.
   - Analyze long-term financial objectives.

6. **Income Sources**:
   - Record and manage multiple income sources.
   - Clear visualization of contributions to overall balances.

## System Requirements

- Node.js >= 18
- Vite as the development server
- React >= 18.3
- TypeScript

🌐💻📋

## Installation

1. Clone this repository:

   bash
   git clone https://github.com/your-username/fintrack.git
   

2. Navigate to the project directory:

   bash
   cd fintrack
   

3. Install dependencies:
   bash
   npm install
   

📥🛠️🚀

## Available Scripts

- `npm run dev`: Starts the development server.
- `npm run build`: Builds the production version.
- `npm run lint`: Runs the linter to ensure clean code.
- `npm run preview`: Previews the built application.

⚙️✅🔧

## Technologies Used

- **React**: To build the user interface.
- **TypeScript**: To ensure robust and typed code.
- **Vite**: As an ultra-fast bundler and development server.
- **React Router**: To handle navigation.
- **React Select and Datepicker**: To enhance the user experience with interactive components.
- **date-fns**: For date manipulation and formatting.

🖥️📦✨

## Contribution

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a branch for your feature: `git checkout -b new-feature`.
3. Make the changes and commit with descriptive messages.
4. Submit a Pull Request.

🤝📜🛠️

## License

This project is licensed under the terms of the [MIT License](LICENSE). 📄⚖️🆓

---

**FinTrack**: Your intelligent ally for taking control of your personal finances. 💡💼📊

7. **A WORD FOR DEVELOPERS**:
## Overview
For entering the data, FinTrack consists of 9 form pages, each developed with different learning approaches, which will be described as follow:

# FINTRACK FORM ARCHITECTURE: DEBTS.TSX IMPLEMENTATION CUSTOMIZED WITH NO THIRD PARTY LIBRARIES.

## Core Implementation

### Key Structural Blocks
1. **State Management**  
   - Local state for form data (`datatrack`, `formData`)  
   - Validation state (`validationMessages`, `showValidation`)  
   - Global balance state (Zustand)  

2. **Data Flow**  
   - Custom hooks for API calls (`useFetch`, `useFetchLoad`)  
   - Manual validation pipeline (no external validation libraries)  
   - Side effects for validation coordination  

3. **UI Components**  
   - `TopCardZod`: Amount input + debtor selection  
   - `DropDownSelection`: Account picker  
   - `CardNoteSave`: Note field + submit button  

### Validation Approach
- **Custom validation functions**:  
  `validateAmount`, `checkNumberFormatValue`, `validationData`  
- **Two-phase validation**:  
  1. Field-level during input  
  2. Full-form on submission  

### Key Data Flows
mermaid
graph TD
    A[User Input] --> B[Field Validation]
    B --> C[State Update]
    C --> D[Form Submission]
    D -->|Valid| E[API POST]
    D -->|Invalid| F[Error Display]
    E --> G[Global State Update]


## Technical Notes
- **No external validation libraries** used - all validation logic is custom  
- State updates trigger dependent validations through `useEffect`  
- Form reset logic handles both UI and data states  

## Component Relationships
mermaid
graph LR
    UI[Form Components] -->|Events| H[Handlers]
    H --> V[Validation]
    V -->|Errors| UI
    V -->|Valid Data| A[API]
    A --> S[Global State]
    S --> UI


This implementation shows a self-contained validation system integrated with React's state management, using manual checks instead of validation libraries.

# FinTrack Form Architecture: PnL.tsx Implementation with Custom Validation

## Core Implementation

### Key Structural Blocks
1. **State Management**  
   - Local state for form data (`formInputData`, `formValidatedData`)  
   - Validation state (`validationMessages`, `showValidation`)  
   - Global balance state (Zustand via `useBalanceStore`)  

2. **Data Flow**  
   - Custom hooks for API calls (`useFetch`, `useFetchLoad`)  
   - Centralized validation via `useFormManagerPnL` custom hook  
   - Side effects for validation coordination  

3. **UI Components**  
   - `TopCardZod`: Amount input + account selection  
   - `Datepicker`: Date selection component  
   - `CardNoteSave`: Note field + submit button  

### Validation Approach
- **Custom validation hook**: `useFormManagerPnL` handles all validation logic
- **Two-phase validation**:
  1. Field-level validation during input
  2. Full-form validation on submission
- **Zod integration** for schema validation (implied by component names)

### Key Data Flows

```mermaid
graph TD
    A[User Input] --> B[useFormManagerPnL Validation]
    B --> C[State Update]
    C --> D[Form Submission]
    D -->|Valid| E[API POST Transaction]
    D -->|Invalid| F[Error Display]
    E --> G[Global Balance Update]
    E --> H[Form Reset]
```

## Technical Implementation Details

### Form Management
- Custom `useFormManagerPnL` hook centralizes all form state and validation
- Handler factories (`createInputNumberHandler`, `createDropdownHandler`) for consistent input handling
- Type-safe validation with TypeScript interfaces

### API Integration
- Fetches account data for dropdown options
- Posts transaction data to `movement_transaction_record` endpoint
- Updates global balance store after successful transactions

### Component Architecture
- **TopCardZod**: Handles amount input, account selection, and currency selection
- **Datepicker**: Custom date selection component
- **CardNoteSave**: Manages note input and submit functionality

## Component Relationships

```mermaid
graph LR
    UI[Form Components] -->|Events| H[Handlers]
    H --> V[useFormManagerPnL]
    V -->|Validation Results| UI
    V -->|Valid Data| A[API Integration]
    A --> S[Global State Update]
    S --> UI[Form Reset]
```

## Key Features
- Custom validation system without external validation libraries
- Real-time feedback for user inputs
- Automated form reset after successful submission
- Global state synchronization with backend data
- Type-safe throughout with extensive TypeScript interfaces

This implementation demonstrates a robust form handling system with custom validation logic, seamless API integration, and responsive user feedback, all while maintaining type safety and clean component separation.


# FINTRACK FORM ARCHITECTURE: EXPENSE.TSX CASE STUDY (Zod validation)

## Overview
 The `Expense.tsx` component demonstrates an organic evolution pattern that balances reusability with context-specific needs.

## Development Approach
### Evolutionary Pattern

Initial Version (all in component)  
  │  
  ├─→ Extracted Hooks (generic logic)  
  └─→ Ad-hoc Logic (context-specific parts)


### Key Characteristics
1. **Foundational Implementation**:
   - Started with declarative functions solving immediate needs
   - Basic state management and validation built directly in component

2. **Strategic Abstraction**:
   - Custom hooks created for obviously reusable logic:
     - `useFetch`/`useFetchLoad` for API calls
     - `useDebouncedCallback` for validation
   - Component retained:
     - Specialized handlers
     - Data transformation logic
     - UI coordination

## Architectural Flow

mermaid
graph TD
    A[User Input] --> B[Handlers]
    B --> C[Validation]
    C -->|Valid| D[API POST]
    C -->|Invalid| E[Error Feedback]
    D --> F[Global State]
    F --> G[UI Update]
    B -->|Direct Updates| G


## Key Design Decisions

| Feature | Implementation | Rationale |
|---------|---------------|-----------|
| **Typing** | Generics (`<TInput, TValidated>`) | Type safety in handlers |
| **Logic Separation** | Hybrid approach | Balance between reuse and clarity |
| **Optimizations** | `useMemo` + precise `useEffect` | Performance-critical sections |
| **Validation** | Zod schema + debounced checks | Real-time feedback without lag |

## Current State
The component represents a pragmatic hybrid architecture where:
- Reusable logic is properly abstracted
- Context-sensitive operations remain visible
- Data flows are explicitly tracked
- Type safety is enforced throughout
 

This documentation shows how I evolved from a monolithic implementation to a structured yet practical architecture, serving as a reference pattern for other forms in the application.


# FINTRACK: INCOME COMPONENT (ZOD VALIDATION)

## Core Implementation

### Validation Architecture
1. **Zod Integration**
   - Schema definition in `incomeSchema`
   - Type-safe validation with `IncomeValidatedDataType`
   - Used through `useFormManager` hook

2. **Validation Layers**
   ```mermaid
   graph TD
       A[Field Input] --> B[Zod Schema]
       B -->|Valid| C[API Submission]
       B -->|Invalid| D[Error Display]
   ```

### Key Components
| Component | Responsibility | Zod Usage |
|-----------|----------------|-----------|
| `useFormManager` | Central validation handler | Wraps Zod validation |
| `TopCardZod` | Input handling | Uses Zod-validated fields |
| `onSaveHandler` | Submission logic | Calls Zod `validateAll()` |

## Technical Highlights
1. **Hybrid Validation**
   - Zod for schema validation
   - Custom logic for:
     - Conditional field requirements
     - Cross-field validation
     - UI state management

2. **Type Safety**
   ```typescript
   // Zod schema provides type inference
   const { dataValidated } = validateForm(incomeSchema, formData);
   // dataValidated is typed as IncomeValidatedDataType
   ```

## Data Flow
```mermaid
graph LR
    UI[Form] -->|Update| H[useFormManager]
    H -->|Validate| Z[Zod]
    Z -->|Results| UI
    Z -->|Clean Data| A[API]
```

This implementation effectively combines Zod's schema validation with custom form management logic.
//-----------------------------------

# FINTRACK FORM ARCHITECTURE: `TRANSFER.TSX` CASE STUDY

## Overview

The `Transfer.tsx` component is designed to manage asset transfers between different account types. Its architecture demonstrates a structured approach that separates responsibilities and leverages reusable logic.

## Development Approach
### Architectural Pattern

The component implements a **hybrid architecture** that combines a central state management hook with context-specific logic.

Initial Implementation
  │
  ├─→ Extracted Hooks (reusable logic)
  └─→ Ad-hoc Logic (specialized component logic)

### Key Characteristics
1. **Logic Centralization**:
    * Core form logic, including state management and validation, is housed in the custom hook **`useFormManager.ts`**.
    * The `Transfer.tsx` component maintains logic specific to its unique requirements, such as handling account type changes and filtering account options.

2. **Validation with Zod**:
    * The **`transferSchema`** from Zod defines the validation rules for all form fields.
    * The schema includes a custom **`.refine`** method to ensure the origin and destination accounts are not the same.

## Architectural Flow
```mermaid
graph TD
    A[User Input] --> B[Handlers]
    B --> C[Validation via Zod]
    C -->|Valid| D[API POST]
    C -->|Invalid| E[Error Feedback]
    D --> F[Global State Update]
    F --> G[UI Rerender]
    B -->|Direct Updates| G
```

## I would use in the future either PnL.tsx for custom validated approach or Transfer.tsx for zod validation usage.
this was already accomplished, considering different approachs in the sake of learning different techniques.

Theoretically, all the operations of tracking could be performed just using "Transfer" function from tracker menu, with just little adjustments, without the need of the others tracker options.