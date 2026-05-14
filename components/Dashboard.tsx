"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProductView } from "@/lib/types";
import { ActivityFeed, type ActivityEntry } from "./ActivityFeed";
import { ApiKeyManager } from "./ApiKeyManager";
import { ComingSoon } from "./ComingSoon";
import { DonutChart } from "./DonutChart";
import { FilterDropdown } from "./FilterDropdown";
import { InventoryPlans, type StatusFilter } from "./InventoryPlans";
import { MetricCard } from "./MetricCard";
import { QuantityModal, type ActionKind } from "./QuantityModal";
import { Toast, type ToastState } from "./Toast";
import { TopNav, type NavView } from "./TopNav";
import { TopProducts } from "./TopProducts";

interface DashboardProps {
  instanceName: string;
}

interface ModalState {
  product: ProductView;
  action: ActionKind;
  defaultQuantity?: number;
}

const POLL_INTERVAL_MS = 5000;
const ACTIVITY_MAX = 50;

const actionVerbPast: Record<ActionKind, string> = {
  reserve: "Reserved",
  release: "Released",
  restock: "Restocked",
  adjust: "Adjusted",
};

const actionVerbFail: Record<ActionKind, string> = {
  reserve: "Reserve failed",
  release: "Release failed",
  restock: "Restock failed",
  adjust: "Adjust failed",
};

function newActivityId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const COMING_SOON_COPY: Record<
  Exclude<NavView, "dashboard">,
  { title: string; description: string }
> = {
  products: {
    title: "Products — coming soon",
    description:
      "A full product catalog editor with bulk upload, variants, and pricing rules.",
  },
  sales: {
    title: "Sales — coming soon",
    description:
      "Sales orders, channel breakdowns, and revenue trend reporting will live here.",
  },
  purchase: {
    title: "Purchase — coming soon",
    description:
      "Purchase orders, supplier management, and incoming-stock forecasting.",
  },
  "inventory-plan": {
    title: "Inventory Plan — coming soon",
    description:
      "Demand forecasting and automated reorder suggestions based on historical movement.",
  },
};

function scrollToInventory() {
  const el = document.getElementById("inventory-plans");
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function Dashboard({ instanceName }: DashboardProps) {
  const [products, setProducts] = useState<ProductView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [view, setView] = useState<NavView>("dashboard");
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [expanded, setExpanded] = useState(false);

  const [modal, setModal] = useState<ModalState | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [toast, setToast] = useState<ToastState | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
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

  const filterCounts: Record<StatusFilter, number> = useMemo(
    () => ({
      ALL: stats.totalItems,
      OK: stats.inStock,
      "LOW STOCK": stats.lowOnly,
      "OUT OF STOCK": stats.outOnly,
    }),
    [stats],
  );

  const appendActivity = useCallback((entry: ActivityEntry) => {
    setActivity((prev) => [entry, ...prev].slice(0, ACTIVITY_MAX));
  }, []);

  const handleAction = useCallback(
    (product: ProductView, action: ActionKind) => {
      setActionError(null);
      setModal({
        product,
        action,
        defaultQuantity: action === "adjust" ? product.onHand : undefined,
      });
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

        appendActivity({
          id: newActivityId(),
          timestamp: new Date(),
          action,
          productName: product.name,
          sku: product.sku,
          quantity,
          result: "success",
        });
        setToast({
          id: Date.now(),
          kind: "success",
          message: `${actionVerbPast[action]} ${quantity} × ${product.name}.`,
        });
        setModal(null);
        void fetchInventory();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Action failed";
        appendActivity({
          id: newActivityId(),
          timestamp: new Date(),
          action,
          productName: product.name,
          sku: product.sku,
          quantity,
          result: "failure",
          message,
        });
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
    [modal, fetchInventory, appendActivity],
  );

  const handleViewLowStock = useCallback(() => {
    setFilter("LOW STOCK");
    setExpanded(true);
    setTimeout(scrollToInventory, 50);
  }, []);

  const handleViewToBeOrdered = useCallback(() => {
    setFilter("LOW STOCK");
    setExpanded(true);
    setTimeout(scrollToInventory, 50);
  }, []);

  const handleViewAll = useCallback(() => {
    setFilter("ALL");
    setExpanded(true);
    setTimeout(scrollToInventory, 50);
  }, []);

  return (
    <div>
      <TopNav
        instanceName={instanceName}
        currentView={view}
        onChangeView={(v) => {
          setView(v);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onOpenApiKeys={() => setApiKeysOpen(true)}
      />

      <main className="mx-auto max-w-7xl px-6 py-6">
        {view !== "dashboard" ? (
          <>
            <div className="mb-6 flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {view.replace("-", " ")}
              </p>
              <h1 className="text-2xl font-bold capitalize text-gray-900">
                {view.replace("-", " ")}
              </h1>
            </div>
            <ComingSoon
              title={COMING_SOON_COPY[view].title}
              description={COMING_SOON_COPY[view].description}
              onBack={() => setView("dashboard")}
            />
          </>
        ) : (
          <>
            <div className="mb-6 flex items-end justify-between gap-3">
              <div className="flex flex-col gap-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Overview
                </p>
                <h1 className="text-2xl font-bold text-gray-900">
                  {instanceName} Dashboard
                </h1>
              </div>
              <FilterDropdown
                value={filter}
                counts={filterCounts}
                onChange={setFilter}
              />
            </div>

            {loadError ? (
              <div className="mb-6 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
                Failed to load inventory: {loadError}
              </div>
            ) : null}

            <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Total Items"
                value={stats.totalItems}
                onViewDetail={handleViewAll}
              />
              <MetricCard
                label="Low-Stock Alerts"
                value={stats.lowStockAlerts}
                hint={
                  stats.lowStockAlerts > 0 ? "Needs attention" : "All healthy"
                }
                onViewDetail={handleViewLowStock}
              />
              <MetricCard
                label="To Be Delivered"
                value={stats.toBeDelivered}
                hint="Reserved units"
                onViewDetail={handleViewAll}
              />
              <MetricCard
                label="To Be Ordered"
                value={stats.toBeOrdered}
                hint="At/below reorder point"
                onViewDetail={handleViewToBeOrdered}
              />
            </section>

            <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <InventoryPlans
                  products={products ?? []}
                  loading={products === null}
                  filter={filter}
                  expanded={expanded}
                  onAction={handleAction}
                  onToggleExpand={() => setExpanded((v) => !v)}
                />
              </div>
              <div className="flex flex-col gap-4 lg:col-span-2">
                <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
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
                      { label: "In Stock", value: stats.inStock, hex: "#14b8a6" },
                      { label: "Low Stock", value: stats.lowOnly, hex: "#f59e0b" },
                      {
                        label: "Out of Stock",
                        value: stats.outOnly,
                        hex: "#ef4444",
                      },
                    ]}
                  />
                </section>
                <ActivityFeed entries={activity} />
              </div>
            </section>

            <section className="mb-6">
              <TopProducts
                products={products ?? []}
                onAction={handleAction}
                onViewAll={handleViewAll}
              />
            </section>
          </>
        )}
      </main>

      <QuantityModal
        open={modal !== null}
        action={modal?.action ?? "reserve"}
        productName={modal?.product.name ?? ""}
        sku={modal?.product.sku ?? ""}
        defaultQuantity={modal?.defaultQuantity}
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
