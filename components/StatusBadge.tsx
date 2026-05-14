import type { InventoryStatus } from "@/lib/types";

const styles: Record<InventoryStatus, string> = {
  OK: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  "LOW STOCK": "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  "OUT OF STOCK": "bg-rose-500/15 text-rose-300 ring-rose-500/30",
};

export function StatusBadge({ status }: { status: InventoryStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${styles[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
