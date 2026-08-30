export type WishlistItem = {
  appid: number;
  priority: number;
  date_added: number;
  name: string;
  capsule_url: string;
  header_url: string;
  price: string | null;
  original_price: string | null;
  discount_pct: number;
  is_free: boolean;
  is_coming_soon: boolean;
  release_string: string;
  review_score_label: string;
  review_percent: number;
  deck_compat: number;
  windows: boolean;
  mac: boolean;
  linux: boolean;
  store_url: string;
};

export type WishlistResponse = {
  ok: boolean;
  items: WishlistItem[];
  count?: number;
  steamid?: string;
  authed?: boolean;
  country_code?: string;
  language?: string;
  error?: string;
  message?: string;
};

export type SortMode =
  | "priority"
  | "date"
  | "name"
  | "price"
  | "discount";
