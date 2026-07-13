# Task 5 Report: Detailed Q-Style Traveler Assets

## Status

Implemented the eight detailed traveler PNG assets with the required built-in image generation workflow, chroma-key removal, 256x256 transparent RGBA normalization, asset assertions, QA contact sheet, and mobile selector screenshot.

## Built-In Mode

- Mode: built-in `image_gen` tool, one distinct full-body character per call.
- No SVG/manual drawing and no CLI image generation fallback.
- Source background request: perfectly flat `#00ff00` chroma-key background, no floor, no shadow, no text, no watermark.
- Local alpha workflow: `$HOME/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py` with `--auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`.
- Processing runtime: temporary local venv at `tmp/task-5-travelers/.venv` for Pillow only; no app runtime dependency added.

## Final Prompts

### traveler-campus-female.png

```text
Use case: stylized-concept
Asset type: mobile map traveler sprite source for transparent PNG
Primary request: Create one distinct full-body modern cute Q-style traveler character, campus-female, on a perfectly flat solid #00ff00 chroma-key background for background removal.
Subject: young woman traveler, clearly long-haired with a long straight braided ponytail silhouette tied with a mint ribbon, campus-clean style; blazer and cardigan layered over a blouse, pleated skirt, decorated socks, clean canvas sneakers, school canvas tote/satchel, muted forest-green notebook accent in hand; refined tiny garment seams, buttons, sock motifs, bag straps, and shoe details.
Style/medium: cohesive modern cute Q illustration family, polished chibi proportions, clean inkless edges, smooth cel shading, high clarity, low noise, detailed but readable at 64px.
Composition/framing: single isolated full-body character, front three-quarter pose, standing upright, centered, generous transparent-safe padding around hair ribbon, bag, and shoes; no crop outside frame.
Lighting/mood: soft even studio-style character lighting only, no cast shadow and no floor contact.
Constraints: background must be exactly uniform #00ff00 with no gradients, texture, floor, shadow, reflection, watermark, or text; do not use #00ff00 anywhere on the subject; subject must be fully separated from background with crisp edges.
```

### traveler-campus-male.png

```text
Use case: stylized-concept
Asset type: mobile map traveler sprite source for transparent PNG
Primary request: Create one distinct full-body modern cute Q-style traveler character, campus-male, on a perfectly flat solid #00ff00 chroma-key background for background removal.
Subject: young man traveler with soft fringe hair under a navy cap; campus-clean silhouette with blazer/cardigan or hoodie layer over a shirt, tailored trousers, messenger school satchel, campus pass charm, patterned socks, high-top trainers; small unique details like lapel pin, satchel buckles, shoelaces, trouser cuff stitching.
Style/medium: same cohesive modern cute Q illustration family as a polished mobile game sprite, clean edges, smooth shading, low noise, high clarity, readable at small sizes.
Composition/framing: single isolated full-body character, front three-quarter pose, upright, centered, generous padding around cap, satchel, and shoes; no crop outside frame.
Lighting/mood: soft even character lighting, cheerful modern campus mood, no cast shadow and no floor contact.
Constraints: background must be exactly uniform #00ff00 with no gradients, texture, floor, shadow, reflection, watermark, or text; do not use #00ff00 anywhere on the subject; subject must be fully separated from background with crisp edges.
```

### traveler-trend-female.png

```text
Use case: stylized-concept
Asset type: mobile map traveler sprite source for transparent PNG
Primary request: Create one distinct full-body modern cute Q-style traveler character, trend-female, on a perfectly flat solid #00ff00 chroma-key background for background removal.
Subject: young woman traveler, clearly long-haired with a high ponytail silhouette and a few long side strands, decorated with asymmetrical star metal hair clips; sweet-cool trend style with cropped technical jacket, layered streetwear top, wide-leg pants or short skirt over leggings, chain crossbody utility bag, neon-toned earcuff accent, chunky charms, platform boots; every accessory visibly different from school/literary/luxe designs.
Style/medium: cohesive modern cute Q illustration family, polished chibi mobile sprite, clean edges, smooth shading, low noise, high clarity, detailed garment construction and hardware readable at small sizes.
Composition/framing: single isolated full-body character, front three-quarter pose with playful confident stance, centered, generous padding around high ponytail, bag chain, and boots.
Lighting/mood: soft even character lighting, energetic fashion mood, no cast shadow and no floor contact.
Constraints: background must be exactly uniform #00ff00 with no gradients, texture, floor, shadow, reflection, watermark, or text; do not use #00ff00 anywhere on the subject; subject must be fully separated from background with crisp edges.
```

