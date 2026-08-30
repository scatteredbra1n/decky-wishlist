import { Focusable, Navigation } from "@decky/ui";
import { FC, useState } from "react";
import { WishlistItem } from "../types";

const colors = {
  row: "#16202d",
  rowFocus: "#233142",
  text: "#c7d5e0",
  muted: "#8f98a0",
  accent: "#66c0f4",
  discountBg: "#4c6b22",
  discountFg: "#beee11",
  price: "#c6d4df",
  strike: "#738895",
  border: "rgba(255,255,255,0.06)",
  focusRing: "#1a9fff",
};

function deckCompatLabel(value: number): string {
  switch (value) {
    case 3:
      return "Verified";
    case 2:
      return "Playable";
    case 1:
      return "Unsupported";
    default:
      return "";
  }
}

function deckCompatColor(value: number): string {
  switch (value) {
    case 3:
      return "#59bf40";
    case 2:
      return "#ffc82c";
    case 1:
      return "#a34c25";
    default:
      return colors.muted;
  }
}

export const WishlistItemRow: FC<{ item: WishlistItem }> = ({ item }) => {
  const [focused, setFocused] = useState(false);

  const openStore = () => {
    Navigation.NavigateToSteamWeb(item.store_url);
    Navigation.CloseSideMenus();
  };

  const priceLabel = item.is_free
    ? "Free"
    : item.price || (item.is_coming_soon ? "Coming soon" : "");

  const compat = deckCompatLabel(item.deck_compat);

  return (
    <Focusable
      onActivate={openStore}
      onOKButton={openStore}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        display: "flex",
        gap: "10px",
        alignItems: "stretch",
        background: focused ? colors.rowFocus : colors.row,
        border: `1px solid ${focused ? colors.focusRing : colors.border}`,
        boxShadow: focused ? `0 0 0 1px ${colors.focusRing}` : "none",
        borderRadius: "2px",
        padding: "6px",
        marginBottom: "6px",
        outline: "none",
        transition: "background 120ms ease, border-color 120ms ease",
      }}
    >
      <img
        src={item.capsule_url}
        alt=""
        loading="lazy"
        style={{
          width: "92px",
          height: "35px",
          objectFit: "cover",
          flexShrink: 0,
          background: "#000",
          borderRadius: "1px",
        }}
        onError={(event) => {
          const img = event.currentTarget;
          img.style.visibility = "hidden";
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          minWidth: 0,
          flex: 1,
          gap: "2px",
        }}
      >
        <div
          style={{
            color: colors.text,
            fontSize: "13px",
            fontWeight: 600,
            lineHeight: "16px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.name}
        </div>

        <div
          style={{
            display: "flex",
            gap: "8px",
            alignItems: "center",
            color: colors.muted,
            fontSize: "11px",
            lineHeight: "14px",
            overflow: "hidden",
          }}
        >
          {item.review_score_label ? (
            <span style={{ color: colors.accent }}>
              {item.review_percent > 0
                ? `${item.review_percent}% · ${item.review_score_label}`
                : item.review_score_label}
            </span>
          ) : null}
          {compat ? (
            <span style={{ color: deckCompatColor(item.deck_compat) }}>
              Deck: {compat}
            </span>
          ) : null}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          flexShrink: 0,
          minWidth: "72px",
        }}
      >
        {item.discount_pct > 0 ? (
          <div style={{ display: "flex", alignItems: "stretch", gap: "0" }}>
            <div
              style={{
                background: colors.discountBg,
                color: colors.discountFg,
                fontWeight: 700,
                fontSize: "12px",
                padding: "4px 6px",
                display: "flex",
                alignItems: "center",
              }}
            >
              -{item.discount_pct}%
            </div>
            <div
              style={{
                background: "rgba(0,0,0,0.45)",
                padding: "2px 6px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "flex-end",
                lineHeight: "12px",
              }}
            >
              {item.original_price ? (
                <span
                  style={{
                    color: colors.strike,
                    textDecoration: "line-through",
                    fontSize: "10px",
                  }}
                >
                  {item.original_price}
                </span>
              ) : null}
              <span style={{ color: colors.discountFg, fontSize: "12px", fontWeight: 600 }}>
                {priceLabel}
              </span>
            </div>
          </div>
        ) : (
          <span
            style={{
              color: item.is_free ? colors.discountFg : colors.price,
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            {priceLabel || "—"}
          </span>
        )}
      </div>
    </Focusable>
  );
};
