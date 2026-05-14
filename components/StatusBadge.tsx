import type { InventoryStatus } from "@/lib/types";

const styles: Record<InventoryStatus, string> = {
  OK: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  "LOW STOCK": "bg-amber-50 text-amber-700 ring-amber-600/20",
  "OUT OF STOCK": "bg-rose-50 text-rose-700 ring-rose-600/20",
};

const labels: Record<InventoryStatus, string> = {
  OK: "In Stock",
  "LOW STOCK": "Low Stock",
  "OUT OF STOCK": "Out of Stock",
};

export function StatusBadge({ status }: { status: InventoryStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {labels[status]}
    </span>
  );
}
