import { capitalize } from '../../helpers/functions';
import { VariantType } from '../../types/types';

type LabelNumberValidationPropType = {
  formDataNumber: { [key: string]: string };
  validationMessages: { [key: string]: string };
  variant: VariantType;
};

function LabelNumberValidation({
  formDataNumber,
  validationMessages,
  variant,
}: LabelNumberValidationPropType) {
  const successColor = variant === 'form' ? '--lightSuccess' : '--success';
  const labelClassName =
    variant === 'form' ? 'label form__title' : 'card--title';

  return (
    // <label htmlFor={formDataNumber.keyName} className={labelClassName}>
    <div className={labelClassName}>
      {capitalize(formDataNumber.title)}&nbsp;
      <span
        className='validation__errMsg'
        style={{
          color: validationMessages[formDataNumber.keyName]
            ?.toLowerCase()
            .includes('format:')
            ? `var(${successColor})`
            : 'var(--error)',
        }}
      >
        {validationMessages[formDataNumber.keyName]?.replace('Format:', '')}
      </span>
    </div>
  );
}

export default LabelNumberValidation;
