import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "citizen"
  | "field_officer"
  | "zonal_commissioner"
  | "commissioner"
  | "councillor"
  | "admin";

export const ROLE_LABEL: Record<AppRole, { en: string; ta: string }> = {
  citizen: { en: "Citizen", ta: "குடிமகன்" },
  field_officer: { en: "Field Officer (SI / AE)", ta: "கள அலுவலர் (SI / AE)" },
  zonal_commissioner: { en: "Zonal Assistant Commissioner", ta: "மண்டல உதவி ஆணையர்" },
  commissioner: { en: "Corporation Commissioner (IAS)", ta: "மாநகராட்சி ஆணையர் (IAS)" },
  councillor: { en: "Ward Councillor", ta: "வார்டு கவுன்சிலர்" },
  admin: { en: "Portal Administrator", ta: "தள நிர்வாகி" },
};

export const ALL_ROLES: AppRole[] = [
  "citizen",
  "field_officer",
  "zonal_commissioner",
  "commissioner",
  "councillor",
  "admin",
];

export type Profile = {
  id: string;
  pseudonym: string;
  ward_id: string | null;
  language: string;
  digilocker_verified: boolean;
  frozen: boolean;
};

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { user, loading };
}

const ROLE_KEY = "tnsm-active-role";

export function readActiveRole(): AppRole {
  if (typeof window === "undefined") return "citizen";
  const v = window.localStorage.getItem(ROLE_KEY);
  return (ALL_ROLES as string[]).includes(v ?? "") ? (v as AppRole) : "citizen";
}

export function writeActiveRole(role: AppRole) {
  window.localStorage.setItem(ROLE_KEY, role);
  window.dispatchEvent(new CustomEvent("tnsm-role-change", { detail: role }));
}

export function useActiveRole(): [AppRole, (r: AppRole) => void] {
  const [role, setRole] = useState<AppRole>("citizen");

  useEffect(() => {
    setRole(readActiveRole());
    const handler = (e: Event) => setRole((e as CustomEvent<AppRole>).detail);
    window.addEventListener("tnsm-role-change", handler);
    return () => window.removeEventListener("tnsm-role-change", handler);
  }, []);

  return [role, writeActiveRole];
}

/** Deterministic pseudonym suggestion, e.g. @CivicGuard_42 */
export function suggestPseudonym() {
  const words = [
    "CivicGuard",
    "WardWatch",
    "NagarVoice",
    "UrbanSentinel",
    "Kaaval",
    "TownPulse",
    "StreetScribe",
    "MunicipalEye",
  ];
  const w = words[Math.floor(Math.random() * words.length)];
  return `@${w}_${Math.floor(Math.random() * 90 + 10)}`;
}
