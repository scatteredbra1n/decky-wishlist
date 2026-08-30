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
  const reviewLabel = item.review_score_label
    ? item.review_percent > 0
      ? `${item.review_percent}% ${item.review_score_label}`
      : item.review_score_label
    : "";

  return (
    <Focusable
      onActivate={openStore}
      onOKButton={openStore}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        display: "flex",
        gap: "10px",
        alignItems: "flex-start",
        background: focused ? colors.rowFocus : colors.row,
        border: `1px solid ${focused ? colors.focusRing : colors.border}`,
        boxShadow: focused ? `0 0 0 1px ${colors.focusRing}` : "none",
        borderRadius: "2px",
        padding: "8px",
        marginBottom: "8px",
        outline: "none",
        width: "100%",
        boxSizing: "border-box",
        transition: "background 120ms ease, border-color 120ms ease",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: "4px",
          flexShrink: 0,
          width: "96px",
        }}
      >
        <img
          src={item.capsule_url}
          alt=""
          loading="lazy"
          style={{
            width: "96px",
            height: "36px",
            objectFit: "cover",
            background: "#000",
            borderRadius: "1px",
          }}
          onError={(event) => {
            event.currentTarget.style.visibility = "hidden";
          }}
        />
        {compat ? (
          <span
            style={{
              color: deckCompatColor(item.deck_compat),
              fontSize: "10px",
              lineHeight: "12px",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            Deck: {compat}
          </span>
        ) : (
          <span style={{ color: colors.muted, fontSize: "10px", lineHeight: "12px" }}>
            Deck: —
          </span>
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          flex: 1,
          gap: "6px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
            width: "100%",
          }}
        >
          <div
            style={{
              color: colors.text,
              fontSize: "13px",
              fontWeight: 600,
              lineHeight: "16px",
              minWidth: 0,
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={item.name}
          >
            {item.name}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              flexShrink: 0,
              gap: "4px",
              maxWidth: "46%",
            }}
          >
            {item.discount_pct > 0 ? (
              <div style={{ display: "flex", alignItems: "stretch" }}>
                <div
                  style={{
                    background: colors.discountBg,
                    color: colors.discountFg,
                    fontWeight: 700,
                    fontSize: "12px",
                    padding: "3px 5px",
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
                  <span
                    style={{
                      color: colors.discountFg,
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  >
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
                  lineHeight: "16px",
                }}
              >
                {priceLabel || "—"}
              </span>
            )}

            <span
              style={{
                color: reviewLabel ? colors.accent : colors.muted,
                fontSize: "10px",
                lineHeight: "12px",
                textAlign: "right",
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {reviewLabel || "No reviews"}
            </span>
          </div>
        </div>
      </div>
    </Focusable>
  );
};
