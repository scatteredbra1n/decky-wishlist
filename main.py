import asyncio
import hashlib
import json
import os
import re
import sqlite3
import ssl
import urllib.error
import urllib.parse
import urllib.request
from subprocess import run as _sp_run
from typing import Any, Dict, List, Optional, Tuple

import decky

# SteamOS CA bundles can fail verification for steam.* hosts. Only first-party
# Steam endpoints are contacted, so disabling verification is intentional.
_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

_STEAM_ID64_BASE = 76561197960265728
_ASSET_CDN = "https://shared.akamai.steamstatic.com/store_item_assets/"
_USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
_BATCH_SIZE = 50
_CACHE_TTL_SECONDS = 300


def _steam_install_candidates() -> List[str]:
    home = decky.DECKY_USER_HOME or os.path.expanduser("~")
    candidates = [
        os.path.join(home, ".local", "share", "Steam"),
        os.path.join(home, ".steam", "steam"),
        os.path.join(home, ".steam", "root"),
        os.path.join(home, ".var", "app", "com.valvesoftware.Steam", ".local", "share", "Steam"),
        os.path.join(home, ".var", "app", "com.valvesoftware.Steam", "data", "Steam"),
    ]
    seen: set = set()
    out: List[str] = []
    for path in candidates:
        if path and path not in seen:
            seen.add(path)
            out.append(path)
    return out


def _http_get_json(url: str, timeout: int = 20) -> Dict[str, Any]:
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": _USER_AGENT,
        },
    )
    with urllib.request.urlopen(req, timeout=timeout, context=_SSL_CTX) as resp:
        body = resp.read().decode("utf-8")
        return json.loads(body) if body else {}


def _parse_vdf_simple(text: str) -> Dict[str, Any]:
    """Minimal VDF object parser for loginusers.vdf (string keys/values only)."""
    tokens = re.findall(r'"([^"]*)"|(\{)|(\})', text)
    stack: List[Dict[str, Any]] = [{}]
    key: Optional[str] = None

    for string, open_brace, close_brace in tokens:
        if string != "":
            if key is None:
                key = string
            else:
                stack[-1][key] = string
                key = None
        elif open_brace:
            if key is None:
                continue
            child: Dict[str, Any] = {}
            stack[-1][key] = child
            stack.append(child)
            key = None
        elif close_brace:
            if len(stack) > 1:
                stack.pop()
    return stack[0]


