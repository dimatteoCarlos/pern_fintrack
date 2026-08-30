//frontend/src/editionAndDeletion/validations/editSchemas.ts
import { z } from 'zod';
import { DB_MAX_LENGTHS } from '../../validations/utils/constants.ts';
import {
  noteSchema,
  optionalButNotEmptySchema,
} from './commonEditionSchemas.ts';

// import {
//  noteSchema, numberSchema, requiredStringSchema } from "../../validations/zod_schemas/commonSchemas.ts";

//🎯 1. BASIC EDITION SCHEMA
export const baseAccountEditSchema = z.object({
  account_name: optionalButNotEmptySchema(DB_MAX_LENGTHS.account_name),
  note: noteSchema(DB_MAX_LENGTHS.note),
});

//Zod infers a static type from your schema definitions. You can extract this type with the z.infer<> utility and use it however you like.
export type BaseAccountEditFormData = z.infer<typeof baseAccountEditSchema>;

// Smallest amount the server can store: it rounds to two decimals, so 0.004
// becomes 0.00 and is rejected. Mirrors MINIMUM_AMOUNT in core/money.js.
// Unused while categoryBudgetEditShema's budget key stays commented (D13) —
// left in place because the value it describes is not this schema's to drop.
// const MINIMUM_BUDGET_AMOUNT = 0.01;

//📊 3. CATEGORY BUDGET SCHEMA
export const categoryBudgetEditShema = baseAccountEditSchema.extend({
  // Replaced by the budget block EditAccount.tsx renders below the form,
  // which writes through PUT /budget/accounts/:accountId/current instead of
  // this PATCH (PLAN_EditAccount.md, unit U1). Commented rather than deleted
  // until the cleanup block removes it (D13); accountEditSchema.ts's field
  // config was commented out to match, so no form ever asks for this key.
  // budget: numberSchema.refine((amount) => amount >= MINIMUM_BUDGET_AMOUNT, {
  //   message: `* Budget must be at least ${MINIMUM_BUDGET_AMOUNT}`,
  // }),
  //strict limits
  category_name: optionalButNotEmptySchema(DB_MAX_LENGTHS.category_name),
  subcategory: optionalButNotEmptySchema(DB_MAX_LENGTHS.subcategory),
  category_nature_type_name: z
    .enum(['must', 'need', 'other', 'want'])
    .optional(),
  // Being a derivative field, can be optional so Zod won't blok it while computing / Al ser un campo DERIVADO, permitimos que sea opcional en el esquema
  // para que Zod no bloquee el estado mientras el motor 'compute' está trabajando.
  account_name: optionalButNotEmptySchema(DB_MAX_LENGTHS.account_name),
});

export type CategoryBudgetEditFormData = z.infer<
  typeof categoryBudgetEditShema
>;

//👤 4. DEBTOR ACCOUNT SCHEMA
export const debtorAccountEditSchema = baseAccountEditSchema.extend({
  // Hereda: account_name, note
  debtor_name: optionalButNotEmptySchema(DB_MAX_LENGTHS.debtor_name),
  debtor_lastname: optionalButNotEmptySchema(DB_MAX_LENGTHS.debtor_lastname),
  account_name: optionalButNotEmptySchema(DB_MAX_LENGTHS.account_name),
});

export type DebtorAccountEditFormData = z.infer<typeof debtorAccountEditSchema>;

// 🗺️ FINAL SCHEMA MAP: Map account type names (string keys) to their corresponding Zod schema
export const accountTypeEditSchemas: // {[key in AccountListType['account_type_name']]: z.ZodTypeAny}
Record<string, z.ZodObject<Record<string, z.ZodTypeAny>>> = {
  bank: baseAccountEditSchema,
  investment: baseAccountEditSchema,
  income_source: baseAccountEditSchema,
  category_budget: categoryBudgetEditShema,
  debtor: debtorAccountEditSchema,
};
