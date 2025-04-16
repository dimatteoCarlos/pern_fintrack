import { ChangeEvent } from 'react';

type CardNotePropType = {
  inputNote: string;
  dataHandler: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  title: string;
};

function CardNote({ dataHandler, inputNote, title }: CardNotePropType) {
  return (
    <>
      <div className='card__screen description '>
        <textarea
          className='input__note__description'
          placeholder='Description'
          name={title}
          rows={3}
          maxLength={150}
          value={inputNote}
          onChange={dataHandler}
        />
      </div>
    </>
  );
}

export default CardNote;
