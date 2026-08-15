import { useMemo } from "react";
import { Search, X, SlidersHorizontal } from "lucide-react";
import type { Complaint, Ward } from "@/lib/data";
import type { Priority, Status } from "@/lib/sla";

export type TicketFilterState = {
  q: string;
  wardId: string; // "all" or ward UUID
  status: string; // "all" or Status
  priority: string; // "all" or Priority
  department: string; // "all" or category string
};

export const EMPTY_FILTERS: TicketFilterState = {
  q: "",
  wardId: "all",
  status: "all",
  priority: "all",
  department: "all",
};

const STATUS_OPTIONS: { value: Status; en: string; ta: string }[] = [
  { value: "submitted", en: "Submitted", ta: "சமர்ப்பிக்கப்பட்டது" },
  { value: "assigned", en: "Assigned", ta: "ஒதுக்கப்பட்டது" },
  { value: "in_progress", en: "In progress", ta: "செயல்பாட்டில்" },
  { value: "verification", en: "Verification", ta: "சரிபார்ப்பு" },
  { value: "resolved", en: "Resolved", ta: "தீர்க்கப்பட்டது" },
  { value: "escalated", en: "Escalated", ta: "மேலெழுப்பப்பட்டது" },
  { value: "joint_task_force", en: "Joint task force", ta: "கூட்டுப் பணிக்குழு" },
  { value: "rejected", en: "Rejected", ta: "நிராகரிக்கப்பட்டது" },
];

const PRIORITY_OPTIONS: { value: Priority; en: string; ta: string }[] = [
  { value: "emergency", en: "Emergency", ta: "அவசரம்" },
  { value: "high", en: "High", ta: "அதிக" },
  { value: "medium", en: "Medium", ta: "நடுத்தர" },
  { value: "low", en: "Low", ta: "குறைந்த" },
];

export function applyTicketFilters(
  items: Complaint[],
  filters: TicketFilterState,
): Complaint[] {
  const q = filters.q.trim().toLowerCase();
  return items.filter((c) => {
    if (filters.wardId !== "all" && c.ward_id !== filters.wardId) return false;
    if (filters.status !== "all" && c.status !== filters.status) return false;
    if (filters.priority !== "all" && c.priority !== filters.priority) return false;
    if (filters.department !== "all" && c.category !== filters.department) return false;
    if (!q) return true;
    const hay = [
      c.title,
      c.description,
      c.author_pseudonym,
      c.category,
      c.street_address ?? "",
      c.assigned_officer ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export function TicketFilters({
  filters,
  onChange,
  wards,
  departments,
  lang,
  resultCount,
  totalCount,
}: {
  filters: TicketFilterState;
  onChange: (next: TicketFilterState) => void;
  wards: Ward[];
  departments: string[];
  lang: "en" | "ta";
  resultCount: number;
  totalCount: number;
}) {
  const activeCount = useMemo(() => {
    let n = 0;
    if (filters.q.trim()) n++;
    if (filters.wardId !== "all") n++;
    if (filters.status !== "all") n++;
    if (filters.priority !== "all") n++;
    if (filters.department !== "all") n++;
    return n;
  }, [filters]);

  const set = <K extends keyof TicketFilterState>(k: K, v: TicketFilterState[K]) =>
    onChange({ ...filters, [k]: v });
  const clear = () => onChange(EMPTY_FILTERS);

  const wardOptions = useMemo(
    () =>
      wards
        .slice()
        .sort((a, b) =>
          a.ulb_name_en.localeCompare(b.ulb_name_en) || a.ward_number - b.ward_number,
        ),
    [wards],
  );

  return (
    <section
      role="search"
      aria-label={lang === "ta" ? "வடிப்பான்கள்" : "Ticket filters"}
      className="civic-card space-y-3 p-3 sm:p-4"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <label className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 focus-within:border-primary">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={filters.q}
            onChange={(e) => set("q", e.target.value)}
            placeholder={
              lang === "ta"
                ? "தலைப்பு, பகுதி, அலுவலர் தேடு…"
                : "Search title, address, officer, category…"
            }
            className="min-w-0 bg-transparent text-sm outline-none"
            aria-label={lang === "ta" ? "தேடல்" : "Search tickets"}
          />
          {filters.q && (
            <button
              type="button"
              onClick={() => set("q", "")}
              aria-label={lang === "ta" ? "தேடலை அழி" : "Clear search"}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </label>
        <button
          type="button"
          onClick={clear}
          disabled={activeCount === 0}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold disabled:opacity-40"
        >
          <SlidersHorizontal className="size-3.5" />
          <span className="hidden sm:inline">{lang === "ta" ? "அழி" : "Reset"}</span>
          {activeCount > 0 && (
            <span className="grid size-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Select
          label={lang === "ta" ? "வார்டு" : "Ward"}
          value={filters.wardId}
          onChange={(v) => set("wardId", v)}
        >
          <option value="all" className="bg-card">
            {lang === "ta" ? "அனைத்து வார்டுகள்" : "All wards"}
          </option>
          {wardOptions.map((w) => (
            <option key={w.id} value={w.id} className="bg-card">
              W{w.ward_number} · {lang === "ta" ? w.ward_name_ta : w.ward_name_en} ·{" "}
              {lang === "ta" ? w.ulb_name_ta : w.ulb_name_en}
            </option>
          ))}
        </Select>

        <Select
          label={lang === "ta" ? "நிலை" : "Status"}
          value={filters.status}
          onChange={(v) => set("status", v)}
        >
          <option value="all" className="bg-card">
            {lang === "ta" ? "அனைத்து நிலைகள்" : "All statuses"}
          </option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value} className="bg-card">
              {lang === "ta" ? s.ta : s.en}
            </option>
          ))}
        </Select>

        <Select
          label={lang === "ta" ? "முன்னுரிமை" : "Priority"}
          value={filters.priority}
          onChange={(v) => set("priority", v)}
        >
          <option value="all" className="bg-card">
            {lang === "ta" ? "அனைத்து முன்னுரிமை" : "All priorities"}
          </option>
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p.value} value={p.value} className="bg-card">
              {lang === "ta" ? p.ta : p.en}
            </option>
          ))}
        </Select>

        <Select
          label={lang === "ta" ? "துறை" : "Department"}
          value={filters.department}
          onChange={(v) => set("department", v)}
        >
          <option value="all" className="bg-card">
            {lang === "ta" ? "அனைத்து துறைகள்" : "All departments"}
          </option>
          {departments.map((d) => (
            <option key={d} value={d} className="bg-card">
              {d}
            </option>
          ))}
        </Select>
      </div>

      <p className="text-[11px] text-muted-foreground" aria-live="polite">
        {lang === "ta"
          ? `${totalCount} இல் ${resultCount} புகார்கள் காட்டப்படுகின்றன`
          : `Showing ${resultCount} of ${totalCount} tickets`}
      </p>
    </section>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-input bg-background px-2.5 py-2 text-xs font-semibold outline-none focus:border-primary"
        aria-label={label}
      >
        {children}
      </select>
    </label>
  );
}
