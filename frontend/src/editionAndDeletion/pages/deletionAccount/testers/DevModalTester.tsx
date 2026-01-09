
// ==================================
// 🎯 TEMPORAL: DEVELOPMENT TESTING UTILITIES
// (Remove when development is complete)

import { useState } from "react";
import { DictionaryDataType, LanguageKeyType } from "../../../utils/languages";
import StatusModalUI from "../UIComponents/statusModalUI/StatusModalUI";
import { ModalStatusType } from "../../../types/deletionTypes";

// ==================================
export const DevModalTester = ({
 translateText,
}:{ translateText: (keyText: keyof DictionaryDataType) => string;language: LanguageKeyType;
  changeLanguage: (lang: LanguageKeyType) => void; }) => {

  const [isTestingModal, setIsTestingModal] = useState(false);
  const [testModalStatus, setTestModalStatus] = useState<ModalStatusType>('idle');
  const [testModalMessage, setTestModalMessage] = useState('');

//FUNCTION TO DRAG THE TESTING MODAL VIEW
  const [position, setPosition] = useState({ x: window.innerWidth/2+50, y:88 }); // Posición inicial

// 🎯 DRAG FUNCTIONALITY: Allows dragging the test panel
const handleDrag = (e:React.MouseEvent<HTMLDivElement>) => {
 if (e.buttons !== 1) return; // Only drag when left mouse button is pressed
  setPosition({
    x: position.x + e.movementX,
    y: position.y + e.movementY
  });
};

// 🎯 OPEN TEST MODAL
// Function to open the Test Modal /Función para abrir modal de prueba
 const openTestModal = (modalStatus:typeof testModalStatus, message:string)=>{
  setTestModalMessage(message);setTestModalStatus(modalStatus);setIsTestingModal(true);
  }
  
// 🐛 DEVELOPMENT CHECK: Only show in development environment
  if (import.meta.env.VITE_ENVIRONMENT !== 'development' ) return null;

// 🎯 STYLE FOR TEST BUTTONS
const buttonStyle = {
  padding: '8px 12px',
  borderRadius: '6px',
  border: 'none',
  backgroundColor: '#3b82f6',
  color: 'white',
  fontWeight: '600',
  cursor: 'pointer',
  fontSize: '14px',
  transition: 'background-color 0.2s'
};
//Render Modal Test Panel  
 return (
   <>
 {/* 🎯 DRAGGABLE TEST MODAL PANEL */}
   <div className="modal-test bordered"
     onMouseMove={handleDrag}  
     style={{position:'fixed',
     left: `${position.x}px`, top: `${position.y}px`,
     zIndex:999,  background: '#8abef3ff',
     padding: '10px',
      borderRadius: '8px',
      border: '2px solid #3b82f6',
     display: 'flex',
     flexDirection: 'column',
     gap: '5px', 
     cursor:'move',userSelect:'none',
     minWidth: '200px',
     boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
   }}>
{/* 🎯 PANEL HEADER*/}
   <div className="modal-test-header"
    style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}
   >
    <small style={{color: '#373b44ff', marginBottom: '5px'}}>🔧Dev: Modal Tester</small>

   </div>

   {/* 🎯 TEST BUTTONS*/}
   <button onClick={() => openTestModal('idle', translateText('clickToConfirm') || '¿Confirmar eliminación de cuenta?')}
    style={buttonStyle} 
    >
   {translateText('testIdleButton')?? 'Test Idle'}

    </button>

    <button onClick={() => openTestModal('executing',  translateText('processing')||'Procesando eliminación...')}
     style={buttonStyle} 
     >
    {translateText('testExecutingButton') || 'Test Executing'}
    </button>

    <button onClick={() => openTestModal('success',  translateText('successMessage') || '¡Cuenta eliminada exitosamente!')}
     style={{...buttonStyle, backgroundColor: '#10b981'}} 
     >
     {translateText('testSuccessButton') || 'Test Success'}
    </button>

    <button onClick={() => openTestModal('error', translateText('errorMessage') || 'Error: No se pudo eliminar la cuenta')}
    style={{...buttonStyle, backgroundColor: '#ef4444'}} 
     >
 {translateText('testErrorButton') || 'Test Error'}
    </button>

{/* 🎯 STATUS INFO */}
<div style={{ 
  marginTop: '10px', 
  padding: '8px', 
  backgroundColor: '#f3f4f6', 
  borderRadius: '6px',
  fontSize: '12px',
  color: '#4b5563'
}}>
  <div><strong>Status:</strong> {testModalStatus}</div>
    {/* <div><strong>Language:</strong> {language === 'es' ? 'Español' : 'English'}</div> */}
  </div>  
 </div>

 {/* 🎯 RENDER TEST MODAL */}
 {isTestingModal && (
 <StatusModalUI
  modalStatus={testModalStatus}
  message={testModalMessage}
  onClose={() => setIsTestingModal(false)}
  onConfirm={() => {
   console.log('Test confirm clicked');
   setIsTestingModal(false);
  }}
  autoCloseDelay={10000}
  showCountdown={true}
  t={translateText}
 />
 )}
    </>
  );
};