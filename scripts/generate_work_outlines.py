from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "public" / "work-map-assets"
OUTPUT_DIR = ROOT / "public" / "work-map-outlines"

THEMES = {
    "modern": {
        "asset": "map-modern.png",
        "places": {
            "bookstore": (22, 26, 40, 18),
            "flower_shop": (78, 26, 40, 18),
            "clinic": (78, 47, 34, 18),
            "parcel_station": (78, 69, 38, 20),
            "cafe": (22, 68, 40, 20),
        },
    },
    "ancient_cn": {
        "asset": "map-ancient-cn.png",
        "places": {
            "yamen": (22, 26, 40, 18),
            "inn": (78, 26, 40, 18),
            "medical_hall": (77, 47, 36, 18),
            "academy": (77, 68, 38, 20),
            "escort_agency": (22, 68, 40, 20),
        },
    },
    "xuanhuan": {
        "asset": "map-xuanhuan.png",
        "places": {
            "sect_gate": (26, 27, 52, 24),
            "alchemy": (77, 27, 42, 22),
            "herb_garden": (77, 48, 40, 20),
            "mission_hall": (76, 69, 42, 22),
            "forge": (24, 69, 44, 23),
        },
    },
    "western_fantasy": {
        "asset": "map-western-fantasy.png",
        "places": {
            "guild": (22, 25, 40, 19),
            "magic_academy": (78, 25, 40, 19),
            "potion_shop": (77, 46, 36, 18),
            "smithy": (78, 69, 40, 20),
            "castle": (22, 68, 40, 20),
        },
    },
    "scifi": {
        "asset": "map-scifi.png",
        "places": {
            "research_lab": (22, 25, 40, 19),
            "repair_dock": (78, 25, 40, 19),
            "trade_port": (77, 46, 36, 18),
            "navigation_station": (78, 69, 40, 20),
            "eco_cabin": (22, 68, 40, 20),
        },
    },
    "wasteland": {
        "asset": "map-wasteland.png",
        "places": {
            "shelter": (22, 26, 40, 19),
            "supply_station": (78, 26, 40, 19),
            "medical_camp": (77, 48, 36, 18),
            "watch_post": (78, 70, 36, 20),
            "repair_station": (22, 68, 40, 20),
        },
    },
}


def make_outline(image, region):
    width, height = image.size
    center_x, center_y, region_width, region_height = region
    left = max(0, round((center_x - region_width / 2) * width / 100))
    top = max(0, round((center_y - region_height / 2) * height / 100))
    right = min(width, round((center_x + region_width / 2) * width / 100))
    bottom = min(height, round((center_y + region_height / 2) * height / 100))

    crop = image.crop((left, top, right, bottom)).convert("L")
    softened = crop.filter(ImageFilter.GaussianBlur(0.7))
    edges = np.asarray(softened.filter(ImageFilter.FIND_EDGES), dtype=np.float32)
    cutoff = max(14.0, float(np.percentile(edges, 74)))
    alpha = np.clip((edges - cutoff) * 5.4, 0, 255).astype(np.uint8)
    crop_height, crop_width = alpha.shape
    x_distance = np.minimum(np.arange(crop_width), np.arange(crop_width)[::-1])
    y_distance = np.minimum(np.arange(crop_height), np.arange(crop_height)[::-1])
    edge_distance = np.minimum(y_distance[:, None], x_distance[None, :])
    edge_fade = np.clip((edge_distance - 2) / 12, 0, 1)
    alpha = (alpha * edge_fade).astype(np.uint8)

    edge_image = Image.new("RGBA", crop.size, (255, 255, 255, 0))
    edge_image.putalpha(Image.fromarray(alpha, mode="L"))
    edge_image = edge_image.filter(ImageFilter.GaussianBlur(0.3))

    result = Image.new("RGBA", image.size, (255, 255, 255, 0))
    result.alpha_composite(edge_image, (left, top))
    return result


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for theme_id, theme in THEMES.items():
        image = Image.open(SOURCE_DIR / theme["asset"]).convert("RGB")
        for place_type, region in theme["places"].items():
            outline = make_outline(image, region)
            outline.save(OUTPUT_DIR / f"{theme_id}-{place_type}.png", optimize=True)


if __name__ == "__main__":
    main()
