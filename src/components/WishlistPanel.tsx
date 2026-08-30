import {
  ButtonItem,
  DropdownItem,
  DropdownOption,
  PanelSection,
  PanelSectionRow,
  ToggleField,
} from "@decky/ui";
import { callable } from "@decky/api";
import { FC, useEffect, useMemo, useState } from "react";
import { FaSyncAlt } from "react-icons/fa";
import { SortMode, WishlistItem, WishlistResponse } from "../types";
import { WishlistItemRow } from "./WishlistItem";

const getWishlist = callable<
  [country_code?: string, language?: string, force_refresh?: boolean],
  WishlistResponse
>("get_wishlist");

const SORT_OPTIONS: DropdownOption[] = [
  { data: "priority", label: "Your priority" },
  { data: "date", label: "Date added" },
  { data: "discount", label: "Discount" },
  { data: "price", label: "Price" },
  { data: "name", label: "Name" },
];

function parsePriceCents(value: string | null | undefined, isFree: boolean): number {
  if (isFree) return 0;
  if (!value) return Number.POSITIVE_INFINITY;
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return Number.POSITIVE_INFINITY;
  return Number.parseInt(digits, 10);
}

function sortItems(items: WishlistItem[], mode: SortMode): WishlistItem[] {
  const copy = [...items];
  switch (mode) {
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "date":
      return copy.sort((a, b) => b.date_added - a.date_added);
    case "discount":
      return copy.sort((a, b) => b.discount_pct - a.discount_pct || a.name.localeCompare(b.name));
    case "price":
      return copy.sort((a, b) => {
        const pa = parsePriceCents(a.price, a.is_free);
        const pb = parsePriceCents(b.price, b.is_free);
        return pa - pb || a.name.localeCompare(b.name);
      });
    case "priority":
    default:
      return copy.sort((a, b) => {
        const ap = a.priority === 0 ? Number.MAX_SAFE_INTEGER : a.priority;
        const bp = b.priority === 0 ? Number.MAX_SAFE_INTEGER : b.priority;
        return ap - bp || b.date_added - a.date_added || a.name.localeCompare(b.name);
      });
  }
}

export const WishlistPanel: FC = () => {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("priority");
  const [onSaleOnly, setOnSaleOnly] = useState(false);
  const [count, setCount] = useState(0);

  const load = async (force = false) => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await getWishlist("US", "english", force);
      if (!result?.ok) {
        setItems([]);
        setCount(0);
        setError(result?.error || "Failed to load wishlist.");
        return;
      }
      setItems(result.items || []);
      setCount(result.count ?? result.items?.length ?? 0);
      if (result.message) setMessage(result.message);
    } catch (err) {
      setItems([]);
      setCount(0);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(false);
  }, []);

  const visible = useMemo(() => {
    const filtered = onSaleOnly
      ? items.filter((item) => item.discount_pct > 0)
      : items;
    return sortItems(filtered, sortMode);
  }, [items, onSaleOnly, sortMode]);

  const saleCount = useMemo(
    () => items.filter((item) => item.discount_pct > 0).length,
    [items],
  );

  return (
    <>
      <PanelSection title="Your Wishlist">
        <PanelSectionRow>
          <div
            style={{
              color: "#8f98a0",
              fontSize: "12px",
              marginBottom: "4px",
            }}
          >
            {loading
              ? "Loading wishlist…"
              : `${visible.length} shown${count ? ` · ${count} total` : ""}${
                  saleCount ? ` · ${saleCount} on sale` : ""
                }`}
          </div>
        </PanelSectionRow>

        <PanelSectionRow>
          <DropdownItem
            label="Sort by"
            rgOptions={SORT_OPTIONS}
            selectedOption={sortMode}
            onChange={(option) => setSortMode(option.data as SortMode)}
          />
        </PanelSectionRow>

        <PanelSectionRow>
          <ToggleField
            label="On sale only"
            checked={onSaleOnly}
            onChange={setOnSaleOnly}
          />
        </PanelSectionRow>

        <PanelSectionRow>
          <ButtonItem layout="below" onClick={() => void load(true)} disabled={loading}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
              <FaSyncAlt />
              {loading ? "Refreshing…" : "Refresh wishlist"}
            </span>
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Games">
        {error ? (
          <PanelSectionRow>
            <div style={{ color: "#ff7777", fontSize: "13px", lineHeight: "18px" }}>
              {error}
            </div>
          </PanelSectionRow>
        ) : null}

        {!loading && !error && message && visible.length === 0 ? (
          <PanelSectionRow>
            <div style={{ color: "#8f98a0", fontSize: "13px" }}>{message}</div>
          </PanelSectionRow>
        ) : null}

        {!loading && !error && visible.length === 0 && !message ? (
          <PanelSectionRow>
            <div style={{ color: "#8f98a0", fontSize: "13px" }}>
              {onSaleOnly ? "No wishlisted games are on sale." : "No wishlist items found."}
            </div>
          </PanelSectionRow>
        ) : null}

        {visible.map((item) => (
          <PanelSectionRow key={item.appid}>
            <WishlistItemRow item={item} />
          </PanelSectionRow>
        ))}
      </PanelSection>
    </>
  );
};
