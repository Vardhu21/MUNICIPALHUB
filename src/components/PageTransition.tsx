import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

/**
 * Presentation-only wrapper: re-keys on pathname so each route change plays a
 * short, calm fade + rise. No routing or data behaviour is changed.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div key={pathname} className="animate-page-in">
      {children}
    </div>
  );
}
