import { useEffect, useRef } from "react";

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
  const callbackRef = useRef(callback);
  const optionsRef = useRef(options);

  // Keep refs up to date
  useEffect(() => {
    callbackRef.current = callback;
    optionsRef.current = options;
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const opts = optionsRef.current;
      const keyMatch = event.key === opts.key;

      // Handle metaOrCtrl for cross-platform support
      if (opts.metaOrCtrl) {
        const modifierMatch = event.metaKey || event.ctrlKey;
        const shiftMatch = opts.shiftKey === undefined || event.shiftKey === opts.shiftKey;
        const altMatch = opts.altKey === undefined || event.altKey === opts.altKey;

        if (keyMatch && modifierMatch && shiftMatch && altMatch) {
          if (opts.preventDefault) {
            event.preventDefault();
          }
          callbackRef.current();
        }
      } else {
        const metaMatch = opts.metaKey === undefined || event.metaKey === opts.metaKey;
        const ctrlMatch = opts.ctrlKey === undefined || event.ctrlKey === opts.ctrlKey;
        const shiftMatch = opts.shiftKey === undefined || event.shiftKey === opts.shiftKey;
        const altMatch = opts.altKey === undefined || event.altKey === opts.altKey;

        if (metaMatch && ctrlMatch && shiftMatch && altMatch && keyMatch) {
          if (opts.preventDefault) {
            event.preventDefault();
          }
          callbackRef.current();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []); // Empty deps - only run once
}
