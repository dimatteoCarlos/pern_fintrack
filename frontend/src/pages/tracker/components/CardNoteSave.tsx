import FormPlusBtn from '../../../general_components/formSubmitBtn/FormPlusBtn';
import { capitalize } from '../../../helpers/functions';
import CardNote from './CardNote';

type CardNoteSavePropType = {
  inputNote: string;
  dataHandler: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  title: string;
  onSaveHandler: (e: React.MouseEvent<HTMLButtonElement>) => void;
  validationMessages: {
    [key: string]: string;
  };
};

const CardNoteSave = ({
  title,
  validationMessages,
  dataHandler,
  inputNote,
  onSaveHandler,
}: CardNoteSavePropType) => {
  return (
    <>
      <div className='card--title'>
        {capitalize(title)}
        <span className='validation__errMsg'>{validationMessages[title]}</span>
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
          {/* <div className='card__screen  ' style={{ flex: 0.95 }}>
              <textarea
                className='input__note__description'
                placeholder='Description'
                onChange={updateTrackerData}
                name='note'
                rows={3}
                maxLength={150}
                value={expenseData.note}
              />
            </div> */}
        </div>

        <FormPlusBtn onClickHandler={onSaveHandler} />
      </div>
    </>
  );
};

export default CardNoteSave;
