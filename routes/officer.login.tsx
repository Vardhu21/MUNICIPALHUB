import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/officer/login")({
  head: () => ({
    meta: [
      { title: "Redirecting — Unified DigiLocker Gateway" },
      {
        name: "description",
        content:
          "The separate officer login has been merged into the unified DigiLocker gateway. Redirecting…",
      },
    ],
  }),
  component: OfficerLoginRedirect,
});

function OfficerLoginRedirect() {
  // Unified DigiLocker gateway now auto-detects officers via 11-digit IFHRMS code.
  return <Navigate to="/auth" replace />;
}
