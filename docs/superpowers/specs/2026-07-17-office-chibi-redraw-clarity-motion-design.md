# Office Chibi Redraw, Clarity, And Motion Design

## Goal

Replace the office background and all sixteen current office chibi atlases with newly drawn, sharper, more detailed art. Furniture, chairs, and activity props must be visually integrated with character actions instead of appearing once in the background and again in the animation. Slow the office motion system to a calm, natural pace. No existing office background or chibi artwork is retained.

The release target is GitHub Pages version `0.2.97`.

## Character Set

The final set remains exactly sixteen characters:

- Four female bosses.
- Four male bosses.
- Four female employees.
- Four male employees.

Every character must have a clearly distinct face, hairstyle, silhouette, outfit, palette, and professional personality. Bosses should read as more polished and authoritative than employees without becoming severe or visually older.

### Female Direction

- All eight female characters have visibly long hair in every directional and activity frame.
- Sweet, beautiful, cute, refined facial design.
- Detailed eyes, hair strands, accessories, layered clothing, and clean hands.
- Varied styles: elegant executive, soft romantic, modern fashion, refined creative, preppy, gentle office, chic minimalist, and graceful vintage.
- Clothing must not default to trousers. Across the eight female characters, at least four wear clearly different skirt or dress silhouettes, including a short A-line skirt, pleated short skirt, fitted short skirt, and a dress or midi skirt. The remaining characters may use tailored trousers, shorts, or another distinct professional silhouette.
- Skirts and dresses need clean hems, readable layering, suitable shoes, and natural fabric follow-through during walking and active poses.
- No short hair, childlike body proportions, identical pink outfits, or repeated faces.
- Avoid overly revealing cuts, copied school uniforms, and changing a skirt into trousers between directional or activity frames.

### Male Direction

- All eight male characters are handsome and cool, with varied temperaments.
- Varied styles: tailored executive, quiet intellectual, fashion-forward creative, relaxed founder, clean-cut professional, streetwear designer, elegant technical lead, and understated artist.
- Distinct hair, clothing, posture, face shape, and palette for each character.
- No generic suit clones, exaggerated muscles, facial hair that obscures expressions, or repeated silhouettes.

## Visual Style

- High-detail polished chibi illustration with clean line work and soft controlled shading.
- Pearl white and low-saturation palette with dusty rose, mist blue, muted lavender, charcoal, and restrained accent colors.
- Clear facial features and clothing edges at mobile display size.
- Transparent background with no text, labels, borders, UI, room scenery, or watermark.
- Character identity must remain consistent across all sixty-four frames in an atlas.
- Outfit category, skirt length, footwear, accessories, and major garment details must remain consistent across all sixty-four frames.

## Background Redraw

The office background is redrawn from scratch at `1080 x 1920` in the established pearl-white, low-saturation direction. It keeps the readable top boss zone, four employee zones in a `2 + 2` arrangement, a wide central conversation aisle, and a lower break area, but changes the furniture composition to support modular stations.

The base background contains only permanent architecture and built-ins:

- Walls, windows, floor, rugs, ceiling and wall lighting.
- Built-in cabinets, shelves, wall decor, plants, and fixed counter architecture.
- Soft contact-light zones that help modular furniture sit naturally in the scene.

The base background must not contain:

- Freestanding desks, office chairs, stools, computers, books, phones, food, game devices, or loose activity props.
- People, silhouettes, speech bubbles, text, UI, or baked shadows that imply a missing chair.

## Selected Layer Architecture

The approved direction is **C: modular stations**. The scene is composed in this order:

1. Architecture-only office background.
2. Dynamic workstation and break-area modules.
3. Character animation, including the currently used chair and action props.
4. Names, status labels, speech bubbles, and UI.

### Workstation Modules

Each of the five character slots has two transparent station states drawn in the same perspective, lighting, and materials as the background:

- `empty`: complete desk, empty chair, idle computer, and normal desk accessories. This state is shown while the character is walking, chatting away from the desk, eating, or otherwise absent.
- `active-shell`: the same desk and fixed structure, but with the chair, computer, and loose activity props removed. This state is shown while the character performs a seated home-position action.

The character's seated animation frame supplies exactly one matching chair plus the current activity props. Working supplies the active computer and documents; slacking supplies the selected phone, comic, or handheld device; gaming supplies the game device; reading supplies the book; series and short-video actions supply the correct screen device; idle supplies the chair and a quiet neutral desk pose.

The desk shell and character action must align as one illustration. No frame may show two chairs, two computers, duplicated books, duplicated devices, or a chair visible through the character.

