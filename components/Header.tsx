"use client";

export type SortKey = "name" | "quantity" | "reserved" | "status";

interface HeaderProps {
  instanceName: string;
  searchValue: string;
  onSearchChange: (v: string) => void;
  sortKey: SortKey;
  onSortChange: (key: SortKey) => void;
  onOpenApiKeys: () => void;
  onAddItem: () => void;
}

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name", label: "Name (A–Z)" },
  { value: "quantity", label: "Quantity (high → low)" },
  { value: "reserved", label: "Reserved (high → low)" },
  { value: "status", label: "Status" },
];

export function Header({
  instanceName,
  searchValue,
  onSearchChange,
  sortKey,
  onSortChange,
  onOpenApiKeys,
  onAddItem,
}: HeaderProps) {
  return (
    <header
      style={{
        height: 52,
        background: "#ffffff",
        borderBottom: "1px solid #f0f0f0",
        padding: "0 20px",
      }}
      className="sticky top-0 z-30 flex items-center"
    >
      <div className="flex items-center gap-2.5">
        <div
          style={{
            width: 28,
            height: 28,
            background: "#c0392b",
            color: "#ffffff",
            borderRadius: 6,
            fontWeight: 700,
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          aria-hidden
        >
          O
        </div>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>
            OpenPrem
          </span>
          <span style={{ fontSize: 11, color: "#888" }}>
            Product Inventory · {instanceName}
          </span>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <input
          type="search"
          placeholder="Search products by name or SKU…"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: 220,
            border: "1.5px solid #f0f0f0",
            borderRadius: 20,
            background: "#fafafa",
            padding: "6px 14px",
            fontSize: 12,
            color: "#1a1a1a",
            outline: "none",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "#e0e0e0")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "#f0f0f0")}
        />
        <select
          value={sortKey}
          onChange={(e) => onSortChange(e.target.value as SortKey)}
          style={{
            border: "1.5px solid #f0f0f0",
            background: "#fafafa",
            color: "#444",
            padding: "6px 12px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
            outline: "none",
          }}
          aria-label="Sort by"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              Sort: {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onOpenApiKeys}
          title="Manage API keys"
          style={{
            border: "1.5px solid #f0f0f0",
            background: "#fafafa",
            color: "#666",
            padding: "6px 14px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="7.5" cy="15.5" r="5.5" />
            <path d="m21 2-9.6 9.6" />
            <path d="m15.5 7.5 3 3L22 7l-3-3" />
          </svg>
          API Keys
        </button>
        <button
          type="button"
          onClick={onAddItem}
          style={{
            border: "none",
            background: "#c0392b",
            color: "#ffffff",
            padding: "6px 14px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          + Add Item
        </button>
      </div>
    </header>
  );
}
