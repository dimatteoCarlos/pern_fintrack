//frontend/src/general_components/labelNumberValidation/LabelNumberValidation.tsx
import { capitalize } from '../../helpers/functions';
import { VariantType } from '../../types/types';
import { ValidationMessagesType } from '../../validations/types';

type LabelNumberValidationPropType<
  TFormDataType extends { [key: string]: unknown },
> = {
  formDataNumber: { [key: string]: string };
  validationMessages: ValidationMessagesType<TFormDataType>;
  variant: VariantType;
};

function LabelNumberValidation<
  TFormDataType extends { [key: string]: unknown },
>({
  formDataNumber,
  validationMessages,
  variant,
}: LabelNumberValidationPropType<TFormDataType>) {
  const labelClassName =
    variant === 'form' ? 'label forms__label' : 'card--title';

  const validationKey = formDataNumber.keyName as keyof TFormDataType;
  const validationMessage = validationMessages[validationKey] || '';

  // A 'Format:' prefix means the figure was ACCEPTED, so this one span says two
  // opposite things. The class states which; the stylesheet then picks the
  // colour for the surface it lands on, which the inline style it replaces
  // could not do -- the forms are dark and the tracker card is light, and one
  // hardcoded value was wrong on one of them.
  const isAcceptedFormat = validationMessage.toLowerCase().includes('format:');

  return (
    // A label and not a div, and htmlFor is the field's own key: the amount
    // input is named by that key everywhere this renders, so the two cannot
    // drift. As a div the word "Amount" named nothing — the field was
    // announced unlabelled on all five tracker routes and in NewCategory.
    <label className={labelClassName} htmlFor={String(validationKey)}>
      {capitalize(formDataNumber.title)}&nbsp;
      {/* Named so the field it describes can point at it with
          aria-describedby. Without the id the message is a loose sibling: a
          screen reader reaches the input and is told nothing is wrong with
          it. The id is derived from the field's own key, which is what the
          input is named by, so the two cannot drift apart. */}
      <span
        id={`${String(validationKey)}-validation`}
        className={`validation__errMsg${
          isAcceptedFormat ? ' validation__errMsg--ok' : ''
        }`}
      >
        {validationMessages[
          formDataNumber.keyName as keyof TFormDataType
        ]?.replace('Format:', '')}
      </span>
    </label>
  );
}

export default LabelNumberValidation;
