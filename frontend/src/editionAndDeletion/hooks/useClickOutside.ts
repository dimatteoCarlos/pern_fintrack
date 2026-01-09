// frontend/src/editionAndDeletion/hooks/useClickOutside.ts

import { RefObject, useEffect } from "react";

// 🎯 HOOK FOR DETECTING A CLICK OUTSIDE AN ELEMENT
export function useClickOutside (ref:RefObject<HTMLElement>, callback:()=>void, isEnabled=true):void{
  useEffect(() => {
   function handleClickOutside (event:MouseEvent){
     if(ref.current && !ref.current.contains(event.target as Node) && isEnabled){
       callback()
     }
   }
 if(isEnabled){  document.addEventListener('mousedown' , handleClickOutside)}
 
   return () => {
     document.removeEventListener('mousedown', handleClickOutside)
   }
  }, [ref, callback, isEnabled])
 }