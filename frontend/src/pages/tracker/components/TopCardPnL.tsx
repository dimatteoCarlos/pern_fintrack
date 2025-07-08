import CurrencyBadge from '../../../general_components/currencyBadge/CurrencyBadge';
import DropDownSelection from '../../../general_components/dropdownSelection/DropDownSelection';
import LabelNumberValidation from '../../../general_components/labelNumberValidation/LabelNumberValidation';
import RadioInput from '../../../general_components/radioInput/RadioInput';
import { capitalize } from '../../../helpers/functions';
import { AccountListType } from '../../../types/responseApiTypes';
// import { AccountListType } from '../../../types/responseApiTypes';
import {
  CurrencyType,
  DropdownOptionType,
  TopCardElementsType,
  // VariantType,
  // TopCardElementsType
} from '../../../types/types';

//-------------------------------
type RadioInputPropsType = {
  radioOptionSelected: string;

  inputRadioOptions: { value: string; label: string }[];

  setRadioOptionSelected: (option: string) => void;

  disabled:boolean;

  title?: string;

};

type TopCardPropType<T extends Record<string, unknown>> = {
  topCardElements: TopCardElementsType

  validationMessages: { [key: string]: string };

  updateTrackerData: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;

  trackerName: string;
  updateCurrency: (x: CurrencyType) => void;
  currency: CurrencyType;

  // selectedValue?: string;
  setSelectState: React.Dispatch<React.SetStateAction<T>>; //generic type

  isReset: boolean;
  setIsReset: React.Dispatch<React.SetStateAction<boolean>>;
  //-----
  isResetDropdown?: boolean;
  setIsResetDropdown?: React.Dispatch<React.SetStateAction<boolean>>;

  radioInputProps?: RadioInputPropsType;

  //--handle special case of Transfer
  customSelectHandler?: (selectedOption: DropdownOptionType | null) => void;
};

//----Component
const TopCard = <T extends Record<string, unknown>>({
  topCardElements,
  validationMessages,
  updateTrackerData,
  trackerName,
  currency,
  updateCurrency,
  // selectedValue,
  setSelectState,
  isReset,
  setIsReset,
  //-------
  isResetDropdown,
  setIsResetDropdown,
  //-------
  radioInputProps,
  //-------
  customSelectHandler,
}: TopCardPropType<T>): JSX.Element => {
  const {
    selectOptions: topCardOptions,
    selectOptions: { variant },
    titles: { title1 }, //amount label or title
    titles: { title2 }, //account label or title
    titles: { label2 }, //account label or title
    value, //amount input value
    accountsListInfo
  } = topCardElements;

  // console.log('🚀 ~ title2:', title2.trim().toLowerCase());
  //------------------------
  //selection handler fn
  function stateSelectHandler(selectedOption: DropdownOptionType | null) {
   // get the account_id of the selected account_name. it supposes thet account_name is unique too.
  //declare function  
  function getAccountSelectedInfo (accountNameSelected:string):AccountListType | {
    account_type_name: string;
}{
  const accounts= (accountsListInfo?.filter((account)=>account.account_name.toLowerCase().trim() == accountNameSelected.toLowerCase().trim()))

  if(accounts && accounts.length>1){console.warn(`There are more than one account with the name ${accountNameSelected} `) ;return accounts[0]}

  if(!accounts || accounts.length===0){console.warn(`No account were found with the name ${accountNameSelected}`);return {account_type_name:''//'account type not found'
    }}

  return accounts[0]
}
    
  if(selectedOption){
      const typeNameOfSelectedAccount = getAccountSelectedInfo(selectedOption.value).account_type_name

      setSelectState((prev) => ({
        ...prev,
        accountType: typeNameOfSelectedAccount,
      }));
  }

  setSelectState((prev) => ({
    ...prev,
    [title2.trim().toLowerCase()]: selectedOption?.value,
  }));

  }

  //usage of customSelectHandler if it exists
  const finalSelectHandler = customSelectHandler || stateSelectHandler;

  // console.log('isResetDropdown', { isResetDropdown });
  //-------------------------------------------
  return (
    <>
      <div className='state__card--top  '>
        <LabelNumberValidation
          formDataNumber={{ keyName: title1, title: title1 }}
          validationMessages={validationMessages}
          variant={variant}
        />

        <div className='card__screen'>
          <input
            className='inputNumber'
            name={title1}
            type='text'
            placeholder={trackerName}
            value={value} //amountValue
            onChange={updateTrackerData} //onAmountChange
          />

          <CurrencyBadge
            variant={variant}
            updateOutsideCurrencyData={updateCurrency}
            currency={currency}
          />
        </div>

        <div className='account card--title '>
          {capitalize(label2??title2).trim()}
          

          {radioInputProps && (
            <RadioInput
              radioOptionSelected={radioInputProps.radioOptionSelected}
              inputRadioOptions={radioInputProps.inputRadioOptions}
              setRadioOptionSelected={radioInputProps.setRadioOptionSelected}
              title={radioInputProps.title}
              labelId={title2.trim()}
              disabled={radioInputProps.disabled}
              // disabled={radioInputProps.disabled}
            />
          )}
        </div>

        <span className='validation__errMsg '>
          {validationMessages[`${title2.toLowerCase().trim()}`]}
        </span>

        <DropDownSelection
          dropDownOptions={topCardOptions}
          updateOptionHandler={finalSelectHandler}
          setIsReset={setIsReset}
          isReset={isReset}
          setIsResetDropdown={setIsResetDropdown}
          isResetDropdown={isResetDropdown}
          // isReset={isReset || isResetDropdown }
        />
      </div>
    </>
  );
};

export default TopCard;
