"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProductView } from "@/lib/types";
import { ActivityFeed, type ActivityEntry } from "./ActivityFeed";
import { ConnectionStatus, type ConnectionState } from "./ConnectionStatus";
import { InventoryTable } from "./InventoryTable";
import { QuantityModal, type ActionKind } from "./QuantityModal";
import { StatCard } from "./StatCard";
import { Toast, type ToastState } from "./Toast";

interface DashboardProps {
  instanceName: string;
}

interface ModalState {
  product: ProductView;
  action: ActionKind;
}

const POLL_INTERVAL_MS = 5000;
const STALE_THRESHOLD_MS = 15000;
const ACTIVITY_MAX = 50;

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

function newActivityId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function Dashboard({ instanceName }: DashboardProps) {
  const [products, setProducts] = useState<ProductView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [modal, setModal] = useState<ModalState | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [lastSuccessAt, setLastSuccessAt] = useState<Date | null>(null);
  const [lastFetchOk, setLastFetchOk] = useState<boolean>(true);
  const [now, setNow] = useState<Date>(new Date());

  const [toast, setToast] = useState<ToastState | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);

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
      setLastFetchOk(true);
      setLastSuccessAt(new Date());
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      setLastFetchOk(false);
      setLoadError(
        err instanceof Error ? err.message : "Failed to load inventory",
      );
    }
  }, []);

  useEffect(() => {
    void fetchInventory();
    const pollId = setInterval(() => {
      void fetchInventory();
    }, POLL_INTERVAL_MS);
    const tickId = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearInterval(pollId);
      clearInterval(tickId);
      abortRef.current?.abort();
    };
  }, [fetchInventory]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  const connectionState: ConnectionState = useMemo(() => {
    if (!lastSuccessAt) return "connecting";
    const age = now.getTime() - lastSuccessAt.getTime();
    if (age > STALE_THRESHOLD_MS) return "stale";
    if (!lastFetchOk) return "reconnecting";
    return "live";
  }, [lastSuccessAt, lastFetchOk, now]);

  const stats = useMemo(() => {
    const list = products ?? [];
    const totalSkus = list.length;
    const totalOnHand = list.reduce((sum, p) => sum + p.onHand, 0);
    const totalReserved = list.reduce((sum, p) => sum + p.reserved, 0);
    const lowStockAlerts = list.filter(
      (p) => p.status === "LOW STOCK" || p.status === "OUT OF STOCK",
    ).length;
    return { totalSkus, totalOnHand, totalReserved, lowStockAlerts };
  }, [products]);

  const appendActivity = useCallback((entry: ActivityEntry) => {
    setActivity((prev) => [entry, ...prev].slice(0, ACTIVITY_MAX));
  }, []);

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
        const res = await fetch(
          `/api/inventory/${product.id}/${action}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ quantity }),
          },
        );
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
        const message =
          err instanceof Error ? err.message : "Action failed";
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

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="flex flex-col gap-4 border-b border-slate-800 pb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
              Product Inventory
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-50">
              {instanceName}{" "}
              <span className="text-slate-500">— Product Inventory</span>
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Standalone inventory instance. Auto-refreshes every 5 seconds.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-2 rounded-full bg-slate-800/80 px-3 py-1 text-xs font-medium text-slate-300 ring-1 ring-inset ring-slate-700"
              title="Set via INSTANCE_NAME env var. Read-only in the UI."
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5 text-slate-500"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V8a4 4 0 1 1 8 0v3" />
              </svg>
              Current Instance: {instanceName}
            </span>
            <ConnectionStatus state={connectionState} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>
            <span className="text-slate-500">Last refreshed:</span>{" "}
            <span className="text-slate-300 tabular-nums">
              {lastSuccessAt ? lastSuccessAt.toLocaleTimeString() : "—"}
            </span>
          </span>
          <span className="text-slate-700">·</span>
          <span>
            Polling every {Math.round(POLL_INTERVAL_MS / 1000)} s · stale after{" "}
            {Math.round(STALE_THRESHOLD_MS / 1000)} s
          </span>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total SKUs" value={stats.totalSkus} />
        <StatCard
          label="Total Units On Hand"
          value={stats.totalOnHand.toLocaleString()}
          tone="success"
        />
        <StatCard
          label="Total Reserved"
          value={stats.totalReserved.toLocaleString()}
        />
        <StatCard
          label="Low Stock Alerts"
          value={stats.lowStockAlerts}
          tone={stats.lowStockAlerts > 0 ? "warning" : "default"}
          hint={
            stats.lowStockAlerts > 0
              ? "Includes out-of-stock items"
              : "All SKUs healthy"
          }
        />
      </section>

      {loadError ? (
        <div className="mt-6 rounded-md bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-inset ring-rose-500/30">
          Failed to load inventory: {loadError}
        </div>
      ) : null}

      <section className="mt-6">
        {products === null && !loadError ? (
          <div className="rounded-xl bg-slate-900/40 px-4 py-12 text-center text-sm text-slate-500 ring-1 ring-slate-800">
            Loading inventory…
          </div>
        ) : (
          <InventoryTable
            products={products ?? []}
            onAction={handleAction}
          />
        )}
      </section>

      <section className="mt-6">
        <ActivityFeed entries={activity} />
      </section>

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
    </main>
  );
}
