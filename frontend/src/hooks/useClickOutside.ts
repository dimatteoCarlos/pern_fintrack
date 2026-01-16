//frontend/src/hooks/useClickOutside.ts
import { RefObject, useEffect } from "react";

/**
 * 🎯 Hook to detect clicks outside a referenced element
 *
 * @param ref - Element reference
 * @param callback - Function to execute on outside click
 * @param isEnabled - Enable/disable detection
 */
export function useClickOutside(
  ref: RefObject<HTMLElement>,
  callback: () => void,
  isEnabled: boolean = true
): void {
  useEffect(() => {
    if (!isEnabled) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [ref, callback, isEnabled]);
}
