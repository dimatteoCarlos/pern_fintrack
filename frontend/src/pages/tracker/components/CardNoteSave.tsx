import FormPlusBtn from '../../../general_components/formSubmitBtn/FormPlusBtn';
import { capitalize } from '../../../helpers/functions';
import { ValidationMessagesType } from '../../../validations/utils/functions';
import CardNote from './CardNote';

type CardNoteSavePropType<TFormDataType extends Record<string, unknown>> = {
  inputNote: string;
  dataHandler: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  title: string;
  onSaveHandler: (e: React.MouseEvent<HTMLButtonElement>) => void;
  // validationMessages: {
  //   [key: string]: string;
  // };
 validationMessages: ValidationMessagesType<TFormDataType>;
  isDisabled :boolean
  showError?: boolean;
};

const CardNoteSave =<TFormDataType extends Record<string, unknown>> ({
  title,
  validationMessages,
  dataHandler,
  inputNote,
  onSaveHandler,
  isDisabled,
  showError
}: CardNoteSavePropType<TFormDataType>) => {
  return (
    <>
      <div className='card--title'>
        {capitalize(title)}
        <span className='validation__errMsg'>{`${showError && validationMessages?.[title]?validationMessages?.[title]:""}`}</span>
      </div>

      <div
        className='note--description '
        style={{ display: 'flex', justifyContent: 'space-between' }}
      >
        <div className='note__description ' style={{ flex: 0.95 }}>
          <CardNote
            dataHandler={dataHandler}
            inputNote={inputNote}
            title={title}
          />
         </div>

        <FormPlusBtn onClickHandler={onSaveHandler} isDisabled={isDisabled}/>
      </div>
    </>
  );
};

export default CardNoteSave;
