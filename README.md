# Wishlist

A [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader) plugin that shows your Steam wishlist in the Quick Access side panel, styled like Steam’s store UI.

**Current release:** [v0.0.3-alpha](https://github.com/scatteredbra1n/decky-wishlist/releases/tag/v0.0.3-alpha)

## Features

- Loads the logged-in user’s Steam wishlist from the Deck
- Steam-style rows with capsule art, title, review score, Deck compatibility, and price/discount badges
- Sort by priority, date added, name, price, or discount
- Filter to items currently on sale
- Remembers sort/filter choices (and last wishlist snapshot) when closing and reopening the Quick Access menu
- Opens the Steam store page for a selected title
- Works with public wishlists; private wishlists use the local Steam session when available

## Install (alpha)

1. Install [Decky Loader](https://decky.xyz) on your Steam Deck.
2. Download `Wishlist-v0.0.3-alpha.zip` from the [Releases](https://github.com/scatteredbra1n/decky-wishlist/releases) page.
3. In Decky → Developer → **Install plugin from zip**, select the downloaded zip.
4. Open the Quick Access menu → Decky → **Wishlist**.

## Develop

```bash
pnpm i
pnpm run build
```

The built frontend lands in `dist/index.js`. Zip the plugin folder (with `dist/`, `main.py`, `package.json`, `plugin.json`, and `LICENSE`) for installation.

Tagged releases (`v*`) are built by GitHub Actions and published automatically under [Releases](https://github.com/scatteredbra1n/decky-wishlist/releases).

## How it works

1. The Python backend resolves your SteamID64 from local Steam userdata / `loginusers.vdf`.
2. It calls Steam’s `IWishlistService/GetWishlist` endpoint.
3. Wishlist app IDs are enriched in batches via `IStoreBrowseService/GetItems` (name, assets, price, platforms, reviews).
4. The React frontend renders a compact Steam-like list inside the Decky side panel.

## License

BSD-3-Clause
