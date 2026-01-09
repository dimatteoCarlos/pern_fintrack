//frontend/src/edition/validations/accountEditSchema.ts
//Define which editable fields to render, for each account type.  
// 🎯Basic structure for each field
import { 
 BaseAccountEditFormData, CategoryBudgetEditFormData, DebtorAccountEditFormData, PocketSavingEditFormData } from './editSchemas';
import { AccountListType } from '../../types/responseApiTypes';
// import { capitalize } from '../../helpers/functions';
// 🎯 1.MAPPING FIELDS TO RENDER
//combine all possible FieldNames of all edition schemas
export type FieldConfigType = {
 fieldName: keyof (BaseAccountEditFormData & CategoryBudgetEditFormData & PocketSavingEditFormData & DebtorAccountEditFormData);
 label: string;
 inputType: 'text' | 'number' | 'textarea' | 'select' | 'date'; 
 isEditable: boolean; // false = ReadOnly (at first, field could be editable though)
 isRequired: boolean; // for Zod, it must be validated and not null
 placeholder?: string;
 options?: { value: string; label: string }[]; 
 helpText?: string;
// CRÍTICAL: Indicates if field changes trigger complex logic as recalculation /Indica si el cambio en este campo dispara lógica compleja (ej. recálculo)
 isCritical?: boolean; 
 // isDerived: build field from others and ReadOnly in the UI / Indica que el campo se construye a partir de otros (ej. account_name de debtor) y es ReadOnly en la UI
 isDerived?: boolean; 
//compute receives the state and returns a calculated value
 compute?:(data:Record<string,unknown>)=>string;
}

// 🎯 2.MAIN CONFIGURATION: Mapping the Account Type to its Fields / Mapeo del Tipo de Cuenta a sus Campos
export type AccountSchemaConfigType = {
// 'string' covers all account types (bank, debtor, etc.)
// [accountType: string]: FieldConfigType[];
[key in AccountListType['account_type_name']]: FieldConfigType[];
};

// 🎯 3. DYNAMIC CONFIG MAP / EL MAPA DE CONFIGURACIÓN DINÁMICA
export const basicAccountConfig:FieldConfigType[] = [
// base for bank, investment and income_source
  {
   fieldName: 'account_name',
   label: 'Account Name',
   inputType: 'text',
   isEditable: true,
   isRequired: true,
   placeholder: 'Account Name',
    },
  {
   fieldName: 'note',
   label: 'Note',
   inputType: 'textarea',
   isEditable: true,
   isRequired: false,
   placeholder: 'Add any relevant note (max 150 chars)',
  },
 ]
//=====================================
export const ACCOUNT_EDIT_SCHEMA_CONFIG: AccountSchemaConfigType = {
// 🏦 Basic Types / Tipos Simples (bank, investment, income_source)
 bank: basicAccountConfig,
 investment: [ // Reutiliza la configuración base
     ...basicAccountConfig
 ],
 income_source: [ // Reutiliza la configuración base
     ...basicAccountConfig
 ],

// 📊 Category Budget
 category_budget: [
 {   
  fieldName: 'account_name',
  label: 'Account Name',
  inputType: 'text',
  isEditable: false,
  isRequired: true,
  placeholder: 'Account Name',
  isDerived: true, // Calculated Field from category/nature/subcategory
  helpText: 'Generated from Category, Subcategory and Nature.',
  compute:(data:Record<string,unknown>)=>{
   const name = String(data.category_name || '');
   const subcat = data.subcategory?`/${data.subcategory}`:'';
   const nature = data.category_nature_type_name ? `/${data.category_nature_type_name}`:'';
   
   return `${name}${subcat}${nature}`.trim();
  }
   },

 {   
    fieldName: 'budget',
    label: 'Monthly Budget Amount',
    inputType: 'number',//
    isEditable: true,
    isRequired: true,
    placeholder: 'Amount',
    helpText: 'Changing this will update the remaining amount.',
    isCritical: true, //
   },

  {
    fieldName: 'category_name',
    label: 'Category Name',
    inputType: 'text',
    isEditable: true,
    isRequired: true,
    placeholder: 'e.g., Food',
   },

   {
    fieldName: 'subcategory',
    label: 'Subcategory',
    inputType: 'text',
    isEditable: true,
    isRequired: false,
    placeholder: 'e.g., Cheddar',
   },

   {
    fieldName: 'category_nature_type_name', 
    label: 'Nature of Expense',
    inputType: 'select',
    isEditable: true,
    isRequired: true,
    options: [
        { value: 'must', label: 'Must' },
        { value: 'need', label: 'Need' },
        { value: 'want', label: 'Want' },
        { value: 'other', label: 'Other' },
    ],
   },

   {
    fieldName: 'note',
    label: 'Notes',
    inputType: 'textarea',
    isEditable: true,
    isRequired: false,
    placeholder: 'Max 150 chars',
   },
 ],
 
// 💰 Pocket Saving
 pocket_saving: [
     {
      fieldName: 'account_name',
      label: 'Pocket Name',
      inputType: 'text',
      isEditable: true,
      isRequired: true,
      placeholder: 'e.g., Vacation Fund',
     },
     {
      fieldName: 'target',
      label: 'Savings Goal Amount',
      inputType: 'number',
      isEditable: true,
      isRequired: true,
     //  placeholder: '0.00',
      helpText: 'Changing this will update the progress percentage.',
      isCritical: true,
     },
     {
      fieldName: 'desired_date',
      label: 'Target Completion Date',
      inputType: 'date',
      isEditable: true,
      isRequired: true,
      helpText: 'Must be a future date.',
      isCritical: true, 
     },
     {
      fieldName: 'note',
      label: 'Note',
      inputType: 'textarea',
      isEditable: true,
      isRequired: true,
      placeholder: 'Max 150 chars',
     },
  ],

 // 👤 Debtor
 debtor: [
  {
   fieldName: 'debtor_name',
   label: 'Name',
   inputType: 'text',
   isEditable: true,
   isRequired: true,
   placeholder: 'e.g., John',
   isCritical: true, // El cambio dispara la actualización de account_name
    },
    
  {
  fieldName: 'debtor_lastname',
  label: 'LastName',
  inputType: 'text',
  isEditable: true,
  isRequired: true,
  placeholder: 'e.g., Doe',
  isCritical: true, // El cambio dispara la actualización de account_name
 },

 {
  fieldName: 'account_name',
  label: 'Account Name',
  inputType: 'text',
  isEditable: false, // Read-Only
  isRequired: false,
  isDerived: true, // Calculated field (Name + LastName)
  helpText: 'Generated from Debtor Name and Lastname.',
  compute:(data:Record<string,unknown>)=>{
   const name = String(data.debtor_name?data.debtor_name:'');
   const lastname= String(data.debtor_lastname!);
   return `${lastname} ${name}`.trim();
   // return `${capitalize(String(lastname))} ${capitalize(String(name))}`
  }

 },
 {
  fieldName: 'note',
  label: 'Notes',
  inputType: 'textarea',
  isEditable: true,
  isRequired: false,
  placeholder: 'Max 150 chars',
  },
 ],
};



