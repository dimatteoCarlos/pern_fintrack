import { Link } from 'react-router-dom';
import { useState } from 'react';
import TopWhiteSpace from '../../../general_components/topWhiteSpace/TopWhiteSpace.tsx';
import LeftArrowLightSvg from '../../../assets/LeftArrowSvg.svg';
import Dots3LightSvg from '../../../assets/Dots3LightSvg.svg';
import ListContent from '../../../general_components/listContent/ListContent.tsx';
import { CardTitle } from '../../../general_components/CardTitle.tsx';
import FormSubmitBtn from '../../../general_components/formSubmitBtn/FormSubmitBtn.tsx';
import SummaryDetailBox from '../../../general_components/summaryDetailBox/SummaryDetailBox.tsx';

import '../styles/forms-styles.css';
import { DEFAULT_CATEGORY_LIST } from '../../../helpers/constants.ts';

function CategoryDetail() {
  const [activeCategory, setActiveCategory] = useState('');
  // const [categoryDetail, setCategoryDetail] = useState(null);

  //temporary data
  // const categoryInfo = {
  //   name: 'Category',
  //   account: '',
  //   amount: '0',
  // };

  //summary data
  const summaryData = {
    title: 'budget',
    amount: 2222.11,
    subtitle1: 'Spent',
    subtitle2: 'status',
  };

  //Last Movements
  const listData = DEFAULT_CATEGORY_LIST;

  const tileLabels = [
    { labelText: 'Must', className: 'label--text' },
    { labelText: 'Need', className: 'label--text' },
    { labelText: 'Want', className: 'label--text' },
    { labelText: 'Other', className: 'label--text' },
    // { labelText: 'New One', className: 'label--text' },
  ];

  // const initialCategoryDetail = {
  //   summaryData,
  //   listData,
  //   nature: '',
  // };

  // const initialCategoryDetail=[

  // ]
  //Es necesario definir la estructura de la informacion o datos contemplados en detalles de categoria

  //--functions---

  function natureHandler(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    // console.log('natureHandler', e.currentTarget.id);
    const activeNature = !!e.currentTarget.id ? e.currentTarget.id : '';
    setActiveCategory(activeNature);
    // setCategoryData((prev) => ({ ...prev, nature: activeNature }));
  }

  function onSubmitForm(e: React.MouseEvent<HTMLButtonElement>) {
    console.log('submit btn clicked');
    e.preventDefault();
    setActiveCategory('');
    //Definir la informacion de categoryDetail.
    // setcategoryDetail(initialcategoryDetail);
  }

  return (
    <>
      <section className='page__container'>
        <TopWhiteSpace variant={'dark'} />
        <div className='page__content'>
          <div className='main__title--container'>
            <Link to='/budget' relative='path' className='iconLeftArrow'>
              <LeftArrowLightSvg />
            </Link>
            <div className='form__title'>{'Category'}</div>
            {/* <div className='form__title'>{categoryInfo.name}</div> */}
            <Link to='edit' className='flx-col-center icon3dots'>
              <Dots3LightSvg />
            </Link>
          </div>
        </div>

        <SummaryDetailBox summaryData={summaryData}></SummaryDetailBox>

        <form className='form__box'>
          <CardTitle>{'Subcategory'}</CardTitle>
          <ListContent listOfItems={listData} />

          <CardTitle>{'Category Nature'}</CardTitle>

          <div className='nature__tiles'>
            {tileLabels.map((label, indx) => {
              return (
                <button
                  className='nature__btn tile__button'
                  onClick={natureHandler}
                  key={`${indx}-tile`}
                  id={`${label.labelText.toLowerCase()}`}
                  style={
                    activeCategory == label.labelText.toLowerCase()
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

          <div className='submit__btn__container'>
            <FormSubmitBtn onClickHandler={onSubmitForm}>save</FormSubmitBtn>
          </div>
        </form>
      </section>
    </>
  );
}

export default CategoryDetail;
