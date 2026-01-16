//src/hooks/useCallbackDebounce.ts
//useCallbackDebounce refactored here in auth module
import { useCallback, useEffect, useRef } from "react";
// 🧩 ---------------------------
// 🔤 Generic Function Type
// -------------------------------
// Accepts any function with any arguments and no return value
type GenericCallback = (...args: unknown[]) => void;

// 🧠 -------------------------
// 🪝 useCallbackDebounce Hook
// ----------------------------
// ✔ Prevents stale closures
// ✔ Keeps stable function identity
// ✔ Cleans up on unmount
// ✔ Fully reusable & strongly typed
export function useCallbackDebounce<F extends GenericCallback>(
  callback: F,
  delay: number
): (...args: Parameters<F>) => void {

  // ⏱️ Holds the active timeout ID
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // 🔄 Always stores the latest version of the callback
  const latestCallbackRef = useRef(callback);

  // 🔁 -------------------------------
  // 🔄 Update callback reference when it changes
  // -------------------------------
  // This avoids stale closures while keeping the
  // debounced function identity stable
  useEffect(() => {
    latestCallbackRef.current = callback;
  }, [callback]);

  // 🧠 -------------------------------
  // 🕒 Stable Debounced Function
  // -------------------------------
  // The function identity only changes if `delay` changes
  const debouncedCallback = useCallback(
    (...args: Parameters<F>) => {

      // 🧹 Clear any pending timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // ⏳ Schedule execution with debounce delay
      timeoutRef.current = setTimeout(() => {
        latestCallbackRef.current(...args);
      }, delay);
    },
    [delay]
  );

  // 🧹 -------------------------------
  // 🧼 Cleanup on Component Unmount
  // -------------------------------
  // Prevents memory leaks and delayed executions
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

// 🎯 ---------------------------
// 🔙 Return Debounced Function
// -------------------------------
  return debouncedCallback;
}
