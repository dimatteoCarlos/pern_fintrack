// frontend/src/editionAndDeletion/hooks/useAutoClose.ts

import { useRef, useEffect } from "react";

// 🎯 HOOK FOR AUTO-CLOSING AFTER A SPECIFIED DURATION
export function useAutoClose (durationMs:number=3000, callback:()=>void, isEnabled=true):void{
 const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
  //Clear any existing timeout
   if(timeoutRef.current){
    clearTimeout(timeoutRef.current)
    timeoutRef.current=null
   }
   // Set new timeout if duration is provided and enabled
   if(durationMs && durationMs>0 && isEnabled) 
   {
    timeoutRef.current = window.setTimeout(()=>{
     callback();
    },durationMs)
   }

// Cleanup on unmount or when dependencies change
  return () => {
    if(timeoutRef.current){
     clearTimeout(timeoutRef.current)
   }
  }
  }, [durationMs, callback, isEnabled])
 }