### traveler-trend-male.png

```text
Use case: stylized-concept
Asset type: mobile map traveler sprite source for transparent PNG
Primary request: Create one distinct full-body modern cute Q-style traveler character, trend-male, on a perfectly flat solid #00ff00 chroma-key background for background removal.
Subject: young man traveler with textured undercut hair and a black beanie; sweet-cool streetwear silhouette, oversized layered jacket/hoodie, cargo pants with straps, sling pack across chest, silver choker accent, small keychain charms, chunky sneakers; sharply different from campus uniform and luxe tailoring.
Style/medium: cohesive modern cute Q illustration family, polished chibi mobile sprite, clean edges, smooth shading, low noise, high clarity, detailed pockets, zippers, straps, buckles, soles.
Composition/framing: single isolated full-body character, front three-quarter stance, centered, generous padding around beanie, sling pack, elbows, and shoes; no crop outside frame.
Lighting/mood: soft even character lighting, casual urban fashion mood, no cast shadow and no floor contact.
Constraints: background must be exactly uniform #00ff00 with no gradients, texture, floor, shadow, reflection, watermark, or text; do not use #00ff00 anywhere on the subject; subject must be fully separated from background with crisp edges.
```

### traveler-literary-female.png

```text
Use case: stylized-concept
Asset type: mobile map traveler sprite source for transparent PNG
Primary request: Create one distinct full-body modern cute Q-style traveler character, literary-female, on a perfectly flat solid #00ff00 chroma-key background for background removal.
Subject: young woman traveler, clearly long-haired with a long low side braid and loose soft waves, wearing a linen beret; gentle literary style with textured knit cardigan, blouse, long A-line skirt, book tote with visible book corners, small poetry book accent, mary-jane flats with straps; include knit texture, skirt folds, tote stitching, tiny bookmark charm, and refined shoe buckles.
Style/medium: cohesive modern cute Q illustration family, polished chibi mobile sprite, clean edges, smooth shading, low noise, high clarity, warm soft colors, detailed but readable at small sizes.
Composition/framing: single isolated full-body character, front three-quarter pose, centered, calm standing silhouette, generous padding around beret, braid, tote, skirt hem, and shoes.
Lighting/mood: soft even character lighting, quiet bookstore afternoon mood without any environment, no cast shadow and no floor contact.
Constraints: background must be exactly uniform #00ff00 with no gradients, texture, floor, shadow, reflection, watermark, or text; do not use #00ff00 anywhere on the subject; subject must be fully separated from background with crisp edges.
```

### traveler-literary-male.png

```text
Use case: stylized-concept
Asset type: mobile map traveler sprite source for transparent PNG
Primary request: Create one distinct full-body modern cute Q-style traveler character, literary-male, on a perfectly flat solid #00ff00 chroma-key background for background removal.
Subject: young man traveler with neat side-part hair and a brown tweed newsboy cap; gentle literary style with textured knit vest over crisp shirt, slim tapered trousers, leather satchel, fountain pen accent in pocket or hand, leather loafers; include vest ribbing, shirt placket, satchel stitching, brass buckles, pen clip, shoe seams.
Style/medium: cohesive modern cute Q illustration family, polished chibi mobile sprite, clean edges, smooth shading, low noise, high clarity, detailed but readable at small sizes.
Composition/framing: single isolated full-body character, front three-quarter pose, centered, relaxed thoughtful stance, generous padding around cap, satchel, arm, and shoes.
Lighting/mood: soft even character lighting, quiet literary mood, no cast shadow and no floor contact.
Constraints: background must be exactly uniform #00ff00 with no gradients, texture, floor, shadow, reflection, watermark, or text; do not use #00ff00 anywhere on the subject; subject must be fully separated from background with crisp edges.
```

