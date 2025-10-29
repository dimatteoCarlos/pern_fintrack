// frontend/src/edition/hooks/useClickOutside.ts

import { RefObject, useEffect } from "react";

// 🎯 HOOK FOR DETECTING A CLICK OUTSIDE AN ELEMENT
export function useClickOutside (ref:RefObject<HTMLElement>, callback:()=>void):void{
  useEffect(() => {
    function handleClickOutside (event:MouseEvent){
      if(ref.current && !ref.current.contains(event.target as Node)){
        callback()
      }
    }
    document.addEventListener('mousedown' , handleClickOutside)
  
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [ref, callback])
 }