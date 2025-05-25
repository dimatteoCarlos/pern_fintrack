import { useEffect, useState } from 'react';
import LeftArrowSvg from '../../../assets/LeftArrowSvg.svg';
import TopWhiteSpace from '../../../general_components/topWhiteSpace/TopWhiteSpace.tsx';

import { Link } from 'react-router-dom';
import FormSubmitBtn from '../../../general_components/formSubmitBtn/FormSubmitBtn.tsx';
import { validationData } from '../../../helpers/functions.ts';
import '../styles/forms-styles.css';
import useInputNumberHandler from '../../../hooks/useInputNumberHandler.tsx';
import { CurrencyType, FormNumberInputType } from '../../../types/types.ts';
import LabelNumberValidation from '../../../general_components/labelNumberValidation/LabelNumberValidation.tsx';
import { TILE_LABELS, VARIANT_FORM } from '../../../helpers/constants.ts';
import { useFetchLoad } from '../../../hooks/useFetchLoad.tsx';
import { url_create_category_budget_account } from '../../../endpoints.ts';
import { CreateCategoryBudgetAccountApiResponseType } from '../../../types/responseApiTypes.ts';
import { MessageToUser } from '../../../general_components/messageToUser/MessageToUser.tsx';
// import PlusSignSvg from '../../../assets/PlusSignSvg.svg';
// import { useLocation } from 'react-router-dom';

//----Category Nature Tiles---------------
const tileTitle = 'Category Nature';
//-------data config---------------------------------------
type CategoryDataType = {
  category: string;
  subcategory: string;
  amount: number | '';
  nature: string;
  currency?: CurrencyType;
};

type CategoryBudgetPayloadType = {
  name: string;
  type: 'category_budget';
  currency: CurrencyType;
  budget: number | string;
  date: Date | string;
  nature: string;
  subcategory?: string;
  user: string;
};