### Break Module

The lower break area uses four transparent states so two dining anchors remain independent:

- Both seats empty.
- Left seat occupied.
- Right seat occupied.
- Both seats occupied.

An occupied break state removes the corresponding background stool and loose food. The eating animation supplies that stool, the selected meal, utensils, and the seated character as one action group. The other seat remains visually correct and can be occupied independently.

### Runtime State Rules

- A home station switches to `active-shell` only when its assigned character is at the home node in a seated activity or idle pose.
- The station switches back to `empty` before the character begins walking, so the walking atlas never carries furniture.
- Chatting, listening, meeting, and walking frames are standing poses with no chair or desk props.
- Break-module occupancy is derived from exact anchor reservations and eating phases; concurrent diners cannot alter each other's seat state.
- If a station module fails to load, the scene falls back to its empty station state and suppresses chair-bearing character frames until the matching shell is available, preventing duplicate furniture.

## Atlas Contract

Each character ships as one transparent WebP atlas with a strict `8 x 8` grid.

- Working master target: `2048 x 2048` pixels.
- Each cell: `256 x 256` pixels.
- Internal transparent gutter: at least `12` pixels around every cell boundary.
- Character feet and props must stay inside the cell; no clipping or cross-cell bleed.
- Production may retain the 2048 master directly if browser decoding and package size remain acceptable. Otherwise it may be losslessly or high-quality downsampled only after visual comparison confirms no clarity loss.

Rows retain the existing runtime contract, with furniture integrated only where the pose is seated:

1. Side walking, eight frames.
2. Front walking, eight frames.
3. Back walking, eight frames.
4. Working with chair/computer frames 1-4, slacking with chair/selected prop frames 5-8.
5. Eating with stool/meal frames 1-4, gaming with chair/device frames 5-8.
6. Reading with chair/book frames 1-4, watching a series with chair/device frames 5-8.
7. Short-video with chair/phone frames 1-4, standing chatting frames 5-8.
8. Seated idle-with-chair frames 1-4, standing listening frames 5-8.

Walking frames must show a believable alternating stride, arm swing, weight transfer, and hair or clothing follow-through. Skirt hems, dresses, coats, and long hair should move subtly without exposing or distorting the character. Activity frames must use visibly different poses rather than reusing one body with swapped props.

## Rendering Clarity

- Use a stable integer-sized character viewport near `100-104px` on phone layouts.
- Atlas background size and frame offsets must resolve to integer CSS pixels at the target viewport instead of fractional percentage sampling.
- Preserve smooth antialiasing; do not use pixel-art rendering modes.
- Names, status labels, bubbles, props, and nearby characters must remain non-overlapping at `375 x 812` and `390 x 844`.
- Station modules use stable aspect ratios and exact anchors so switching between `empty` and `active-shell` never moves the desk or changes scene geometry.

## Motion Timing

- Route speed: reduce from `18` to approximately `10` office units per second.
- Walk atlas: reduce from `12fps` to `8fps`.
- Four-frame activity atlas: change from one frame every `180ms` to approximately `320ms`.
- CSS body and prop loops: slow to roughly `1.3-1.8s` depending on the action.
- Keep route interpolation continuous on every animation frame. Slower movement must not reintroduce stepping or teleporting.

## Validation

- Automated asset audit confirms exactly sixteen WebP atlases, correct dimensions, alpha transparency, all sixty-four populated cells, transparent gutters, and no legacy office PNGs.
- Automated background audit confirms the new architecture-only `1080 x 1920` base contains no freestanding furniture, characters, UI, or activity props.
- Automated module audit covers ten workstation states and all four break states, alpha transparency, matching bounds, and exact empty/active alignment.
- Contact sheet is visually inspected at full resolution for identity consistency, long-haired female characters, the required skirt and dress variety, outfit continuity across all frames, handsome varied male characters, clean limbs, distinct outfits, and action readability.
- Browser QA at `375 x 812` and `390 x 844` verifies sharp rendering, five visible names, no overlap, correct activity props, isolated group chats, continuous slower walking, correct empty/active station switching, and zero duplicate chairs or props.
- Motion tests verify the new route speed and frame cadence.
- Full project tests, production build, Pages sync, online version marker, new bundle, background, and all sixteen live atlases must pass before completion.

## Release

- Bump package and runtime version references to `0.2.97`.
- Rebuild and sync `docs/`.
- Push the verified branch to `main`.
- Poll and smoke-test `https://sy719427083-glitch.github.io/ai-roleplay-phone/` until the live deployment reports `0.2.97` and loads the new bundle and atlas files.
