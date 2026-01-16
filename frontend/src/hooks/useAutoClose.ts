//frontend/src/hooks/useAutoClose.ts

import { useEffect, useRef } from "react";

/**
 * 🎯 Hook for auto-executing a callback after a delay
 *
 * @param durationMs - Delay in milliseconds
 * @param callback - Function to execute
 * @param isEnabled - Enable/disable auto close
 */
export function useAutoClose(
  durationMs: number = 3000,
  callback: () => void,
  isEnabled: boolean = true
): void {
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isEnabled || durationMs <= 0) return;

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      callback();
    }, durationMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [durationMs, callback, isEnabled]);
}

/*
import { useState, useCallback } from "react";
import { useSuccessAutoClose } from "./auth/hooks/useAutoClose";

const MyComponent = () => {
  const [msg, setMsg] = useState("");

  // Memorizamos la función para que el hook no se reinicie innecesariamente
  const handleClose = useCallback(() => setMsg(""), []);

  // Usamos tu hook personalizado
  useSuccessAutoClose(msg, handleClose);

  return (
    <div>
      <button onClick={() => setMsg("¡Guardado con éxito!")}>
        Simular Éxito
      </button>
      
      {msg && <div className="alert">{msg}</div>}
    </div>
  );
};


*/
