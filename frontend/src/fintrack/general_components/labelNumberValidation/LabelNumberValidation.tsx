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
  // '--success' resolves to --color-status-success, the dark-page semaphore
  // (4.05:1 on this light card, under the 4.5:1 floor); the 'tracker' variant
  // renders on a card, so it takes the light-surface-calibrated sibling
  // instead. 'form' still uses --lightSuccess, a separate, unaudited path.
  const successColor =
    variant === 'form' ? '--lightSuccess' : '--color-feedback-success-content';
  const labelClassName =
    variant === 'form' ? 'label forms__label' : 'card--title';

  const validationKey = formDataNumber.keyName as keyof TFormDataType;
  const validationMessage = validationMessages[validationKey] || '';

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
        className='validation__errMsg'
        style={{
          color: validationMessage.toLowerCase().includes('format:')
            ? `var(${successColor})`
            // Same fix as .validation__errMsg in generalStyles.css: the
            // light-surface error token, not the dark-page semaphore.
            : 'var(--color-feedback-error-content)',
        }}
      >
        {validationMessages[
          formDataNumber.keyName as keyof TFormDataType
        ]?.replace('Format:', '')}
      </span>
    </label>
  );
}

export default LabelNumberValidation;
