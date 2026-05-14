"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProductView } from "@/lib/types";
import { ApiKeyManager } from "./ApiKeyManager";
import { DonutChart } from "./DonutChart";
import { InventoryPlans } from "./InventoryPlans";
import { MetricCard } from "./MetricCard";
import { QuantityModal, type ActionKind } from "./QuantityModal";
import { Toast, type ToastState } from "./Toast";
import { TopNav } from "./TopNav";
import { TopProducts } from "./TopProducts";

interface DashboardProps {
  instanceName: string;
}

interface ModalState {
  product: ProductView;
  action: ActionKind;
}

const POLL_INTERVAL_MS = 5000;

const actionVerbPast: Record<ActionKind, string> = {
  reserve: "Reserved",
  release: "Released",
  restock: "Restocked",
};

const actionVerbFail: Record<ActionKind, string> = {
  reserve: "Reserve failed",
  release: "Release failed",
  restock: "Restock failed",
};

export function Dashboard({ instanceName }: DashboardProps) {
  const [products, setProducts] = useState<ProductView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [modal, setModal] = useState<ModalState | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [toast, setToast] = useState<ToastState | null>(null);
  const [apiKeysOpen, setApiKeysOpen] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const fetchInventory = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/inventory", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const data: ProductView[] = await res.json();
      setProducts(data);
      setLoadError(null);
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      setLoadError(
        err instanceof Error ? err.message : "Failed to load inventory",
      );
    }
  }, []);

  useEffect(() => {
    void fetchInventory();
    const id = setInterval(() => {
      void fetchInventory();
    }, POLL_INTERVAL_MS);
    return () => {
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [fetchInventory]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  const stats = useMemo(() => {
    const list = products ?? [];
    const totalItems = list.length;
    const lowStockAlerts = list.filter(
      (p) => p.status === "LOW STOCK" || p.status === "OUT OF STOCK",
    ).length;
    const toBeDelivered = list.reduce((sum, p) => sum + p.reserved, 0);
    const toBeOrdered = list.filter(
      (p) => p.onHand <= p.reorderThreshold,
    ).length;
    const inStock = list.filter((p) => p.status === "OK").length;
    const lowOnly = list.filter((p) => p.status === "LOW STOCK").length;
    const outOnly = list.filter((p) => p.status === "OUT OF STOCK").length;
    return {
      totalItems,
      lowStockAlerts,
      toBeDelivered,
      toBeOrdered,
      inStock,
      lowOnly,
      outOnly,
    };
  }, [products]);

  const handleAction = useCallback(
    (product: ProductView, action: ActionKind) => {
      setActionError(null);
      setModal({ product, action });
    },
    [],
  );

  const handleCloseModal = useCallback(() => {
    if (actionBusy) return;
    setModal(null);
    setActionError(null);
  }, [actionBusy]);

  const handleSubmit = useCallback(
    async (quantity: number) => {
      if (!modal) return;
      setActionBusy(true);
      setActionError(null);

      const { product, action } = modal;

      try {
        const res = await fetch(`/api/inventory/${product.id}/${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity }),
        });
        const body = (await res.json().catch(() => null)) as
          | { success?: boolean; error?: string; product?: ProductView }
          | null;
        const ok = res.ok && body?.success === true;

        if (!ok) {
          throw new Error(body?.error ?? `Request failed (HTTP ${res.status})`);
        }

        setToast({
          id: Date.now(),
          kind: "success",
          message: `${actionVerbPast[action]} ${quantity} × ${product.name}.`,
        });
        setModal(null);
        void fetchInventory();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Action failed";
        setActionError(message);
        setToast({
          id: Date.now(),
          kind: "error",
          message: `${actionVerbFail[action]}: ${message}`,
        });
      } finally {
        setActionBusy(false);
      }
    },
    [modal, fetchInventory],
  );

  return (
    <div>
      <TopNav
        instanceName={instanceName}
        onOpenApiKeys={() => setApiKeysOpen(true)}
      />

      <main className="mx-auto max-w-7xl px-6 py-6">
        <div className="mb-6 flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Overview
          </p>
          <h1 className="text-2xl font-bold text-gray-900">
            {instanceName} Dashboard
          </h1>
        </div>

        {loadError ? (
          <div className="mb-6 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
            Failed to load inventory: {loadError}
          </div>
        ) : null}

        <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Total Items" value={stats.totalItems} />
          <MetricCard
            label="Low-Stock Alerts"
            value={stats.lowStockAlerts}
            hint={stats.lowStockAlerts > 0 ? "Needs attention" : "All healthy"}
          />
          <MetricCard
            label="To Be Delivered"
            value={stats.toBeDelivered}
            hint="Reserved units"
          />
          <MetricCard
            label="To Be Ordered"
            value={stats.toBeOrdered}
            hint="At/below reorder point"
          />
        </section>

        <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <InventoryPlans
              products={products ?? []}
              loading={products === null}
              onAction={handleAction}
            />
          </div>
          <div className="lg:col-span-2">
            <section className="h-full rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <header className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Distribution
                  </p>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Warehouse Detail
                  </h2>
                </div>
              </header>
              <DonutChart
                total={stats.totalItems}
                centerLabel="SKUs"
                slices={[
                  {
                    label: "In Stock",
                    value: stats.inStock,
                    hex: "#14b8a6",
                  },
                  {
                    label: "Low Stock",
                    value: stats.lowOnly,
                    hex: "#f59e0b",
                  },
                  {
                    label: "Out of Stock",
                    value: stats.outOnly,
                    hex: "#ef4444",
                  },
                ]}
              />
            </section>
          </div>
        </section>

        <section className="mb-6">
          <TopProducts products={products ?? []} />
        </section>
      </main>

      <QuantityModal
        open={modal !== null}
        action={modal?.action ?? "reserve"}
        productName={modal?.product.name ?? ""}
        sku={modal?.product.sku ?? ""}
        busy={actionBusy}
        errorMessage={actionError}
        onCancel={handleCloseModal}
        onSubmit={handleSubmit}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />

      <ApiKeyManager
        open={apiKeysOpen}
        onClose={() => setApiKeysOpen(false)}
      />
    </div>
  );
}
