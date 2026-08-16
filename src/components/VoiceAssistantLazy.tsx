import { lazy, Suspense, useEffect, useState } from "react";

const Inner = lazy(() =>
  import("@/components/VoiceAssistant").then((m) => ({ default: m.VoiceAssistant })),
);

/**
 * Defers loading the assistant bundle until the page is idle, so first paint
 * is not blocked by it.
 */
export function VoiceAssistant() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const w = window as typeof window & {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setShow(true));
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(() => setShow(true), 1200);
    return () => window.clearTimeout(t);
  }, []);

  if (!show) return null;
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
