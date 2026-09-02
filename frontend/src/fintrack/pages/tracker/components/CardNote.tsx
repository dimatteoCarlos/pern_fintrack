import { ChangeEvent } from 'react';

type CardNotePropType = {
  inputNote: string;
  dataHandler: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  title: string;
};

// The word the reader sees, and the field's accessible name. One constant for
// both: a placeholder is not a name — it is erased by the first character
// typed, so the field went unnamed from that character on. `title` cannot
// stand in for it either; every caller passes 'note', which is the key this
// value is filed under in the form data, not what the box is called on screen.
const NOTE_LABEL = 'Description';

function CardNote({ dataHandler, inputNote, title }: CardNotePropType) {
  return (
    <>
      <div className='card__screen description '>
        <textarea
          className='input__note__description'
          placeholder={NOTE_LABEL}
          aria-label={NOTE_LABEL}
          name={title}
          rows={3}
          maxLength={90}
          value={inputNote}
          onChange={dataHandler}
        />
      </div>
    </>
  );
}

export default CardNote;
