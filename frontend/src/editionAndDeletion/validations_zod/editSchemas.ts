//frontend/src/editionAndDeletion/validations/editSchemas.ts
import { z } from "zod";
import { ERROR_MESSAGES, DB_MAX_LENGTHS } from "../../validations/utils/constants.ts";
import { noteSchema, numberSchema, optionalButNotEmptySchema } from "./commonEditionSchemas.ts";

// import {
//  noteSchema, numberSchema, requiredStringSchema } from "../../validations/zod_schemas/commonSchemas.ts";

//🎯 1. BASIC EDITION SCHEMA
export const baseAccountEditSchema = z.object({
 account_name:optionalButNotEmptySchema(DB_MAX_LENGTHS.account_name),
 note:noteSchema(DB_MAX_LENGTHS.note)
});

//Zod infers a static type from your schema definitions. You can extract this type with the z.infer<> utility and use it however you like.
export type BaseAccountEditFormData=z.infer<typeof baseAccountEditSchema>;

//💰 2.POCKET SAVING SCHEMA
export const pocketSavingEditSchema = baseAccountEditSchema.extend({
 target:numberSchema.optional(),

//opcion para que acepte ambos tipos de fecha en string o en date.
desired_date: z.union([
z.string().transform(str => new Date(str)), // ← Si viene string, convertir a Date
z.date() // ← Si ya viene Date, dejarlo igual
]) 
.refine((date)=>{
 const today = new Date();
 today.setHours(0, 0, 0, 0);
 return (date > today);}, {
 message:ERROR_MESSAGES.INVALID_DATE_FUTURE, 
}).optional(),
 });

export type  PocketSavingEditFormData = z.infer<typeof pocketSavingEditSchema>;

//📊 3. CATEGORY BUDGET SCHEMA
export const categoryBudgetEditShema = baseAccountEditSchema.extend({
 budget:numberSchema.optional(),
//strict limits
 category_name:optionalButNotEmptySchema(DB_MAX_LENGTHS.category_name),
 subcategory:optionalButNotEmptySchema(DB_MAX_LENGTHS.subcategory),
 category_nature_type_name:z.enum(['must', 'need', 'other', 'want']).optional(),
// Being a derivative field, can be optional so Zod won't blok it while computing / Al ser un campo DERIVADO, permitimos que sea opcional en el esquema 
// para que Zod no bloquee el estado mientras el motor 'compute' está trabajando.
 account_name: optionalButNotEmptySchema(DB_MAX_LENGTHS.account_name),
});

export type CategoryBudgetEditFormData = z.infer<typeof categoryBudgetEditShema>;

//👤 4. DEBTOR ACCOUNT SCHEMA
export const debtorAccountEditSchema =baseAccountEditSchema.extend({
// Hereda: account_name, note
debtor_name:optionalButNotEmptySchema(DB_MAX_LENGTHS.debtor_name),
debtor_lastname:optionalButNotEmptySchema(DB_MAX_LENGTHS.debtor_lastname),
account_name: optionalButNotEmptySchema(DB_MAX_LENGTHS.account_name),
});

export type  DebtorAccountEditFormData= z.infer<typeof debtorAccountEditSchema>;

// 🗺️ FINAL SCHEMA MAP: Map account type names (string keys) to their corresponding Zod schema
export const accountTypeEditSchemas:
// {[key in AccountListType['account_type_name']]: z.ZodTypeAny}
Record<string, z.ZodObject<Record<string, z.ZodTypeAny>>>
={
bank:baseAccountEditSchema,
investment:baseAccountEditSchema,
income_source:baseAccountEditSchema,
pocket_saving:pocketSavingEditSchema,
category_budget:categoryBudgetEditShema,
debtor:debtorAccountEditSchema,
};

