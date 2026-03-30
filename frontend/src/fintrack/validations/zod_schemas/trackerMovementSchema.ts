//src/validations/schemas/expenseSchema.ts
import {z} from 'zod'
import { currencySchema, noteSchema, numberSchema, requiredStringSchema } from './commonSchemas'
//zod schema validation for ExpenseInputDataType
//amount, account, category, note, currency

// Expense schema
export const expenseSchema = z.object(
 {
  amount:numberSchema,
  account:requiredStringSchema,
  category:requiredStringSchema,
  note:noteSchema,
  currency:currencySchema,
  });

// Income schema
export const incomeSchema = z.object(
 {
  amount:numberSchema,
  account:requiredStringSchema,
  source:requiredStringSchema,
  note:noteSchema,
  currency:currencySchema,
  }
  );

//Transfer schema
export const transferSchema = z.object({
  amount: numberSchema,
  origin: requiredStringSchema,
  destination: requiredStringSchema,
  originAccountType: z.enum(['bank', 'investment', 'pocket','category_budget']),
  destinationAccountType: z.enum(['bank', 'investment', 'pocket', 'income_source']),
  note: noteSchema,
  currency: currencySchema
}).refine(
  data => {
    // Solo validar si ambos campos tienen valores
    if (!data.origin || !data.destination) return true;
    return data.origin !== data.destination;
  },
  {
    message: "Accounts must be different",
    path: ["destination"] // Por defecto mostrar en destination
  }
)
.refine(
  data => {
    // Lógica para determinar dónde mostrar el error
    if (!data.origin || !data.destination) return true;
    
    // Si origin es válido pero destination es igual, mostrar error en destination
    if (data.origin && data.origin === data.destination) {
      return { message: "Accounts must be different", path: ["destination"] };
    }
    
    // Si destination es válido pero origin es igual, mostrar error en origin
    if (data.destination && data.destination === data.origin) {
      return { message: "Accounts must be different", path: ["origin"] };
    }
    
    return true;
  }
)
  
