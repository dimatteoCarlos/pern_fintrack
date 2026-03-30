// frontend/src/edition/hooks/useEscapeKey.ts
import {  useEffect } from "react";

// 🎯 HOOK FOR DETECTING ESCAPE KEY PRESS
export function useEscapeKey(
 callback:()=>void, isEnabled:boolean=true):void{
  useEffect(()=>{
   function handleEscapeKey(event:KeyboardEvent)
  { if(event.key === 'Escape' && isEnabled){
    callback();
   }}

if(isEnabled){
  document.addEventListener('keydown', handleEscapeKey)
 }

   return ()=>{
    document.removeEventListener('keydown', handleEscapeKey)
   }
   
  }, [callback,isEnabled])
 }


// export function useEscapeKey(callback: () => void, isEnabled: boolean = true): void {
//   useEffect(() => {
//     function handleEscapeKey(event: KeyboardEvent) {
//       if (event.key === 'Escape' && isEnabled) {
//         callback();
//       }
//     }
    
//     if (isEnabled) {
//       document.addEventListener('keydown', handleEscapeKey);
//     }
    
//     return () => {
//       document.removeEventListener('keydown', handleEscapeKey);
//     };
//   }, [callback, isEnabled]); // ✅ Dependencies: callback and enabled state
// }