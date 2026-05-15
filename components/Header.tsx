"use client";

interface HeaderProps {
  instanceName: string;
  searchValue: string;
  onSearchChange: (v: string) => void;
}

export function Header({ instanceName, searchValue, onSearchChange }: HeaderProps) {
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
          placeholder="Search products…"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: 200,
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
        <button
          type="button"
          style={{
            border: "1.5px solid #f0f0f0",
            background: "#fafafa",
            color: "#666",
            padding: "6px 14px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Filters
        </button>
        <button
          type="button"
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