### traveler-luxe-female.png

```text
Use case: stylized-concept
Asset type: mobile map traveler sprite source for transparent PNG
Primary request: Create one distinct full-body modern cute Q-style traveler character, luxe-female, on a perfectly flat solid #00ff00 chroma-key background for background removal.
Subject: young woman traveler, clearly long-haired with long polished glossy curls falling past shoulders, wearing a pearl headband hair ornament; light-luxe daily style with structured coat over elegant silk dress, miniature quilted handbag, gold watch accent, pointed embellished heels; include coat lapels, dress sheen, handbag quilting, pearl details, watch face, heel jewels, refined city-traveler silhouette.
Style/medium: cohesive modern cute Q illustration family, polished chibi mobile sprite, clean edges, smooth shading, low noise, high clarity, detailed but readable at small sizes.
Composition/framing: single isolated full-body character, front three-quarter pose, centered, poised stance, generous padding around curls, headband, handbag, coat hem, and heels.
Lighting/mood: soft even character lighting, refined warm upscale mood, no cast shadow and no floor contact.
Constraints: background must be exactly uniform #00ff00 with no gradients, texture, floor, shadow, reflection, watermark, or text; do not use #00ff00 anywhere on the subject; subject must be fully separated from background with crisp edges.
```

### traveler-luxe-male.png

```text
Use case: stylized-concept
Asset type: mobile map traveler sprite source for transparent PNG
Primary request: Create one distinct full-body modern cute Q-style traveler character, luxe-male, on a perfectly flat solid #00ff00 chroma-key background for background removal.
Subject: young man traveler with slick-back hair and amber sunglasses used as headwear/accessory; light-luxe daily silhouette with structured tailored coat over refined jacket and trousers, leather briefcase, signet ring accent, polished oxford shoes; include coat seams, lapels, trouser crease, briefcase stitching and clasp, ring glint, shoe brogue details; no brand logos.
Style/medium: cohesive modern cute Q illustration family, polished chibi mobile sprite, clean edges, smooth shading, low noise, high clarity, detailed but readable at small sizes.
Composition/framing: single isolated full-body character, front three-quarter pose, centered, poised upright stance, generous padding around hair, sunglasses, briefcase, coat hem, and shoes.
Lighting/mood: soft even character lighting, refined modern upscale mood, no cast shadow and no floor contact.
Constraints: background must be exactly uniform #00ff00 with no gradients, texture, floor, shadow, reflection, watermark, or text; do not use #00ff00 anywhere on the subject; subject must be fully separated from background with crisp edges.
```

## Source And Output Processing

- Built-in generated source folder: `/Users/mypc/.codex/generated_images/019f5afa-88d7-7690-9ab1-0fae2f731c16/`
- Source files:
  - `call_gDuSvrdxbrNqo2799WeFZBmH.png` -> `traveler-campus-female.png`
  - `call_xgKNCHNhyjfZwGoP7ikS6wUW.png` -> `traveler-campus-male.png`
  - `call_BYJiw8bhKlwNwox2zDzOpQzQ.png` -> `traveler-trend-female.png`
  - `call_iRvzwGmGjLEW6HGbMNnsvJmk.png` -> `traveler-trend-male.png`
  - `call_6EEWTx9PmFhuwj9U9jd5gYB4.png` -> `traveler-literary-female.png`
  - `call_BtW155qXTqEYXZh3d2bJ4Kcl.png` -> `traveler-literary-male.png`
  - `call_W0FaUgI8lG8ByCZIv8WGQi8H.png` -> `traveler-luxe-female.png`
  - `call_ls2qJtZO3qjTADIczihSsO3X.png` -> `traveler-luxe-male.png`
