//FormPlusBtn.tsx
import Plusvg from '../../assets/trackerNavbarSvg/Plusvg.svg';
type FormPlusBtnPropType = {
  onClickHandler: (e: React.MouseEvent<HTMLButtonElement>) => void;
};

function FormPlusBtn({ onClickHandler }: FormPlusBtnPropType) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClickHandler(e);
  };
  return (
    <div className='btn__container'>
      <button
        type='submit'
        className='plus__btn'
        onClick={handleClick}
        style={{
          border: 'none',
          transition: 'all 0.2s ease',
        }}
        onMouseDown={(e) =>
          (e.currentTarget.style.transform = 'translateY(2px)')
        }
        onMouseUp={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
        onMouseLeave={(e) =>
          (e.currentTarget.style.transform = 'translateY(0)')
        }
      >
        <Plusvg />
      </button>
    </div>
  );
}

export default FormPlusBtn;
