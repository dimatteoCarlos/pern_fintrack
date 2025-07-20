//MessageToUser.tsx
import { useEffect } from 'react';
import { capitalize, showToastByStatus } from '../../helpers/functions';
import { VariantType } from '../../types/types';
import './messageToUser.css'

type MessageToUserPropType = {
  isLoading: boolean;
  error: string | Error | null
  messageToUser:{message:string, status?:number} | string | null | undefined;
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

 //-- Apply toast notification just to variant form , not for tracker
 // ---------------------------------- 
     useEffect(()=>{
      if(!error && messageToUser && variant=='form'){
const msg = typeof messageToUser === 'string' ? messageToUser :messageToUser.message;
const status =typeof messageToUser === 'string'? 200 : messageToUser.status ?? 200

 if(variant=='form'){showToastByStatus(msg, status)}
      }
     }, [error, messageToUser, variant])
 //----------------------------------     
  useEffect(()=>{
    if(error && messageToUser && variant=='form'){
const msg = typeof messageToUser === 'string' ? messageToUser :messageToUser.message;
const status =typeof messageToUser === 'string'? 500 : messageToUser.status ?? 500

 if(variant=='form'){showToastByStatus(msg, status)}
      }
     }, [error, messageToUser, variant])
 //----------------------------------     
  return (
    <>
      {isLoading && <div style={{ color: 'lightblue' }}>Loading...</div>}

         {/* {error && ( */}
      {error && variant!=='form' && (
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
            {typeof messageToUser=='string'?messageToUser:messageToUser?.message}


          </span>
        </div>
      )}

      {!error && messageToUser && variant!=='form' && (
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
            {capitalize(typeof messageToUser=='string'?messageToUser:messageToUser.message)}

          </span>
        </div>
      )}
    </>
  );
};
