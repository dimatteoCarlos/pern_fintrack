  ACCOUNT_OPTIONS_DEFAULT, para category_budget account
  const initialMovementData: MovementInputDataType = {
  amount: "",
  origin: '',
  destination: '',

  originAccountId: undefined,
  destinationAccountId: undefined,

  note: '',
  currency: defaultCurrency,

  originAccountType: 'bank',
  destinationAccountType: 'investment',
};

const inputRadioOptionsAccountType:{value:TransferAccountType, label:string}[] = [
  { value: 'bank', label: 'Bank' },
  { value: 'investment', label: 'Invest' },
  { value: 'pocket', label: 'Pocket' },
  { value: 'reverseExpense', label: 'Rev.Exp' },
  { value: 'reverseIncome', label: 'Rev.Income },
];
minimo ancho de la ui 357 px, Reducir el labela a RvEx o RE, y RI, 
y colocarloes tooltip
const originAccountTypeFromDb: "bank" | "investment" | "pocket_saving"
INCLUIR category_budget income_source
si RE para cb y RI para is

originAccountType: "bank" | "investment"

originAccountTypeFromDb: "bank" | "investment" | "pocket_saving"

destinationAccTypeDb: "bank" | "investment" | "pocket_saving"

  const destinationAccTypeDb =
    formData.destinationAccountType === 'pocket'
      ? 'pocket_saving'
      : formData.destinationAccountType;

BACKEND

