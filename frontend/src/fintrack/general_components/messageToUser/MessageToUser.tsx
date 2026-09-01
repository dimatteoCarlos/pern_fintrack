//src/general_components/messageToUser/MessageToUser.tsx
import { useEffect, useRef } from 'react';
import { capitalize } from '../../helpers/functions';
import { VariantType } from '../../types/types';
import './messageToUser.css';
import { showToastByStatus } from '../../helpers/showToastByStatus';

type MessageToUserPropType = {
  isLoading?: boolean;
  error?: string | Error | null;
  messageToUser:
    | { message: string; status?: number }
    | string
    | null
    | undefined;
  variant?: VariantType;
  showToast?: boolean;
  /** Whether a plain messageToUser reads as a confirmation of something done
   * or as a correction the owner still has to make. Defaults to confirmation,
   * which is what every caller meant by it before this existed — the tracker
   * forms were the exception, sending "please correct the highlighted errors"
   * down the same channel and getting it painted in the success colour. */
  tone?: 'confirmation' | 'correction';
};

export const MessageToUser = ({
  isLoading,
  error,
  messageToUser,
  // variant,
  variant, // = 'form',
  showToast = true,
  tone = 'confirmation',
}: MessageToUserPropType): JSX.Element => {
  const lastMessageRef = useRef<string>('');
  // The tracker renders on the light card, so its pair is the light-surface
  // feedback family: 'red' measured 4.00:1 there, under the 4.5:1 floor, and
  // 'lightblue' for the loading line measured 1.53:1.
  //
  // The other variants render on the app's dark ground, where the literals
  // they already carry measure 13.5:1 and 9.7:1 — they pass, and replacing
  // them means naming a dark-surface feedback pair the token file does not
  // have yet. Left alone deliberately; that is a token question, not a
  // contrast one.
  const colorStyles =
    variant === 'tracker'
      ? {
          success: 'var(--color-feedback-success-content)',
          failure: 'var(--color-feedback-error-content)',
          neutral: 'var(--color-content-secondary)',
        }
      : {
          // The product's own financial semaphore, which tokens.css calibrates
          // against exactly this dark ground: 5.13:1 for ok and 5.70:1 for
          // alert on --color-surface-app. It replaces the 'lightgreen' and
          // 'orange' literals that stood here -- those passed contrast, but
          // they belonged to no palette in the product, and the dark-surface
          // pair they were standing in for already existed.
          success: 'var(--color-status-ok)',
          failure: 'var(--color-status-alert)',
          neutral: 'var(--color-content-on-dark-subtle)',
        };

  // A correction is painted and announced as one, whichever channel carried it.
  const messageColor =
    tone === 'correction' ? colorStyles.failure : colorStyles.success;

  const topStyles = variant === 'tracker' ? '2%' : '70%';

  // Toast notification logic - only for form variant and when showToast is true, not for tracker
  // ----------------------------------
  useEffect(() => {
    if (messageToUser && variant == 'form' && showToast) {
      const msg =
        typeof messageToUser === 'string'
          ? messageToUser
          : messageToUser.message;

      const status =
       typeof messageToUser === 'string' ? 200 : (messageToUser.status ?? 200);

//DEBUG
      console.log('📨 Showing toast:', {
      currentMessage: msg,
      previousMessage: lastMessageRef.current,
      sameMessage: msg === lastMessageRef.current,
    });
//-------
      // Prevent duplicate toasts for the same message
      // if (msg !== lastMessageRef.current) {
      //   showToastByStatus(msg, status);
      //   lastMessageRef.current = msg;
      // }
        showToastByStatus(msg, status);

      //Clean reference if there is not message
      if (!messageToUser) {
        lastMessageRef.current = '';
      }
    }
  }, [showToast, messageToUser, variant]);
  //----------------------------------
  // For non-form variants or when toast is disabled, show inline messages
  const shouldShowInlineMessage = variant !== 'form'; //|| !showToast;

  // console.log("🚀 ~ MessageToUser ~ shouldShowInlineMessage:", shouldShowInlineMessage)
  //-------------------------------
  return (
    <>
      {isLoading && (
        <div style={{ color: colorStyles.neutral }}>Loading...</div>
      )}

      {error && shouldShowInlineMessage && (
        <div className='error-message1'>
          {/* Announced, not just drawn: this appears in place after a save
              attempt without moving focus, which is exactly what WCAG 4.1.3
              covers. 'alert' rather than 'status' because it interrupts — the
              save did not happen. */}
          <span
            role='alert'
            className='validation__errMsg1 '
            style={{
              color: colorStyles.failure,
              position: 'absolute',
              top: `${topStyles}`,
              right: '2rem',
              width: '80%',
              height: '1.5rem',
              textAlign: 'right',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: '400',
              lineHeight: '1.5rem',
              zIndex: '1',
            }}
          >
            {typeof error == 'string' ? error : error?.message}
          </span>
        </div>
      )}

      {!error && messageToUser && shouldShowInlineMessage && (
        <div className='success-message'>
          <span
            role={tone === 'correction' ? 'alert' : 'status'}
            style={{
              color: messageColor,
              position: 'absolute',
              top: `${topStyles}`,
              right: '2rem',
              width: '60%',
              height: '1.5rem',
              textAlign: 'right',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: '400',
              lineHeight: '1.5rem',
              zIndex: '1',
            }}
          >
            {capitalize(
              typeof messageToUser === 'string'
                ? messageToUser
                : messageToUser.message,
            )}
          </span>
        </div>
      )}
    </>
  );
};