const initialNewCategoryData: CategoryDataType = {
  category: '',
  subcategory: '',
  amount: '',
  nature: '',
};
const formDataNumber = { keyName: 'amount', title: 'budget' };
const initialFormData: FormNumberInputType = {
  [formDataNumber.keyName]: '',
};
//------------------------
function NewCategory() {
  //get userId from stores
  // const user = useUserStore((state: UserStoreType) => state.userData.userId);
  const user: string = import.meta.env.VITE_USER_ID;
  // console.log(' usuario frontend:', user);

  //---states------
  const [formData, setFormData] =
    useState<FormNumberInputType>(initialFormData);

  const [categoryData, setCategoryData] = useState<CategoryDataType>(
    initialNewCategoryData
  );
  const [activeNature, setActiveNature] = useState(
    initialNewCategoryData.nature
  );
  const [validationMessages, setValidationMessages] = useState<{
    [key: string]: string;
  }>({});

  const [messageToUser, setMessageToUser] = useState<string | null | undefined>(
    null
  );

  //endpoint: http://localhost:5000/api/fintrack/account/new_account/category_budget
  //------------------------------------------------
  //DATA FETCHING

  //POST: NEW ACCOUNT DATA
  const { data, isLoading, error, requestFn } = useFetchLoad<
    CreateCategoryBudgetAccountApiResponseType,
    CategoryBudgetPayloadType
  >({ url: url_create_category_budget_account, method: 'POST' });

  //--------------------------------------
  //functions
  const { inputNumberHandlerFn } = useInputNumberHandler(
    setFormData,
    setValidationMessages,
    setCategoryData
  );
  //---------
  function inputHandler(e: React.ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    const { name, value } = e.target;
    if (name === formDataNumber.keyName) {
      inputNumberHandlerFn(name, value);
    } else {
      setCategoryData((prev) => ({ ...prev, [name]: value }));
    }
  }
  //---------
  // function addHandler(e: React.MouseEvent<HTMLButtonElement>) {
  //   e.preventDefault();
  //   //adding function
  //   console.log('addHandler subcategory method PENDING to define');
  // }
  //---------
  function natureHandler(e: React.MouseEvent<HTMLButtonElement>) {
    // console.log('natureHandler', e.currentTarget.id);
    e.preventDefault();
    const activeNature = e.currentTarget.id ? e.currentTarget.id : '';
    setActiveNature(activeNature);
    setCategoryData((prev) => ({ ...prev, nature: activeNature }));
  }
  //---------
  async function onSubmitForm(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    console.log('onSubmitForm');
    //--data form validation
    const newValidationMessages = validationData(categoryData);
    // const newValidationMessages = { ...validationData(categoryData) };// console.log('mensajes:', { newValidationMessages });

    if (Object.values(newValidationMessages).length > 0) {
      setValidationMessages(newValidationMessages);
      return;
    }
    //----------------------------------------
    //POST TO THE ENDPOINT FOR ACCOUNT DATA HERE
    // new category data into database
    // console.log(
    //   'check this:',
    //   formData,
    //   formDataNumber,
    //   formDataNumber.keyName,
    //   categoryData.amount
    // );
    try {
      const payload: CategoryBudgetPayloadType = {
        name: categoryData.category.toLowerCase().trim(),
        type: 'category_budget',
        currency: 'usd', //by default
        budget: formData.amount || categoryData.amount,
        date: new Date().toISOString(), // ISO format
        nature: categoryData.nature,
        subcategory: categoryData.subcategory || undefined,
        user,
      };

      const data = await requestFn(payload);

      if (import.meta.env.VITE_ENVIRONMENT === 'development') {
        console.log('Data from New Category request:', data);
      }

      //-------------------------------------------
      //resetting form values
      setActiveNature(initialNewCategoryData.nature);
      setCategoryData(initialNewCategoryData);
      setValidationMessages({});
      setFormData(initialFormData);
    } catch (error) {
      console.error('Error when posting data:', error);
    }
  }

  //-----------------------
  useEffect(() => {
    if (data && !isLoading && !error) {
      //success response
      setMessageToUser(
        data.message || 'Category budget account successfully created!'
      );
      console.log('Received data:', data);
    } else if (!isLoading && error) {
      setMessageToUser(error);
    }

    //resetting message to user
    const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
      setMessageToUser(null);
    }, 10000);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [data, error, isLoading]);

  //-----------------------
  return (
    <section className='page__container'>
      <TopWhiteSpace variant={'dark'} />
      <div className='page__content'>
        <div className='main__title--container'>
          <Link to='..' relative='path' className='iconLeftArrow'>
            <LeftArrowSvg />
          </Link>
          <div className='form__title'>{'New Category'}</div>
        </div>
        <form className='form__box'>
          <div className='container--categoryName form__container'>
            <div className='input__box'>
              <label htmlFor='category' className='label form__title'>
                {'Category Name'}&nbsp;
                <div className='validation__errMsg'>
                  {validationMessages['category']}
                </div>
              </label>

              <input
                type='text'
                className={`input__container`}
                placeholder={`Category Name`}
                name={'category'}
                onChange={inputHandler}
                value={categoryData.category}
              />
            </div>

            <div className='input__box'>
              <label htmlFor='subcategory' className='label form__title'>
                {'Subcategory'}&nbsp;
              </label>
              <span className='validation__errMsg'>
                {validationMessages['subcategory']}
              </span>
              <input
                type='text'
                className={`input__container`}
                placeholder={`subcategory name`}
                name={'subcategory'}
                onChange={inputHandler}
                value={categoryData.subcategory}
              />
            </div>

            {/* functionalitiy logic and data structure for this add button of subcategories is PENDING */}

            {/* <button className={'input__container'} onClick={addHandler}>
              <PlusSignSvg />
            </button> */}

            <div className='input__box'>
              <LabelNumberValidation
                formDataNumber={formDataNumber}
                validationMessages={validationMessages}
                variant={VARIANT_FORM}
              />
              <input
                className={'input__container'}
                type='text'
                name={formDataNumber.keyName}
                placeholder={formDataNumber.title}
                value={formData[formDataNumber.keyName]}
                onChange={inputHandler}
              />
            </div>
          </div>

          {/*later try refactoring it by converting it to a Component of tiles or badges */}
          <div className='container--nature'>
            <div className='form__title form__title--tiles'>
              {tileTitle}
              <div className='validation__errMsg'>
                {validationMessages['nature']}
              </div>
            </div>
            <div className='nature__tiles'>
              {TILE_LABELS.map((label, indx) => {
                return (
                  <button
                    className='nature__btn tile__button'
                    onClick={natureHandler}
                    key={`${indx}-tile`}
                    id={`${label.labelText.toLowerCase()}`}
                    style={
                      activeNature.toLowerCase() ===
                      label.labelText.toLowerCase()
                        ? {
                            backgroundColor: 'var(--creme)',
                            color: 'var(--dark)',
                          }
                        : {}
                    }
                  >
                    {label.labelText}
                  </button>
                );
              })}
            </div>
          </div>
          {/* save */}
          <div className='submit__btn__container'>
            <FormSubmitBtn onClickHandler={onSubmitForm}>save</FormSubmitBtn>
          </div>
        </form>
        <MessageToUser
          isLoading={isLoading}
          error={error}
          messageToUser={messageToUser}
        />
      </div>
    </section>
  );
}
export default NewCategory;
