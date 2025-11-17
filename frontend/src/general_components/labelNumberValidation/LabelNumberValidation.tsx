import { capitalize } from '../../helpers/functions';
import { VariantType } from '../../types/types';
import { ValidationMessagesType } from '../../validations/types';
// import { ValidationMessagesType } from '../../validations/utils/zod_validation';
// import { ValidationMessagesType } from '../../../../validations/types';

type LabelNumberValidationPropType<TFormDataType extends { [key: string]: unknown} > = {
  formDataNumber: { [key: string]: string };
  validationMessages: ValidationMessagesType<TFormDataType>;
  variant: VariantType;
};

function LabelNumberValidation<TFormDataType extends { [key: string]: unknown }>({
  formDataNumber,
  validationMessages,
  variant,
}: LabelNumberValidationPropType<TFormDataType>) {
  const successColor = variant === 'form' ? '--lightSuccess' : '--success';
  const labelClassName =
    variant === 'form' ? 'label form__title' : 'card--title';

  const validationKey = formDataNumber.keyName as keyof TFormDataType;
  const validationMessage = validationMessages[validationKey] || '';  

  return (
   
    <div className={labelClassName}>
      {capitalize(formDataNumber.title)}&nbsp;
      <span
        className='validation__errMsg'
        style={{
          color: validationMessage.toLowerCase().includes('format:')
            ? `var(${successColor})`
            : 'var(--error)',
        }}
      >
       {validationMessages[formDataNumber.keyName as keyof TFormDataType]?.replace('Format:', '')}
      </span>
    </div>
    
  );
}

export default LabelNumberValidation;
