#!/usr/bin/env python3
"""
Dat Commerce — Repeatable Bulk Catalog Seeder
Creates 6 new Product Types (with 10 new dynamic attributes & 6 matching Categories)
and 300 realistic products across the 6 new types (30 each = 180) and 6 core types (20 each = 120).
Idempotent by attribute code, product type code, category slug, and product slug.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any

BASE_URL = os.environ.get("DAT_COMMERCE_BASE_URL", "http://127.0.0.1:8088").rstrip("/")
OWNER_EMAIL = os.environ.get("DAT_OWNER_EMAIL", "owner@datcommerce.local")
OWNER_PASS = os.environ.get("DAT_OWNER_PASS", "OwnerPass123!")


class ApiClient:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url
        self.token = ""

    def login(self) -> None:
        data = self.request(
            "POST",
            "/api/v1/auth/login",
            {"email": OWNER_EMAIL, "password": OWNER_PASS},
            auth=False,
        )
        self.token = data["accessToken"]

    def request(
        self,
        method: str,
        path: str,
        body: Any = None,
        auth: bool = True,
        retry_auth: bool = True,
    ) -> Any:
        headers = {"Accept": "application/json"}
        if auth and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        payload = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            payload = json.dumps(body).encode("utf-8")

        req = urllib.request.Request(
            self.base_url + path,
            data=payload,
            headers=headers,
            method=method,
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw.strip() else None
        except urllib.error.HTTPError as err:
            raw_err = err.read().decode("utf-8", errors="replace")
            if err.code == 401 and auth and retry_auth:
                self.login()
                return self.request(method, path, body, auth=True, retry_auth=False)
            raise RuntimeError(f"{method} {path} -> HTTP {err.code}: {raw_err}") from err


NEW_ATTRIBUTES = [
    {
        "code": "case_size_mm",
        "name": "Case Size",
        "dataType": "NUMBER",
        "required": False,
        "filterable": True,
        "searchable": False,
        "unit": "mm",
    },
    {
        "code": "gps_band",
        "name": "GPS Band",
        "dataType": "ENUM",
        "required": False,
        "filterable": True,
        "searchable": True,
        "options": [
            {"value": "Single-Band", "label": "Single-Band", "sortOrder": 1},
            {"value": "Dual-Band", "label": "Dual-Band", "sortOrder": 2},
            {"value": "Multi-Band", "label": "Multi-Band", "sortOrder": 3},
        ],
    },
    {
        "code": "battery_hours",
        "name": "Battery Hours",
        "dataType": "NUMBER",
        "required": False,
        "filterable": True,
        "searchable": False,
        "unit": "hrs",
    },
    {
        "code": "anc_enabled",
        "name": "Active Noise Canceling",
        "dataType": "BOOLEAN",
        "required": False,
        "filterable": True,
        "searchable": False,
    },
    {
        "code": "connectivity",
        "name": "Connectivity",
        "dataType": "ENUM",
        "required": False,
        "filterable": True,
        "searchable": True,
        "options": [
            {"value": "Bluetooth 5.3", "label": "Bluetooth 5.3", "sortOrder": 1},
            {"value": "USB-C", "label": "USB-C", "sortOrder": 2},
            {"value": "3.5mm + BT", "label": "3.5mm + BT", "sortOrder": 3},
        ],
    },
    {
        "code": "weight_g",
        "name": "Weight",
        "dataType": "NUMBER",
        "required": False,
        "filterable": True,
        "searchable": False,
        "unit": "g",
    },
    {
        "code": "season_rating",
        "name": "Season Rating",
        "dataType": "ENUM",
        "required": False,
        "filterable": True,
        "searchable": True,
        "options": [
            {"value": "3-Season", "label": "3-Season", "sortOrder": 1},
            {"value": "4-Season", "label": "4-Season", "sortOrder": 2},
            {"value": "Ultralight", "label": "Ultralight", "sortOrder": 3},
        ],
    },
    {
        "code": "refresh_rate_hz",
        "name": "Refresh Rate",
        "dataType": "NUMBER",
        "required": False,
        "filterable": True,
        "searchable": False,
        "unit": "Hz",
    },
    {
        "code": "panel_type",
        "name": "Panel Type",
        "dataType": "ENUM",
        "required": False,
        "filterable": True,
        "searchable": True,
        "options": [
            {"value": "IPS", "label": "IPS", "sortOrder": 1},
            {"value": "OLED", "label": "OLED", "sortOrder": 2},
            {"value": "Mini-LED", "label": "Mini-LED", "sortOrder": 3},
        ],
    },
    {
        "code": "stylus_support",
        "name": "Stylus Support",
        "dataType": "BOOLEAN",
        "required": False,
        "filterable": True,
        "searchable": False,
    },
    {
        "code": "display_inches",
        "name": "Display Size",
        "dataType": "NUMBER",
        "required": False,
        "filterable": True,
        "searchable": False,
        "unit": "inch",
    },
]

NEW_PRODUCT_TYPES = [
    {
        "code": "smartwatch",
        "name": "Smartwatches",
        "description": "Multisport GPS wearables, sapphire trail watches, and expedition trackers.",
        "attrCodes": ["battery_days", "waterproof", "case_size_mm", "gps_band"],
        "variantOptions": [
            {"code": "strap_color", "name": "Strap Color", "sortOrder": 1},
            {"code": "case_size", "name": "Case Size", "sortOrder": 2},
        ],
        "category": {
            "slug": "smartwatches",
            "name": "Smartwatches",
            "description": "GPS endurance wearables and rugged fitness watches.",
            "imageUrl": "/media/watch.jpg",
        },
    },
    {
        "code": "headphones",
        "name": "Headphones & Audio",
        "description": "Wireless ANC over-ears, open-ear trail earbuds, and studio headphones.",
        "attrCodes": ["battery_hours", "anc_enabled", "connectivity"],
        "variantOptions": [
            {"code": "color", "name": "Color", "sortOrder": 1},
        ],
        "category": {
            "slug": "audio",
            "name": "Audio & Headphones",
            "description": "Studio acoustics and active noise-canceling travel audio.",
            "imageUrl": "/media/terrain-fallback.jpg",
        },
    },
    {
        "code": "backpack",
        "name": "Backpacks & Packs",
        "description": "Alpine daypacks, ultralight running vests, and weatherproof commuter packs.",
        "attrCodes": ["capacity_l", "material", "waterproof", "weight_g"],
        "variantOptions": [
            {"code": "color", "name": "Color", "sortOrder": 1},
            {"code": "volume", "name": "Volume", "sortOrder": 2},
        ],
        "category": {
            "slug": "backpacks",
            "name": "Backpacks",
            "description": "Weatherproof packs engineered for city commute and alpine treks.",
            "imageUrl": "/media/pack.jpg",
        },
    },
    {
        "code": "camping-gear",
        "name": "Camping & Shelter",
        "description": "Ultralight tents, expedition shelters, and backcountry sleep systems.",
        "attrCodes": ["material", "waterproof", "season_rating", "weight_g"],
        "variantOptions": [
            {"code": "color", "name": "Color", "sortOrder": 1},
            {"code": "capacity", "name": "Capacity", "sortOrder": 2},
        ],
        "category": {
            "slug": "camping-gear",
            "name": "Camping Gear",
            "description": "Four-season shelters, bivys, and ultralight camp hardware.",
            "imageUrl": "/media/terrain-hero.jpg",
        },
    },
    {
        "code": "monitor",
        "name": "Studio Monitors",
        "description": "Color-calibrated creator displays and high-refresh studio monitors.",
        "attrCodes": ["display_inches", "refresh_rate_hz", "panel_type"],
        "variantOptions": [
            {"code": "finish", "name": "Finish", "sortOrder": 1},
            {"code": "stand", "name": "Stand", "sortOrder": 2},
        ],
        "category": {
            "slug": "monitors",
            "name": "Monitors",
            "description": "OLED, Mini-LED, and IPS displays calibrated for studio work.",
            "imageUrl": "/media/laptop-pro.svg",
        },
    },
    {
        "code": "tablet",
        "name": "Tablets",
        "description": "Portable digital slates and studio drawing tablets with precision stylus support.",
        "attrCodes": ["ram_gb", "storage_gb", "screen_inches", "stylus_support"],
        "variantOptions": [
            {"code": "storage", "name": "Storage", "sortOrder": 1},
            {"code": "color", "name": "Color", "sortOrder": 2},
        ],
        "category": {
            "slug": "tablets",
            "name": "Tablets",
            "description": "Ultra-thin creator tablets and field-ready mobile slates.",
            "imageUrl": "/media/laptop-air.svg",
        },
    },
]


def build_product_specs() -> list[dict[str, Any]]:
    specs: list[dict[str, Any]] = []

    # 1. Smartwatch (30 products)
    sw_brands = ["Garmin", "Coros", "Suunto", "Terrain", "Polar", "Amazfit"]
    sw_prefixes = ["Apex", "Fenix", "Vertix", "Race", "Enduro", "Pace"]
    sw_suffixes = ["Solar", "Sapphire", "Titanium", "Pro", "Ultra"]
    for i in range(30):
        b = sw_brands[i % len(sw_brands)]
        name = f"{b} {sw_prefixes[i // len(sw_brands)]} {sw_suffixes[i % len(sw_suffixes)]} {42 + (i % 4) * 2}"
        case_mm = [42, 44, 46, 48][i % 4]
        gps = ["Single-Band", "Dual-Band", "Multi-Band"][i % 3]
        base_price = 279 + (i % 10) * 45
        specs.append({
            "typeCode": "smartwatch",
            "categories": ["smartwatches"],
            "name": f"{name} Edition",
            "slug": f"smartwatch-{i + 1:03d}-{name.lower().replace(' ', '-')}",
            "brand": b,
            "description": f"{b} {case_mm}mm expedition GPS smartwatch with {gps} positioning and 50m waterproofing.",
            "image": "/media/watch.jpg",
            "attributes": {
                "battery_days": 14 + (i % 5) * 6,
                "waterproof": True,
                "case_size_mm": case_mm,
                "gps_band": gps,
            },
            "variants": [
                {
                    "sku": f"DC-SW-{i + 1:03d}-A",
                    "title": f"Obsidian · {case_mm}mm",
                    "price": float(base_price),
                    "compareAtPrice": float(base_price + 40) if i % 3 == 0 else None,
                    "stock": 12 + (i * 7) % 60,
                    "options": {"strap_color": "Obsidian", "case_size": f"{case_mm}mm"},
                    "status": "ACTIVE",
                },
                {
                    "sku": f"DC-SW-{i + 1:03d}-B",
                    "title": f"Alpine Moss · {case_mm}mm",
                    "price": float(base_price + 20),
                    "stock": 8 + (i * 5) % 45,
                    "options": {"strap_color": "Alpine Moss", "case_size": f"{case_mm}mm"},
                    "status": "ACTIVE",
                },
            ],
        })

    # 2. Headphones & Audio (30 products)
    au_brands = ["Sony", "Sennheiser", "Bose", "Shokz", "Soundcore", "Sonos"]
    au_lines = ["Studio", "OpenTrail", "Acoustic", "QuietField", "Monitor", "AeroBuds"]
    au_tiers = ["Air", "Pro", "Max", "Core", "Plus"]
    for i in range(30):
        b = au_brands[i % len(au_brands)]
        name = f"{b} {au_lines[i // len(au_brands)]} {au_tiers[i % len(au_tiers)]} MK{1 + (i % 3)}"
        conn = ["Bluetooth 5.3", "USB-C", "3.5mm + BT"][i % 3]
        anc = (i % 4 != 3)
        base_price = 129 + (i % 9) * 35
        specs.append({
            "typeCode": "headphones",
            "categories": ["audio"],
            "name": name,
            "slug": f"headphones-{i + 1:03d}-{name.lower().replace(' ', '-')}",
            "brand": b,
            "description": f"{b} precision acoustic headphones over {conn} with up to {24 + (i % 6) * 6}h battery life.",
            "image": "/media/terrain-fallback.jpg",
            "attributes": {
                "battery_hours": 24 + (i % 6) * 6,
                "anc_enabled": anc,
                "connectivity": conn,
            },
            "variants": [
                {
                    "sku": f"DC-AU-{i + 1:03d}-A",
                    "title": "Matte Black",
                    "price": float(base_price),
                    "compareAtPrice": float(base_price + 30) if i % 4 == 0 else None,
                    "stock": 15 + (i * 6) % 70,
                    "options": {"color": "Matte Black"},
                    "status": "ACTIVE",
                },
                {
                    "sku": f"DC-AU-{i + 1:03d}-B",
                    "title": "Sandstone",
                    "price": float(base_price),
                    "stock": 10 + (i * 9) % 55,
                    "options": {"color": "Sandstone"},
                    "status": "ACTIVE",
                },
            ],
        })

    # 3. Backpacks & Packs (30 products)
    bp_brands = ["Osprey", "Peak Design", "Patagonia", "Arc'teryx", "Salomon", "Bellroy"]
    bp_models = ["Talon", "Everyday", "Black Hole", "Mantis", "AdvSkin", "Transit"]
    for i in range(30):
        b = bp_brands[i % len(bp_brands)]
        cap = [15, 20, 24, 28, 32, 40][i % 6]
        mat = ["420D Cordura Nylon", "Dyneema Composite", "Recycled Ripstop"][i % 3]
        name = f"{b} {bp_models[i // len(bp_brands)]} Pack {cap}L v{(i % 3) + 1}"
        base_price = 115 + (i % 8) * 28
        specs.append({
            "typeCode": "backpack",
            "categories": ["backpacks", "accessories"] if i % 3 == 0 else ["backpacks"],
            "name": name,
            "slug": f"backpack-{i + 1:03d}-{name.lower().replace(' ', '-').replace(chr(39), '')}",
            "brand": b,
            "description": f"{cap}L weather-sealed technical pack built with {mat}.",
            "image": "/media/pack.jpg",
            "attributes": {
                "capacity_l": cap,
                "material": mat,
                "waterproof": i % 3 != 2,
                "weight_g": 480 + cap * 22,
            },
            "variants": [
                {
                    "sku": f"DC-BP-{i + 1:03d}-A",
                    "title": f"Charcoal · {cap}L",
                    "price": float(base_price),
                    "stock": 14 + (i * 5) % 65,
                    "options": {"color": "Charcoal", "volume": f"{cap}L"},
                    "status": "ACTIVE",
                },
                {
                    "sku": f"DC-BP-{i + 1:03d}-B",
                    "title": f"Forest · {cap + 4}L",
                    "price": float(base_price + 25),
                    "stock": 9 + (i * 7) % 45,
                    "options": {"color": "Forest", "volume": f"{cap + 4}L"},
                    "status": "ACTIVE",
                },
            ],
        })

    # 4. Camping & Shelter (30 products)
    cg_brands = ["MSR", "Big Agnes", "Nemo", "Hilleberg", "Sea to Summit", "Zpacks"]
    cg_lines = ["Hubba", "Copper Spur", "Hornet", "Allak", "Telos", "Duplex"]
    for i in range(30):
        b = cg_brands[i % len(cg_brands)]
        season = ["3-Season", "4-Season", "Ultralight"][i % 3]
        cap_p = ["1P", "2P", "3P"][i % 3]
        name = f"{b} {cg_lines[i // len(cg_brands)]} {season} {cap_p} #{i + 1}"
        mat = ["15D SilNylon", "20D Ripstop Polyester", "DCF Carbon Composite"][i % 3]
        base_price = 249 + (i % 9) * 55
        specs.append({
            "typeCode": "camping-gear",
            "categories": ["camping-gear"],
            "name": name,
            "slug": f"camping-{i + 1:03d}-{b.lower().replace(' ', '-')}-{cg_lines[i // len(cg_brands)].lower().replace(' ', '-')}",
            "brand": b,
            "description": f"{season} backcountry shelter engineered from {mat} for storm-grade stability.",
            "image": "/media/terrain-hero.jpg",
            "attributes": {
                "material": mat,
                "waterproof": True,
                "season_rating": season,
                "weight_g": 690 + (i % 5) * 320,
            },
            "variants": [
                {
                    "sku": f"DC-CG-{i + 1:03d}-A",
                    "title": f"Alpine Olive · {cap_p}",
                    "price": float(base_price),
                    "compareAtPrice": float(base_price + 50) if i % 5 == 0 else None,
                    "stock": 8 + (i * 4) % 40,
                    "options": {"color": "Alpine Olive", "capacity": cap_p},
                    "status": "ACTIVE",
                },
                {
                    "sku": f"DC-CG-{i + 1:03d}-B",
                    "title": f"Ember Orange · {cap_p}",
                    "price": float(base_price + 30),
                    "stock": 10 + (i * 3) % 35,
                    "options": {"color": "Ember Orange", "capacity": cap_p},
                    "status": "ACTIVE",
                },
            ],
        })

    # 5. Studio Monitors (30 products)
    mn_brands = ["FormaDisplay", "Dell", "LG", "BenQ", "ASUS", "Apple"]
    mn_series = ["UltraSharp", "StudioView", "ColorEdge", "ProArt", "PixelMaster", "Reference"]
    for i in range(30):
        b = mn_brands[i % len(mn_brands)]
        panel = ["IPS", "OLED", "Mini-LED"][i % 3]
        hz = [60, 120, 144, 240][i % 4]
        inches = [24.0, 27.0, 32.0, 34.0, 38.0][i % 5]
        name = f"{b} {mn_series[i // len(mn_brands)]} {int(inches)} {panel} {hz}Hz"
        base_price = 449 + (i % 10) * 120
        specs.append({
            "typeCode": "monitor",
            "categories": ["monitors"],
            "name": name,
            "slug": f"monitor-{i + 1:03d}-{b.lower()}-{int(inches)}-{panel.lower()}",
            "brand": b,
            "description": f"{inches}-inch factory-calibrated {panel} studio display running up to {hz}Hz with USB-C PD.",
            "image": "/media/laptop-pro.svg",
            "attributes": {
                "display_inches": inches,
                "refresh_rate_hz": hz,
                "panel_type": panel,
            },
            "variants": [
                {
                    "sku": f"DC-MN-{i + 1:03d}-A",
                    "title": "Standard Glass · Tilt Stand",
                    "price": float(base_price),
                    "stock": 10 + (i * 6) % 50,
                    "options": {"finish": "Standard Glass", "stand": "Tilt Stand"},
                    "status": "ACTIVE",
                },
                {
                    "sku": f"DC-MN-{i + 1:03d}-B",
                    "title": "Nano-Texture · Height Stand",
                    "price": float(base_price + 180),
                    "compareAtPrice": float(base_price + 240) if i % 3 == 0 else None,
                    "stock": 8 + (i * 5) % 35,
                    "options": {"finish": "Nano-Texture", "stand": "Height Stand"},
                    "status": "ACTIVE",
                },
            ],
        })

    # 6. Tablets (30 products)
    tb_brands = ["FormaPad", "Apple", "Samsung", "Lenovo", "Xiaomi", "OnePlus"]
    tb_lines = ["Air", "Pro", "Ultra", "Studio", "Field", "Slate"]
    for i in range(30):
        b = tb_brands[i % len(tb_brands)]
        ram = [8, 12, 16][i % 3]
        stor = [128, 256, 512, 1024][i % 4]
        inches = [11.0, 12.4, 13.0, 14.6][i % 4]
        name = f"{b} {tb_lines[i // len(tb_brands)]} {inches}\" Gen {(i % 3) + 2}"
        base_price = 499 + (i % 8) * 110
        specs.append({
            "typeCode": "tablet",
            "categories": ["tablets"],
            "name": name,
            "slug": f"tablet-{i + 1:03d}-{b.lower()}-{tb_lines[i // len(tb_brands)].lower()}",
            "brand": b,
            "description": f"Lightweight {inches}\" mobile slate with {ram}GB RAM, {stor}GB flash, and low-latency stylus support.",
            "image": "/media/laptop-air.svg",
            "attributes": {
                "ram_gb": ram,
                "storage_gb": stor,
                "screen_inches": inches,
                "stylus_support": i % 5 != 4,
            },
            "variants": [
                {
                    "sku": f"DC-TB-{i + 1:03d}-A",
                    "title": f"{stor}GB · Space Gray",
                    "price": float(base_price),
                    "stock": 14 + (i * 7) % 60,
                    "options": {"storage": f"{stor}GB", "color": "Space Gray"},
                    "status": "ACTIVE",
                },
                {
                    "sku": f"DC-TB-{i + 1:03d}-B",
                    "title": f"{min(stor * 2, 2048)}GB · Silver",
                    "price": float(base_price + 160),
                    "stock": 9 + (i * 5) % 45,
                    "options": {"storage": f"{min(stor * 2, 2048)}GB", "color": "Silver"},
                    "status": "ACTIVE",
                },
            ],
        })

    # 7. Existing 6 core types (20 products each = 120)
    # 7a. Shoes (20)
    sh_brands = ["Nike", "Salomon", "Hoka", "Altra", "Brooks"]
    sh_models = ["Pegasus Ridge", "Speedcross Ultra", "Tecton Carbon", "Lone Peak Grip"]
    sh_imgs = ["/media/shoe-olive.jpg", "/media/shoe-red.jpg", "/media/shoe-white.jpg"]
    for i in range(20):
        b = sh_brands[i % len(sh_brands)]
        m = sh_models[i // len(sh_brands)]
        gender = ["Men", "Women", "Unisex"][i % 3]
        sole = 26 + (i % 5) * 3
        name = f"{b} {m} v{1 + (i % 4)} ({gender})"
        base_price = 135 + (i % 6) * 18
        cats = ["footwear", "trail-running"] if i % 2 == 0 else ["footwear", "running-shoes"]
        specs.append({
            "typeCode": "shoes",
            "categories": cats,
            "name": name,
            "slug": f"shoes-bulk-{i + 1:03d}-{b.lower()}-{m.lower().replace(' ', '-')}",
            "brand": b,
            "description": f"{b} {m} trail and road trainer with {sole}mm stack height and high-traction lug outsole.",
            "image": sh_imgs[i % len(sh_imgs)],
            "attributes": {
                "material": "Engineered Mesh & Vibram",
                "gender": gender,
                "waterproof": i % 2 == 0,
                "sole_height": sole,
            },
            "variants": [
                {
                    "sku": f"DC-SH-{i + 1:03d}-A",
                    "title": f"US 9 · {['Olive', 'Crimson', 'Chalk'][i % 3]}",
                    "price": float(base_price),
                    "compareAtPrice": float(base_price + 25) if i % 4 == 0 else None,
                    "stock": 18 + (i * 5) % 60,
                    "options": {"color": ["Olive", "Crimson", "Chalk"][i % 3], "size": "9"},
                    "status": "ACTIVE",
                },
                {
                    "sku": f"DC-SH-{i + 1:03d}-B",
                    "title": f"US 10 · {['Olive', 'Crimson', 'Chalk'][i % 3]}",
                    "price": float(base_price),
                    "stock": 14 + (i * 3) % 50,
                    "options": {"color": ["Olive", "Crimson", "Chalk"][i % 3], "size": "10"},
                    "status": "ACTIVE",
                },
            ],
        })

    # 7b. Apparel (20)
    ap_brands = ["Arc'teryx", "Patagonia", "Terrain", "Tracksmith", "Outdoor Research"]
    ap_models = ["Storm Anorak", "Merino Midlayer", "Alpine Fleece", "Wind Jacket"]
    for i in range(20):
        b = ap_brands[i % len(ap_brands)]
        m = ap_models[i // len(ap_brands)]
        gender = ["Men", "Women", "Unisex"][i % 3]
        name = f"{b} {m} Series {i + 1} ({gender})"
        base_price = 110 + (i % 7) * 30
        specs.append({
            "typeCode": "apparel",
            "categories": ["apparel"],
            "name": name,
            "slug": f"apparel-bulk-{i + 1:03d}-{b.lower().replace(' ', '-').replace(chr(39), '')}",
            "brand": b,
            "description": f"Breathable technical outerwear crafted for changing mountain weather.",
            "image": "/media/jacket.jpg",
            "attributes": {
                "material": ["3L Pertex Shield", "Merino 220gsm", "Polartec Grid"][i % 3],
                "waterproof": i % 3 != 2,
                "gender": gender,
            },
            "variants": [
                {
                    "sku": f"DC-AP-{i + 1:03d}-A",
                    "title": "M · Moss",
                    "price": float(base_price),
                    "stock": 16 + (i * 4) % 55,
                    "options": {"color": "Moss", "size": "M"},
                    "status": "ACTIVE",
                },
                {
                    "sku": f"DC-AP-{i + 1:03d}-B",
                    "title": "L · Charcoal",
                    "price": float(base_price),
                    "stock": 12 + (i * 6) % 45,
                    "options": {"color": "Charcoal", "size": "L"},
                    "status": "ACTIVE",
                },
            ],
        })

    # 7c. Accessories (20)
    ac_brands = ["Terrain", "Peak Design", "Matador", "Nitecore", "Hydro Flask"]
    ac_items = ["Dry Compression Sack", "Soft Flask Belt", "Titanium Utility Kit", "Carbon Trekking Poles"]
    for i in range(20):
        b = ac_brands[i % len(ac_brands)]
        m = ac_items[i // len(ac_brands)]
        cap = 2 + (i % 10) * 3
        name = f"{b} {m} MK{1 + (i % 4)} ({cap}L)"
        base_price = 38 + (i % 8) * 14
        specs.append({
            "typeCode": "accessories",
            "categories": ["accessories"],
            "name": name,
            "slug": f"accessory-bulk-{i + 1:03d}-{b.lower().replace(' ', '-')}",
            "brand": b,
            "description": f"Compact travel and trail accessory built with abrasion-resistant hardware.",
            "image": "/media/pack.jpg",
            "attributes": {
                "material": ["Cordura Ripstop", "Anodized Alloy", "Recycled TPU"][i % 3],
                "capacity_l": cap,
            },
            "variants": [
                {
                    "sku": f"DC-AC-{i + 1:03d}-A",
                    "title": "Graphite",
                    "price": float(base_price),
                    "stock": 25 + (i * 7) % 70,
                    "options": {"color": "Graphite"},
                    "status": "ACTIVE",
                },
                {
                    "sku": f"DC-AC-{i + 1:03d}-B",
                    "title": "Evergreen",
                    "price": float(base_price + 5),
                    "stock": 20 + (i * 5) % 60,
                    "options": {"color": "Evergreen"},
                    "status": "ACTIVE",
                },
            ],
        })

    # 7d. Electronics (20)
    el_brands = ["Anker", "Garmin", "Nitecore", "Goal Zero", "DJI"]
    el_items = ["InReach Beacon", "PowerCore Solar", "Trail Headlamp", "Action Gimbal"]
    for i in range(20):
        b = el_brands[i % len(el_brands)]
        m = el_items[i // len(el_brands)]
        name = f"{b} {m} Pro-{100 + i}"
        base_price = 89 + (i % 7) * 45
        specs.append({
            "typeCode": "electronics",
            "categories": ["electronics"],
            "name": name,
            "slug": f"electronics-bulk-{i + 1:03d}-{b.lower().replace(' ', '-')}",
            "brand": b,
            "description": f"Rugged portable field electronics with multi-week standby battery life.",
            "image": "/media/watch.jpg",
            "attributes": {
                "battery_days": 10 + (i % 6) * 5,
                "waterproof": True,
            },
            "variants": [
                {
                    "sku": f"DC-EL-{i + 1:03d}-A",
                    "title": "Slate Titanium",
                    "price": float(base_price),
                    "stock": 14 + (i * 6) % 65,
                    "options": {"color": "Slate Titanium"},
                    "status": "ACTIVE",
                },
                {
                    "sku": f"DC-EL-{i + 1:03d}-B",
                    "title": "Signal Orange",
                    "price": float(base_price),
                    "stock": 11 + (i * 4) % 50,
                    "options": {"color": "Signal Orange"},
                    "status": "ACTIVE",
                },
            ],
        })

    # 7e. Laptop (20)
    lp_brands = ["Forma", "ThinkPad", "XPS", "ZenBook", "Framework"]
    lp_models = ["Workstation", "StudioBook", "AeroBlade", "Creator Edition"]
    lp_cpus = ["Forma M4 Max 16-Core", "Core Ultra 9 285H", "Ryzen AI 9 HX 370"]
    for i in range(20):
        b = lp_brands[i % len(lp_brands)]
        m = lp_models[i // len(lp_brands)]
        ram = [16, 32, 64][i % 3]
        stor = [512, 1024, 2048][i % 3]
        inches = [13.6, 14.2, 15.3, 16.0][i % 4]
        name = f"{b} {m} {int(inches)} S{i + 1}"
        base_price = 1199 + (i % 7) * 220
        specs.append({
            "typeCode": "laptop",
            "categories": ["laptops"],
            "name": name,
            "slug": f"laptop-bulk-{i + 1:03d}-{b.lower()}",
            "brand": b,
            "description": f"{inches}-inch CNC aluminum mobile workstation with NVMe PCIe storage.",
            "image": "/media/laptop-pro.svg" if i % 2 == 0 else "/media/laptop-air.svg",
            "attributes": {
                "cpu": lp_cpus[i % len(lp_cpus)],
                "ram_gb": ram,
                "storage_gb": stor,
                "screen_inches": inches,
            },
            "variants": [
                {
                    "sku": f"DC-LP-{i + 1:03d}-A",
                    "title": f"{ram}GB / {stor}GB",
                    "price": float(base_price),
                    "stock": 10 + (i * 3) % 40,
                    "options": {"ram_config": f"{ram}GB", "storage_config": f"{stor}GB"},
                    "status": "ACTIVE",
                },
                {
                    "sku": f"DC-LP-{i + 1:03d}-B",
                    "title": f"{ram * 2 if ram < 64 else 64}GB / 2TB",
                    "price": float(base_price + 350),
                    "stock": 8 + (i * 4) % 30,
                    "options": {
                        "ram_config": f"{ram * 2 if ram < 64 else 64}GB",
                        "storage_config": "2TB",
                    },
                    "status": "ACTIVE",
                },
            ],
        })

    # 7f. Phone (20)
    ph_brands = ["Pixelis", "FormaPhone", "Nothing", "Fairphone", "OnePlus"]
    ph_models = ["Pro", "Ultra", "Air", "Field Edition"]
    for i in range(20):
        b = ph_brands[i % len(ph_brands)]
        m = ph_models[i // len(ph_brands)]
        ram = [8, 12, 16][i % 3]
        stor = [128, 256, 512][i % 3]
        name = f"{b} {15 + (i % 3)} {m} #{i + 1}"
        base_price = 649 + (i % 6) * 110
        specs.append({
            "typeCode": "phone",
            "categories": ["phones"],
            "name": name,
            "slug": f"phone-bulk-{i + 1:03d}-{b.lower()}",
            "brand": b,
            "description": f"All-day flagship smartphone with OLED display, {ram}GB RAM, and satellite SOS.",
            "image": "/media/phone-pro.svg" if i % 2 == 0 else "/media/phone-air.svg",
            "attributes": {
                "ram_gb": ram,
                "storage_gb": stor,
                "five_g_ready": True,
            },
            "variants": [
                {
                    "sku": f"DC-PH-{i + 1:03d}-A",
                    "title": f"{stor}GB · Obsidian",
                    "price": float(base_price),
                    "stock": 18 + (i * 5) % 60,
                    "options": {"storage_config": f"{stor}GB", "color": "Obsidian"},
                    "status": "ACTIVE",
                },
                {
                    "sku": f"DC-PH-{i + 1:03d}-B",
                    "title": f"{stor * 2 if stor < 512 else 1024}GB · Titanium",
                    "price": float(base_price + 140),
                    "stock": 12 + (i * 4) % 45,
                    "options": {
                        "storage_config": f"{stor * 2 if stor < 512 else 1024}GB",
                        "color": "Titanium",
                    },
                    "status": "ACTIVE",
                },
            ],
        })

    return specs


def main() -> int:
    client = ApiClient(BASE_URL)
    client.login()

    # 1. Attributes
    existing_attrs = {a["code"]: a for a in client.request("GET", "/api/v1/admin/attributes?includeArchived=true")}
    created_attrs = 0
    for attr in NEW_ATTRIBUTES:
        if attr["code"] not in existing_attrs:
            created = client.request("POST", "/api/v1/admin/attributes", attr)
            existing_attrs[attr["code"]] = created
            created_attrs += 1

    # 2. Product Types & Categories
    existing_types = {t["code"]: t for t in client.request("GET", "/api/v1/admin/product-types")}
    existing_cats = {c["slug"]: c for c in client.request("GET", "/api/v1/admin/categories")}
    created_types = 0
    created_cats = 0

    for idx, pt in enumerate(NEW_PRODUCT_TYPES):
        attr_bindings = [
            {
                "attributeDefinitionId": existing_attrs[code]["id"],
                "displayOrder": order + 1,
                "requiredOverride": order == 0,
            }
            for order, code in enumerate(pt["attrCodes"])
        ]
        if pt["code"] not in existing_types:
            created_pt = client.request(
                "POST",
                "/api/v1/admin/product-types",
                {
                    "code": pt["code"],
                    "name": pt["name"],
                    "description": pt["description"],
                    "attributes": attr_bindings,
                    "variantOptions": pt["variantOptions"],
                },
            )
            existing_types[pt["code"]] = created_pt
            created_types += 1
        elif pt["code"] == "monitor":
            current_codes = [a["code"] for a in existing_types["monitor"].get("attributes", [])]
            if current_codes != pt["attrCodes"]:
                updated_pt = client.request(
                    "PATCH",
                    f"/api/v1/admin/product-types/{existing_types['monitor']['id']}",
                    {"attributes": attr_bindings},
                )
                existing_types["monitor"] = updated_pt

        cat_spec = pt["category"]
        if cat_spec["slug"] not in existing_cats:
            created_cat = client.request(
                "POST",
                "/api/v1/admin/categories",
                {
                    "name": cat_spec["name"],
                    "slug": cat_spec["slug"],
                    "description": cat_spec["description"],
                    "imageUrl": cat_spec["imageUrl"],
                    "defaultProductTypeId": existing_types[pt["code"]]["id"],
                },
            )
            existing_cats[cat_spec["slug"]] = created_cat
            created_cats += 1

    # 3. 300 Products
    existing_products = {p["slug"]: p for p in client.request("GET", "/api/v1/admin/products")}
    specs = build_product_specs()
    assert len(specs) == 300, f"Expected 300 specs, got {len(specs)}"

    created_products = 0
    skipped_products = 0
    for idx, spec in enumerate(specs, start=1):
        if spec["slug"] in existing_products:
            skipped_products += 1
            continue
        type_id = existing_types[spec["typeCode"]]["id"]
        cat_ids = [existing_cats[c]["id"] for c in spec["categories"] if c in existing_cats]
        client.request(
            "POST",
            "/api/v1/admin/products",
            {
                "productTypeId": type_id,
                "name": spec["name"],
                "slug": spec["slug"],
                "brand": spec["brand"],
                "description": spec["description"],
                "status": "ACTIVE",
                "primaryImageUrl": spec["image"],
                "images": [{"url": spec["image"], "altText": spec["name"]}],
                "categoryIds": cat_ids,
                "attributes": spec["attributes"],
                "variants": spec["variants"],
            },
        )
        created_products += 1
        if created_products % 50 == 0:
            print(f"  created {created_products}/300 products...")

    final_types = client.request("GET", "/api/v1/admin/product-types")
    final_cats = client.request("GET", "/api/v1/admin/categories")
    final_store = client.request("GET", "/api/v1/store/products?size=12", auth=False)

    print(
        f"Summary: +{created_attrs} attrs, +{created_types} product_types, +{created_cats} categories, +{created_products} products (skipped={skipped_products})"
    )
    print(
        f"Live Totals: product_types={len(final_types)}, categories={len(final_cats)}, store_totalElements={final_store['totalElements']}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
