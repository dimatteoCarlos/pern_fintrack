import { capitalize } from '../../helpers/functions';
import { VariantType } from '../../types/types';
import './messageToUser.css'

type MessageToUserPropType = {
  isLoading: boolean;
  error: string | Error | null
  messageToUser: string | null | undefined;
  variant?: VariantType;
};

export const MessageToUser = ({
  isLoading,
  error,
  messageToUser,
  // variant,
  variant = 'form',
}: MessageToUserPropType): JSX.Element => {
  const colorStyles =
    variant === 'tracker'
      ? { success: 'darkgreen', failure: 'red' }
      : { success: 'lightgreen', failure: 'orange' };
  const topStyles =
    variant === 'tracker'
      ? '3%'
      : '70%';
  return (
    <>
      {isLoading && <div style={{ color: 'lightblue' }}>Loading...</div>}
         {/* {error && ( */}
      {error && (
        <div className='error-message1'>
          <span
            className='validation__errMsg1 '
            style={{
              color: colorStyles.failure,
              position:'absolute',
             top:`${topStyles}`,
              right:'10px',
              width:'80%',
              height:'1.5rem',
              textAlign:'right',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: '400',
              lineHeight: '1.5rem',
              zIndex:'1'
            }}
          >
            {/* Error: {error} */}
            {messageToUser}
          </span>
        </div>
      )}

      {!error && messageToUser && (
        <div className='success-message'>
          <span
            style={{
              color: colorStyles.success,
              position:'absolute',
              top:`${topStyles}`,
              right:'2rem',
              width:'60%',
              height:'1.5rem',
              textAlign:'right',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: '400',
              lineHeight: '1.5rem',
              zIndex:'1'
            }}
          >
            {capitalize(messageToUser)}
          </span>
        </div>
      )}
    </>
  );
};
