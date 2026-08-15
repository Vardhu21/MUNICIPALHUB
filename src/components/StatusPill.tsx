import { STATUS_TONE, PRIORITY_TONE, type Status, type Priority } from "@/lib/sla";
import { STATUS_LABEL, PRIORITY_LABEL, useLang } from "@/lib/i18n";

export function StatusPill({ status }: { status: Status }) {
  const { lang } = useLang();
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[status]}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]?.[lang] ?? status}
    </span>
  );
}

export function PriorityPill({ priority }: { priority: Priority }) {
  const { lang } = useLang();
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${PRIORITY_TONE[priority]}`}
    >
      {PRIORITY_LABEL[priority]?.[lang] ?? priority}
    </span>
  );
}
