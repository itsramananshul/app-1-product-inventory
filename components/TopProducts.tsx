"use client";

import type { ProductView } from "@/lib/types";

interface TopProductsProps {
  products: ProductView[];
}

export function TopProducts({ products }: TopProductsProps) {
  const top = [...products]
    .sort((a, b) => b.onHand - a.onHand)
    .slice(0, 6);

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Catalog
          </p>
          <h2 className="text-lg font-semibold text-gray-900">Top Products</h2>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700"
        >
          View all
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3 w-3"
            aria-hidden
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </header>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {top.map((p) => (
          <div
            key={p.id}
            className="rounded-lg border border-gray-100 bg-gray-50 p-3 transition-colors hover:border-teal-200 hover:bg-teal-50/50"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-white text-teal-600 shadow-sm">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-7 w-7"
                aria-hidden
              >
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </div>
            <p
              className="mt-3 truncate text-sm font-medium text-gray-900"
              title={p.name}
            >
              {p.name}
            </p>
            <p className="truncate font-mono text-[10px] text-gray-400">
              {p.sku}
            </p>
            <p className="mt-1.5 text-xs text-gray-500">
              <span className="font-medium text-gray-700">{p.onHand}</span> on hand
            </p>
          </div>
        ))}
        {top.length === 0 ? (
          <p className="col-span-full py-8 text-center text-sm text-gray-400">
            No products yet.
          </p>
        ) : null}
      </div>
    </section>
  );
}
