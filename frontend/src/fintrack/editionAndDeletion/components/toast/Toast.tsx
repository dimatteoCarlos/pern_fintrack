// frontend/src/general_components/toast/Toast.tsx
//Customized own toast messages 
import { useEffect } from "react";
import "./toast-styles.css"

// 🎯 TOAST PROPS TYPE
export type ToastMessageType='success' | 'error' | 'info' | 'warning';

type ToastPropsType ={
message:string;
type:ToastMessageType;
visible: boolean;
onClose: () => void;
duration?: number;
}

// 🚨 TOAST COMPONENT
function Toast({message, type, visible, onClose, duration=5000}:ToastPropsType){
// 🎯 TOAST EMOJI MAPPING
const toastEmojis = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
//--------------------
// ⏰ AUTO-CLOSE TOAST
useEffect(()=>{
if(visible && duration >0){
  const timer = setTimeout(onClose, duration)
  return ()=>clearTimeout(timer)
  } 
}, [visible, duration, onClose])
//---------------------
if(!visible) return null

  return (
   <div className={`toast toast--${type}`}>

    <div className="toast__content">
      <span className="toast__emoji">{toastEmojis[type]}</span>  

      <span className="toast_message">{message}</span>

      <button className="toast__close" onClick={onClose}
      aria-label = "Close notification"
      >
      </button>
    </div>
  </div>
  )
}

export default Toast;