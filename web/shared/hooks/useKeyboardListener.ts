import { useEffect } from "react";

export interface KeyboardListenerOptions {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  preventDefault?: boolean;
  /** When true, matches either metaKey OR ctrlKey (useful for cross-platform Cmd/Ctrl shortcuts) */
  metaOrCtrl?: boolean;
}

export function useKeyboardListener(
  callback: () => void,
  options: KeyboardListenerOptions
) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const keyMatch = event.key === options.key;

      // Handle metaOrCtrl for cross-platform support
      if (options.metaOrCtrl) {
        const modifierMatch = event.metaKey || event.ctrlKey;
        const shiftMatch = options.shiftKey === undefined || event.shiftKey === options.shiftKey;
        const altMatch = options.altKey === undefined || event.altKey === options.altKey;

        if (keyMatch && modifierMatch && shiftMatch && altMatch) {
          if (options.preventDefault) {
            event.preventDefault();
          }
          callback();
        }
      } else {
        const metaMatch = options.metaKey === undefined || event.metaKey === options.metaKey;
        const ctrlMatch = options.ctrlKey === undefined || event.ctrlKey === options.ctrlKey;
        const shiftMatch = options.shiftKey === undefined || event.shiftKey === options.shiftKey;
        const altMatch = options.altKey === undefined || event.altKey === options.altKey;

        if (metaMatch && ctrlMatch && shiftMatch && altMatch && keyMatch) {
          if (options.preventDefault) {
            event.preventDefault();
          }
          callback();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [callback, options]);
}
