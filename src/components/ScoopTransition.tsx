import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

/**
 * Presentation-only wrapper: re-keys on pathname so each route change replays
 * the "ice-cream scoop" reveal. No routing or data behaviour is changed.
 */
export function ScoopTransition({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div key={pathname} className="animate-scoop-in">
      {children}
    </div>
  );
}
