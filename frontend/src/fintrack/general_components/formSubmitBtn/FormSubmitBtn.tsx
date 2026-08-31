import { ReactNode } from 'react';
import './styles/formSubmitBtn-style.css'
type FormSubmitBtnPropType = {
  // btnTitle?: string;
  children: ReactNode;
  disabled?:boolean;

  // Optional, because a form that declares onSubmit needs no click handler: the
  // click already reaches it through this button being type=submit, and wiring
  // both fires the handler twice.
  onClickHandler?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  // The surface the button sits on, never its own colour. A shared control that
  // lands on both the dark app and a cream panel cannot pick one of the two.
  className?: string;
};

function FormSubmitBtn({
  // btnTitle,
  onClickHandler,
  children,
  disabled,
  className
}: FormSubmitBtnPropType) {
  return (
    <div className='btn__container'>
      <button
        type='submit'
        className={className ? `submit__btn ${className}` : 'submit__btn'}
        onClick={onClickHandler}
        disabled={disabled}
        // id={btnTitle}
      >
        {/* {`${btnTitle}`} */}
        {children}
      </button>
    </div>
  );
}

export default FormSubmitBtn;
