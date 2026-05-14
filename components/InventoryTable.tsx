"use client";

import type { ProductView } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import type { ActionKind } from "./QuantityModal";

interface InventoryTableProps {
  products: ProductView[];
  onAction: (product: ProductView, action: ActionKind) => void;
}

const rowTone: Record<ProductView["status"], string> = {
  OK: "hover:bg-slate-800/40",
  "LOW STOCK": "bg-amber-500/5 hover:bg-amber-500/10",
  "OUT OF STOCK": "bg-rose-500/5 hover:bg-rose-500/10",
};

export function InventoryTable({ products, onAction }: InventoryTableProps) {
  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-slate-800 bg-slate-900/40">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th scope="col" className="px-4 py-3 text-left font-medium">SKU</th>
              <th scope="col" className="px-4 py-3 text-left font-medium">Product</th>
              <th scope="col" className="px-4 py-3 text-left font-medium">Category</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">On Hand</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Reserved</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Available</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Reorder ≤</th>
              <th scope="col" className="px-4 py-3 text-left font-medium">Status</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {products.map((p) => (
              <tr key={p.id} className={`transition-colors ${rowTone[p.status]}`}>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-300">
                  {p.sku}
                </td>
                <td className="px-4 py-3 text-slate-100">{p.name}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                  {p.category}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-200">
                  {p.onHand}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-400">
                  {p.reserved}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums font-medium text-slate-100">
                  {p.available}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-500">
                  {p.reorderThreshold}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusBadge status={p.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <div className="inline-flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => onAction(p, "reserve")}
                      className="rounded-md bg-sky-500/10 px-2.5 py-1.5 text-xs font-medium text-sky-300 ring-1 ring-inset ring-sky-500/30 hover:bg-sky-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                      Reserve
                    </button>
                    <button
                      type="button"
                      onClick={() => onAction(p, "release")}
                      className="rounded-md bg-indigo-500/10 px-2.5 py-1.5 text-xs font-medium text-indigo-300 ring-1 ring-inset ring-indigo-500/30 hover:bg-indigo-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                    >
                      Release
                    </button>
                    <button
                      type="button"
                      onClick={() => onAction(p, "restock")}
                      className="rounded-md bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30 hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      Restock
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-12 text-center text-sm text-slate-500"
                >
                  No products in inventory.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
