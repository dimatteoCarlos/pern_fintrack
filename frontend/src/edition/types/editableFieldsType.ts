//frontend/src/edition/types/editableFields.ts

export type AccountType = 
|'bank'
|'income_source'
|'investment'
|'category_budget'
|'debtor'
|'pocket_saving'

export type EditableFieldType = 
|'account_name'
|'debtor_name'
|'debtor_lastname'
|'category_name'
|'subcategory'
|'nature'
|'budget'
|'target'
|'desired_date'
|'note'

export type FieldValidationType ={
  isValid:boolean;
  message?:string;
}

export type EditableFieldConfigType ={
  field:EditableFieldType;
  label:string;
  inputType:'text'|'number'|'date'|'textarea';
  accountTypes:AccountType[];//types which apply

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validation?:(value:any)=>FieldValidationType
}