- Keyed intermediate outputs: `tmp/task-5-travelers/keyed/*.png`
- Final normalization: alpha bbox crop, square transparent canvas, consistent padding, Lanczos resize to 256x256, clear negligible alpha, optimized PNG save.

## Files

- Created:
  - `public/work-map-assets/traveler-campus-female.png`
  - `public/work-map-assets/traveler-campus-male.png`
  - `public/work-map-assets/traveler-trend-female.png`
  - `public/work-map-assets/traveler-trend-male.png`
  - `public/work-map-assets/traveler-literary-female.png`
  - `public/work-map-assets/traveler-literary-male.png`
  - `public/work-map-assets/traveler-luxe-female.png`
  - `public/work-map-assets/traveler-luxe-male.png`
  - `docs/superpowers/qa/work-travelers-contact-sheet.png`
  - `docs/superpowers/qa/task-5-traveler-selector-390x844.png`
- Modified:
  - `src/workTravelers.test.js`
  - `.superpowers/sdd/task-5-report.md`
- Deleted:
  - `public/work-map-assets/traveler-female.png`
  - `public/work-map-assets/traveler-male.png`

## Dimensions And Alpha Metrics

All final files are PNG RGBA, 256x256, with transparent corner alphas `[0, 0, 0, 0]`.

| File | Bytes | Opaque coverage | Partial alpha px | Green fringe px |
| --- | ---: | ---: | ---: | ---: |
| `traveler-campus-female.png` | 31696 | 0.1258 | 1728 | 0 |
| `traveler-campus-male.png` | 29363 | 0.1230 | 1149 | 0 |
| `traveler-trend-female.png` | 44066 | 0.1696 | 1980 | 0 |
| `traveler-trend-male.png` | 39812 | 0.1746 | 1294 | 0 |
| `traveler-literary-female.png` | 33174 | 0.1603 | 1125 | 0 |
| `traveler-literary-male.png` | 31087 | 0.1429 | 1125 | 0 |
| `traveler-luxe-female.png` | 35105 | 0.1546 | 1228 | 0 |
| `traveler-luxe-male.png` | 32605 | 0.1517 | 1174 | 0 |

## Commands

```bash
npm test -- src/workTravelers.test.js
python3 -m venv tmp/task-5-travelers/.venv
tmp/task-5-travelers/.venv/bin/python -m pip install --quiet pillow
tmp/task-5-travelers/.venv/bin/python "$HOME/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py" --input <source> --out <keyed> --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill --force
tmp/task-5-travelers/.venv/bin/python - <<'PY'
# crop, resize, save assets, write contact sheet and metrics
PY
node --test src/workTravelers.test.js
npm run dev -- --port 5177
node --input-type=module - <<'NODE'
# mobile Playwright screenshot of traveler selector
NODE
```

## Visual Self-Review

- Contact sheet: `docs/superpowers/qa/work-travelers-contact-sheet.png`.
- Mobile selector screenshot: `docs/superpowers/qa/task-5-traveler-selector-390x844.png`.
- The four female travelers all read as long-haired and use different long-hair silhouettes: campus braid/ribbon, trend high ponytail/star clips, literary side braid/beret, luxe polished curls/pearl headband.
- Every group pair has distinct headwear/hair accessory, bag, garment construction, footwear, accent, and silhouette.
- The family is cohesive: modern cute illustrated characters with clean edges, soft shading, high clarity, and enough detail at selector size.
- Map-size row remains readable as distinct silhouettes, though fine facial/accessory detail is naturally compressed at 42px.
- No detected green fringe pixels after processing.

## Concerns

- The built-in image tool produced near-flat green backgrounds sampled around `#03f805` to `#07f709` rather than mathematically exact `#00ff00`; the mandated border auto-key helper handled this cleanly.
- The source generations are polished anime/Q-style full-body sprites rather than extremely simplified super-deformed icons. They are cohesive and detailed, but the smallest map display naturally emphasizes silhouette over tiny accessory detail.
