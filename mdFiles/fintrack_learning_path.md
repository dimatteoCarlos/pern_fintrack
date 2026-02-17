# Learning Strategy
Apply different approaches to do the same function.

## 📊 Comparative Analysis of Development Approaches

This table contrasts the different methodologies implemented across the project for similar tasks (such as form handling, validation, and data management).

| Level | Technical Approach | Reference Files | Contrast: Native vs. Professional Evolution |
|-------|-------------------|-----------------|---------------------------------------------|
| **1** | **Vanilla / Manual Logic** | `NewAccount.tsx`, `NewProfile.tsx` | **Manual Control**: Every input handler and validation message is managed via individual `useState` hooks. No external libraries are used, ensuring a deep understanding of React's reconciliation. |
| **2** | **Hybrid Architecture** | `Debts.tsx` | **Logic Separation**: Business logic starts moving into custom hooks, but validation remains manual and imperative to maintain granular control over the data flow. |
| **3** | **Advanced Hybrid** | `PnL.tsx` | **Centralized Management**: Introduction of specialized hooks like `useFormManagerPnL`. This centralizes the form lifecycle and handlers, reducing code repetition compared to the "Vanilla" approach. |
| **4** | **Industrial Standard** | `Transfer.tsx` | **Declarative Validation**: Transition to Zod Schemas. Instead of manual if/else checks, the data is validated against a schema contract, and state is managed by a generic `useFormManager`. |
| **5** | **Dynamic / Generic** | `UniversalDynamicInput.tsx` | **Metadata-Driven UI**: The highest level of abstraction. Instead of hard-coded JSX, a single component uses TypeScript Generics to render any input type based on a configuration object. |
| **6** | **Mass Orchestration** | `Overview.tsx` | **Parallel Execution**: Unlike single-fetch components, this uses **Parallel Fetching** to synchronize multiple data streams simultaneously, normalizing complex KPIs for the dashboard. |

---

## 🎨 Visual Evolution Analysis

### 🔄 Complexity vs. Efficiency Progression
```
Complexity:         ▲
                   / \
                  /   \
                 /     \
                /       \
               /         \
Efficiency:   ███       ████
             Level 1   Level 6
```

### 📈 Abstraction Growth
```
Abstraction:  ██████████
              Level 1 → 6
```

---

## 💭 Qualitative Reflections

### 🏗️ **On Architecture:**
- **Levels 1-2**: Like building a house brick by brick
- **Levels 3-4**: Like using blueprints and prefabricated materials  
- **Levels 5-6**: Like designing a smart city infrastructure