class Plugin:
    _cache: Optional[Dict[str, Any]] = None
    _cache_at: float = 0.0

    async def _main(self) -> None:
        decky.logger.info("Wishlist plugin loaded")

    async def _unload(self) -> None:
        decky.logger.info("Wishlist plugin unloaded")

    async def get_wishlist(
        self,
        country_code: str = "US",
        language: str = "english",
        force_refresh: bool = False,
    ) -> Dict[str, Any]:
        return await asyncio.to_thread(
            self._get_wishlist_sync,
            country_code or "US",
            language or "english",
            bool(force_refresh),
        )

    def _get_wishlist_sync(
        self,
        country_code: str,
        language: str,
        force_refresh: bool,
    ) -> Dict[str, Any]:
        import time

        now = time.time()
        if (
            not force_refresh
            and self._cache is not None
            and (now - self._cache_at) < _CACHE_TTL_SECONDS
        ):
            return dict(self._cache)

        steam_id64 = self._get_steam_id64()
        if not steam_id64:
            return {
                "ok": False,
                "error": "Could not determine SteamID64 from local Steam userdata.",
                "items": [],
            }

        try:
            wishlist_items, authed = self._fetch_wishlist_items(steam_id64)
        except Exception as exc:
            decky.logger.error(f"Wishlist fetch failed: {exc}")
            return {"ok": False, "error": str(exc), "items": [], "steamid": steam_id64}

        if not wishlist_items:
            result = {
                "ok": True,
                "items": [],
                "count": 0,
                "steamid": steam_id64,
                "authed": authed,
                "message": "Wishlist is empty or private.",
            }
            self._cache = result
            self._cache_at = now
            return dict(result)

        appids = [int(item["appid"]) for item in wishlist_items if item.get("appid")]
        details = self._fetch_store_details(appids, country_code, language)

        enriched: List[Dict[str, Any]] = []
        for entry in wishlist_items:
            appid = int(entry.get("appid") or 0)
            if not appid:
                continue
            detail = details.get(appid, {})
            enriched.append(
                {
                    "appid": appid,
                    "priority": int(entry.get("priority") or 0),
                    "date_added": int(entry.get("date_added") or 0),
                    "name": detail.get("name") or f"App {appid}",
                    "capsule_url": detail.get("capsule_url") or self._fallback_capsule(appid),
                    "header_url": detail.get("header_url") or "",
                    "price": detail.get("price"),
                    "original_price": detail.get("original_price"),
                    "discount_pct": int(detail.get("discount_pct") or 0),
                    "is_free": bool(detail.get("is_free")),
                    "is_coming_soon": bool(detail.get("is_coming_soon")),
                    "release_string": detail.get("release_string") or "",
                    "review_score_label": detail.get("review_score_label") or "",
                    "review_percent": int(detail.get("review_percent") or 0),
                    "deck_compat": int(detail.get("deck_compat") or 0),
                    "windows": bool(detail.get("windows")),
                    "mac": bool(detail.get("mac")),
                    "linux": bool(detail.get("linux")),
                    "store_url": f"https://store.steampowered.com/app/{appid}",
                }
            )

        # Steam wishlist priority: lower number = higher priority; 0 often means unset.
        enriched.sort(
            key=lambda item: (
                item["priority"] == 0,
                item["priority"],
                -item["date_added"],
                item["name"].lower(),
            )
        )

        result = {
            "ok": True,
            "items": enriched,
            "count": len(enriched),
            "steamid": steam_id64,
            "authed": authed,
            "country_code": country_code,
            "language": language,
        }
        self._cache = result
        self._cache_at = now
        return dict(result)

    def _fetch_wishlist_items(self, steam_id64: str) -> Tuple[List[Dict[str, Any]], bool]:
        base = (
            "https://api.steampowered.com/IWishlistService/GetWishlist/v1/"
            f"?steamid={urllib.parse.quote(steam_id64)}"
        )
        urls: List[Tuple[str, bool]] = [(base, False)]

        token = self._get_access_token()
        if token:
            urls.append((f"{base}&access_token={urllib.parse.quote(token)}", True))

        last_error: Optional[Exception] = None
        for url, authed in urls:
            try:
                data = _http_get_json(url)
                items = data.get("response", {}).get("items") or []
                if items or authed:
                    return items, authed
            except Exception as exc:
                last_error = exc
                continue

        if last_error:
            raise last_error
        return [], False

    def _fetch_store_details(
        self,
        appids: List[int],
        country_code: str,
        language: str,
    ) -> Dict[int, Dict[str, Any]]:
        out: Dict[int, Dict[str, Any]] = {}
        for i in range(0, len(appids), _BATCH_SIZE):
            batch = appids[i : i + _BATCH_SIZE]
            payload = {
                "ids": [{"appid": appid} for appid in batch],
                "context": {
                    "language": language,
                    "country_code": country_code.upper(),
                },
                "data_request": {
                    "include_assets": True,
                    "include_release": True,
                    "include_platforms": True,
                    "include_all_purchase_options": True,
                    "include_basic_info": True,
                    "include_reviews": True,
                },
            }
            url = (
                "https://api.steampowered.com/IStoreBrowseService/GetItems/v1/"
                f"?input_json={urllib.parse.quote(json.dumps(payload))}"
            )
            try:
                data = _http_get_json(url)
            except Exception as exc:
                decky.logger.error(f"GetItems batch failed: {exc}")
                continue

            for item in data.get("response", {}).get("store_items") or []:
                parsed = self._parse_store_item(item)
                if parsed:
                    out[parsed["appid"]] = parsed
        return out

    def _parse_store_item(self, item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        appid = item.get("appid") or item.get("id")
        if not appid:
            return None
        appid = int(appid)

        assets = item.get("assets") or {}
        fmt = assets.get("asset_url_format") or "steam/apps/{appid}/${FILENAME}"
        fmt = fmt.replace("{appid}", str(appid))

        def asset_url(filename: Optional[str]) -> str:
            if not filename:
                return ""
            path = fmt.replace("${FILENAME}", filename)
            return _ASSET_CDN + path

        capsule = (
            asset_url(assets.get("small_capsule_2x"))
            or asset_url(assets.get("small_capsule"))
            or asset_url(assets.get("header"))
            or self._fallback_capsule(appid)
        )
        header = asset_url(assets.get("header")) or asset_url(assets.get("main_capsule"))

        best = item.get("best_purchase_option") or {}
        discount_pct = int(best.get("discount_pct") or 0)
        final_price = best.get("formatted_final_price")
        original_price = best.get("formatted_original_price")
        is_free = bool(item.get("is_free"))
        if is_free and not final_price:
            final_price = "Free"

        release = item.get("release") or {}
        is_coming_soon = bool(release.get("is_coming_soon") or release.get("coming_soon"))
        release_string = ""
        if release.get("steam_release_date"):
            try:
                import datetime

                release_string = datetime.datetime.utcfromtimestamp(
                    int(release["steam_release_date"])
                ).strftime("%b %d, %Y")
            except Exception:
                release_string = ""
        if not release_string:
            release_string = (
                release.get("custom_release_date_message")
                or release.get("display_date")
                or ("Coming soon" if is_coming_soon else "")
            )

        reviews = ((item.get("reviews") or {}).get("summary_filtered")) or {}
        platforms = item.get("platforms") or {}

        return {
            "appid": appid,
            "name": item.get("name") or f"App {appid}",
            "capsule_url": capsule,
            "header_url": header,
            "price": "Free" if is_free and not final_price else final_price,
            "original_price": original_price,
            "discount_pct": discount_pct,
            "is_free": is_free,
            "is_coming_soon": is_coming_soon,
            "release_string": release_string,
            "review_score_label": reviews.get("review_score_label") or "",
            "review_percent": int(reviews.get("percent_positive") or 0),
            "deck_compat": int(platforms.get("steam_deck_compat_category") or 0),
            "windows": bool(platforms.get("windows")),
            "mac": bool(platforms.get("mac")),
            "linux": bool(platforms.get("steamos_linux") or platforms.get("linux")),
        }

    @staticmethod
    def _fallback_capsule(appid: int) -> str:
        return f"https://cdn.cloudflare.steamstatic.com/steam/apps/{appid}/capsule_231x87.jpg"

    def _get_steam_id64(self) -> Optional[str]:
        from_loginusers = self._steam_id64_from_loginusers()
        if from_loginusers:
            return from_loginusers
        return self._steam_id64_from_userdata()

    def _steam_id64_from_loginusers(self) -> Optional[str]:
        for root in _steam_install_candidates():
            path = os.path.join(root, "config", "loginusers.vdf")
            if not os.path.isfile(path):
                continue
            try:
                with open(path, "r", encoding="utf-8", errors="replace") as handle:
                    data = _parse_vdf_simple(handle.read())
                users = data.get("users") if isinstance(data.get("users"), dict) else data
                if not isinstance(users, dict):
                    continue

                most_recent: Optional[str] = None
                fallback: Optional[str] = None
                for steamid, info in users.items():
                    if not str(steamid).isdigit():
                        continue
                    fallback = str(steamid)
                    if isinstance(info, dict) and str(info.get("MostRecent", "0")) == "1":
                        most_recent = str(steamid)
                        break
                return most_recent or fallback
            except Exception as exc:
                decky.logger.warning(f"Failed reading {path}: {exc}")
        return None

    def _steam_id64_from_userdata(self) -> Optional[str]:
        for root in _steam_install_candidates():
            userdata = os.path.join(root, "userdata")
            if not os.path.isdir(userdata):
                continue
            try:
                candidates = [
                    name
                    for name in os.listdir(userdata)
                    if name.isdigit() and name != "0" and os.path.isdir(os.path.join(userdata, name))
                ]
                if not candidates:
                    continue
                # Prefer the account with the newest localconfig if multiple exist.
                candidates.sort(
                    key=lambda name: os.path.getmtime(
                        os.path.join(userdata, name, "config", "localconfig.vdf")
                    )
                    if os.path.exists(os.path.join(userdata, name, "config", "localconfig.vdf"))
                    else 0,
                    reverse=True,
                )
                return str(_STEAM_ID64_BASE + int(candidates[0]))
            except Exception as exc:
                decky.logger.warning(f"Failed scanning userdata at {userdata}: {exc}")
        return None

    def _get_access_token(self) -> str:
        raw = self._get_steam_cookie("steamLoginSecure")
        if not raw:
            return ""
        # Cookie format: steamid%7C%7Ctoken or steamid||token
        decoded = urllib.parse.unquote(raw)
        parts = decoded.split("||", 1)
        if len(parts) == 2 and parts[1].strip():
            return parts[1].strip()
        return ""

    def _get_steam_cookie(self, name: str) -> str:
        cookie_paths = [
            os.path.join(root, "config", "htmlcache", "Default", "Cookies")
            for root in _steam_install_candidates()
        ]
        for path in cookie_paths:
            if not os.path.exists(path):
                continue
            try:
                con = sqlite3.connect(f"file:{path}?immutable=1", uri=True, timeout=3)
                try:
                    cur = con.execute(
                        "SELECT encrypted_value FROM cookies "
                        "WHERE name=? AND (host_key LIKE '%steamcommunity%' "
                        "OR host_key LIKE '%steampowered%') LIMIT 1",
                        (name,),
                    )
                    row = cur.fetchone()
                finally:
                    con.close()
                if not row or not row[0]:
                    continue
                decrypted = self._decrypt_chromium_cookie(bytes(row[0]))
                if decrypted:
                    return decrypted
            except Exception:
                continue
        return ""

    def _decrypt_chromium_cookie(self, encrypted_value: bytes) -> str:
        try:
            if not encrypted_value:
                return ""
            if encrypted_value[:3] not in (b"v10", b"v11"):
                return encrypted_value.decode("utf-8", errors="replace")
            body = encrypted_value[3:]
            # Steam Deck / Linux Chromium without keyring: PBKDF2("peanuts").
            key = hashlib.pbkdf2_hmac("sha1", b"peanuts", b"saltysalt", 1, 16)
            return self._aes_128_cbc(key, body)
        except Exception:
            return ""

    @staticmethod
    def _aes_128_cbc(key: bytes, body: bytes) -> str:
        try:
            iv = b" " * 16
            result = _sp_run(
                [
                    "openssl",
                    "enc",
                    "-aes-128-cbc",
                    "-d",
                    "-K",
                    key.hex(),
                    "-iv",
                    iv.hex(),
                    "-nopad",
                ],
                input=body,
                capture_output=True,
                timeout=5,
            )
            if result.returncode != 0:
                return ""
            decrypted = result.stdout
            pad = decrypted[-1] if decrypted else 0
            if 0 < pad <= 16:
                decrypted = decrypted[:-pad]
            return decrypted.decode("utf-8", errors="replace")
        except Exception:
            return ""
