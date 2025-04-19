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
  variant = 'form',
}: MessageToUserPropType): JSX.Element => {
  const colorStyles =
    variant === 'tracker'
      ? { success: 'darkgreen', failure: 'red' }
      : { success: 'lightgreen', failure: 'orange' };
  return (
    <>
      {isLoading && <div style={{ color: 'lightblue' }}>Loading...</div>}

      {error && (
        <div className='error-message'>
          <span
            className='validation__errMsg'
            style={{
              color: colorStyles.failure,
              borderRadius: '4px',
              fontSize: '1.1rem',
              fontWeight: '400',
              lineHeight: '1.5rem',
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
              fontSize: '1rem',
              marginTop: '1rem',
              textAlign: 'center',
              fontWeight: '400',
              lineHeight: '1rem',
            }}
          >
            {capitalize(messageToUser)}
          </span>
        </div>
      )}
    </>
  );
};
