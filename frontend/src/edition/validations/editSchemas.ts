import { z } from "zod";
import { noteSchema, numberSchema, requiredStringSchema } from "../../validations/zod_schemas/commonSchemas";
import { ERROR_MESSAGES } from "../../validations/utils/constants";
// import { AccountListType } from "../../types/responseApiTypes";

// 🎯 1. BASIC EDITION SCHEMA FOR PATCH
export const baseAccountEditSchema = z.object({
 account_name:requiredStringSchema.optional(),
 note:noteSchema.nullable().optional()
})
//Zod infers a static type from your schema definitions. You can extract this type with the z.infer<> utility and use it however you like.
export type BaseAccountEditFormData=z.infer<typeof baseAccountEditSchema>;

// 💰 2.POCKET SAVING SCHEMA
export const pocketSavingEditSchema = baseAccountEditSchema.extend({
 target:z.string().pipe(numberSchema).optional(),
 desired_date:z.string().min(1, ERROR_MESSAGES.FIELD_REQUIRED).transform(str=>new Date(str))
 .refine((date)=>{const today = new Date();today.setHours(0, 0, 0, 0);return (date > today)}, {
  message:ERROR_MESSAGES.INVALID_DATE_FUTURE, 
 }).optional(),
 note: requiredStringSchema.optional(),
 })

export type  PocketSavingEditFormData = z.infer<typeof pocketSavingEditSchema>

// 📊 CATEGORY BUDGET SCHEMA
export const categoryBudgetEditShema = baseAccountEditSchema.extend({
 budget:z.string().pipe(numberSchema).optional(),
 category_name:requiredStringSchema.optional(),
 subcategory:requiredStringSchema.optional(),
 nature_type_name:z.enum(['must', 'need', 'other', 'want']).optional(),
})
export type CategoryBudgetEditFormData = z.infer<typeof categoryBudgetEditShema>

// 👤 DEBTOR ACCOUNT SCHEMA
export const debtorAccountEditSchema =baseAccountEditSchema.extend({
// Hereda: account_name, note
debtor_name:requiredStringSchema.optional(),
debtor_lastname:requiredStringSchema.optional(),

})

export type  DebtorAccountEditFormData= z.infer<typeof debtorAccountEditSchema>

// 🗺️ FINAL SCHEMA MAP: Map account type names (string keys) to their corresponding Zod schema
export const accountTypeEditSchemas:
// {[key in AccountListType['account_type_name']]: z.ZodTypeAny}
{[key: string]: z.ZodTypeAny}
={
bank:baseAccountEditSchema,
investment:baseAccountEditSchema,
income_source:baseAccountEditSchema,
pocket_saving:pocketSavingEditSchema,
category_budget:categoryBudgetEditShema,
debtor:debtorAccountEditSchema,
}











