import { useEffect, useState } from "react";

/**
 * Returns a debounced copy of the input value. Useful for filter inputs,
 * search boxes, and map viewport changes that should not fire queries
 * on every keystroke / pan.
 */
export function useDebouncedValue<T>(value: T, delayMs: number = 200): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}
