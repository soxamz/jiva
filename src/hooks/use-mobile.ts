import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const query = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

export function useIsMobile() {
  return React.useSyncExternalStore(
    (onStoreChange) => {
      const mediaQuery = window.matchMedia(query);
      mediaQuery.addEventListener("change", onStoreChange);

      return () => mediaQuery.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
