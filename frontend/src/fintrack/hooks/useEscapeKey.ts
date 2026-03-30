// frontend/src/hooks/useEscapeKey.ts

import { useEffect } from "react";

/**
 * 🎯 Hook to trigger a callback when Escape key is pressed
 *
 * @param callback - Function to execute on Escape
 * @param isEnabled - Enable/disable listener (default true)
 */
export function useEscapeKey(
  callback: () => void,
  isEnabled: boolean = true
): void {
  useEffect(() => {
    if (!isEnabled) return;

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        callback();
      }
    };

    document.addEventListener("keydown", handleEscapeKey);

    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [callback, isEnabled]);
}
