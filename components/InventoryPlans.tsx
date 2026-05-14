"use client";

import { useMemo } from "react";
import type { ProductView, InventoryStatus } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import type { ActionKind } from "./QuantityModal";

export type StatusFilter = "ALL" | InventoryStatus;

interface InventoryPlansProps {
  products: ProductView[];
  loading: boolean;
  filter: StatusFilter;
  expanded: boolean;
  onAction: (product: ProductView, action: ActionKind) => void;
  onToggleExpand: () => void;
}

export function InventoryPlans({
  products,
  loading,
  filter,
  expanded,
  onAction,
  onToggleExpand,
}: InventoryPlansProps) {
  const filtered = useMemo(() => {
    if (filter === "ALL") return products;
    return products.filter((p) => p.status === filter);
  }, [products, filter]);

  const max =
    products.reduce((m, p) => Math.max(m, p.onHand + p.reserved), 0) || 1;

  const visible = expanded ? filtered : filtered.slice(0, 6);

  return (
    <section
      id="inventory-plans"
      className="h-full rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100"
    >
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Inventory
          </p>
          <h2 className="text-lg font-semibold text-gray-900">Inventory Plans</h2>
          {filter !== "ALL" ? (
            <p className="mt-0.5 text-xs text-gray-400">
              Filtered to <span className="font-medium text-teal-600">{filter}</span>
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onToggleExpand}
          className="inline-flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 rounded"
        >
          {expanded ? "Show less" : "View detail"}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`}
            aria-hidden
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </header>

      {loading && products.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400">
          Loading inventory…
        </div>
      ) : null}

      <ul className="divide-y divide-gray-100">
        {visible.map((p) => {
          const total = p.onHand + p.reserved;
          const pct = max > 0 ? Math.min(100, Math.round((total / max) * 100)) : 0;
          const isLow = p.status === "LOW STOCK" || p.status === "OUT OF STOCK";
          return (
            <li key={p.id} className="py-3.5">
              <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-gray-900">
                      {p.name}
                    </span>
                    <span className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
                      {p.sku}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">{p.category}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-teal-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-20 text-right text-xs tabular-nums text-gray-500">
                      {p.onHand} / {total}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <StatusBadge
                    status={p.status}
                    onClick={isLow ? () => onAction(p, "restock") : undefined}
                  />
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => onAction(p, "reserve")}
                      className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    >
                      Reserve
                    </button>
                    <button
                      type="button"
                      onClick={() => onAction(p, "release")}
                      className="rounded-md bg-gray-100 px-2 py-1 text-[10px] font-medium text-gray-700 hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                    >
                      Release
                    </button>
                    <button
                      type="button"
                      onClick={() => onAction(p, "restock")}
                      className="rounded-md bg-teal-50 px-2 py-1 text-[10px] font-medium text-teal-700 hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                    >
                      Restock
                    </button>
                    <button
                      type="button"
                      onClick={() => onAction(p, "adjust")}
                      className="rounded-md bg-white px-2 py-1 text-[10px] font-medium text-gray-700 ring-1 ring-inset ring-gray-200 hover:bg-gray-50 hover:text-teal-700 hover:ring-teal-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                    >
                      Adjust
                    </button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
        {!loading && filtered.length === 0 ? (
          <li className="py-10 text-center text-sm text-gray-400">
            {filter === "ALL"
              ? "No products in inventory."
              : `No products match the ${filter} filter.`}
          </li>
        ) : null}
      </ul>
      {filtered.length > 6 ? (
        <p className="mt-3 text-center text-xs text-gray-400">
          {expanded
            ? `Showing all ${filtered.length}`
            : `Showing 6 of ${filtered.length}`}
        </p>
      ) : null}
    </section>
  );
}
