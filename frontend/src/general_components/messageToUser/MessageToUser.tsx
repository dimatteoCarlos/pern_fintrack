//src/general_components/messageToUser/MessageToUser.tsx
import { useEffect, useRef } from 'react';
import { capitalize,  } from '../../helpers/functions';
import { VariantType } from '../../types/types';
import './messageToUser.css'
import { showToastByStatus } from '../../helpers/showToastByStatus';

type MessageToUserPropType = {
  isLoading?: boolean;
  error?: string | Error | null
  messageToUser:{message:string, status?:number} | string | null | undefined;
  variant?: VariantType;
  showToast?: boolean;
};

export const MessageToUser = ({
  isLoading,
  error,
  messageToUser,
  // variant,
  variant,// = 'form',
  showToast = true,

}: MessageToUserPropType): JSX.Element => {
  const lastMessageRef =useRef<string>('')
  const colorStyles =
    variant === 'tracker'
      ? { success: 'darkgreen', failure: 'red' }
      : { success: 'lightgreen', failure: 'orange' };

  const topStyles =
    variant === 'tracker'
      ? '2%'
      : '70%';

// Toast notification logic - only for form variant and when showToast is true, not for tracker
// ---------------------------------- 
useEffect(()=>{
if(messageToUser && variant=='form' && showToast){
 const msg = typeof messageToUser === 'string' ? messageToUser :messageToUser.message;
 
 const status =typeof messageToUser === 'string'? 200 : messageToUser.status ?? 200

   // console.log('📨 Showing toast:', { msg, status, variant });

 // if(variant=='form'){showToastByStatus(msg, status)}

// Prevent duplicate toasts for the same message
if (msg !== lastMessageRef.current) {
    showToastByStatus(msg, status);
    lastMessageRef.current = msg;
  }

//Clean reference if there is not message
 if (!messageToUser) {
   lastMessageRef.current = '';
 }
}
}, [showToast, messageToUser, variant])
 //----------------------------------  
// For non-form variants or when toast is disabled, show inline messages
const shouldShowInlineMessage = variant !== 'form' //|| !showToast;

// console.log("🚀 ~ MessageToUser ~ shouldShowInlineMessage:", shouldShowInlineMessage)
//-------------------------------     
  return (
    <>
      {isLoading && <div style={{ color: 'lightblue' }}>Loading...</div>}

      {error && shouldShowInlineMessage && (
        <div className='error-message1'>
          <span
            className='validation__errMsg1 '
            style={{
              color: colorStyles.failure,
              position:'absolute',
              top:`${topStyles}`,
              right:'2rem',
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
          {typeof error=='string'?error:error?.message}
          </span>
        </div>
      )}

      {!error && messageToUser && shouldShowInlineMessage && (
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
            {capitalize(typeof messageToUser ==='string'?messageToUser:messageToUser.message)}

          </span>
        </div>
      )}
    </>
  );
};
