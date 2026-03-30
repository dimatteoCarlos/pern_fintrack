// src/hooks/useDebouncedCallback.ts
import { useCallback, useEffect, useRef } from "react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useDebouncedCallback<F extends (...args:any[])=>void>(callback:F, delay:number):(...args:any[])=>void{

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const callbackRef = useRef(callback);
  
  //debounced fn to return 
  const debouncedCallback = useCallback(
    (...args: Parameters<F>) => {
      if(timeoutRef.current){
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout (()=>{callbackRef.current(...args)},delay)
    }, [delay]
  )
  //update callbackRef if original fn changes
  useEffect(() => {
     callbackRef.current = callback;
   }, [callback]);

  //clean timeout if debouncedCallback changes or component dismounts
   useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [debouncedCallback]);//re-renders

  return debouncedCallback
}
/*ReturnType Obtain the return type of a function type,es una utilidad de TypeScript. Toma un tipo de función como argumento y devuelve el tipo de lo que esa función retorna. A menudo verás NodeJS.Timeout o number directamente
useRef, useRef returns a mutable ref object whose .current property is initialized to the passed argument (initialValue). The returned object will persist for the full lifetime of the component.

Note that useRef() is useful for more than the ref attribute. It’s handy for keeping any mutable value around similar to how you’d use instance fields in classes. Permite crear una referencia mutable que persiste durante todo el ciclo de vida del componente, sin causar una re-renderización cuando su valor cambia.

Retorna un objeto con una única propiedad .current, que inicialmente se establece con el valor que le pasaste.
*/