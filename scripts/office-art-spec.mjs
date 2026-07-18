export const OFFICE_CANVAS = Object.freeze({ width: 1080, height: 1920 });

export const OFFICE_SLOT_RECTS = Object.freeze({
  boss: Object.freeze({ x: 346, y: 395, width: 389, height: 269 }),
  employee1: Object.freeze({ x: 100, y: 673, width: 346, height: 288 }),
  employee2: Object.freeze({ x: 634, y: 673, width: 346, height: 288 }),
  employee3: Object.freeze({ x: 100, y: 1080, width: 346, height: 288 }),
  employee4: Object.freeze({ x: 634, y: 1080, width: 346, height: 288 }),
  break: Object.freeze({ x: 32, y: 1613, width: 454, height: 250 }),
});

export const OFFICE_BACKGROUND_PROMPT = `Use case: stylized-concept
Asset type: portrait mobile game office architecture background
Primary request: redraw a premium airy office as architecture only, 1080 by 1920 portrait, orthographic three-quarter top-down mobile-game perspective. Use one continuous open-plan floor. Keep a luxurious boss rug zone at the top, four employee rug zones in a precise 2 by 2 arrangement, a wide central conversation aisle, and a lower break counter zone, all without internal enclosure. Every rug must have a clear empty center so its desk can be placed exactly in the middle with generous breathing room on every side.
Style/medium: high-detail polished Japanese mobile-game environment illustration, clean precise edges, soft controlled shading, elegant and fresh.
Color palette: pearl white dominant, pale cool gray, dusty rose, mist blue, muted lavender, restrained charcoal; green only as tiny plant accents and never dominant.
Materials/textures: white oak, frosted glass, pale stone, brushed silver, soft woven rugs.
Constraints: architecture and built-ins only; exterior glazing, continuous floor, flat rugs, ceiling lighting, perimeter cabinets, perimeter shelves, plants and fixed lower counter architecture are allowed. Leave clear contact-light zones for later furniture overlays. There must be no interior walls, half-height walls, cubicle dividers, or privacy partitions.
Avoid: freestanding desks, office chairs, stools, interior walls, room-within-room bays, raised wall edges around rugs, computers, books, phones, food, game devices, loose props, people, silhouettes, text, UI, watermark, dark green theme, heavy gradients.`;

export const OFFICE_MODULE_IDS = Object.freeze([
  "boss-empty", "boss-active-shell",
  "employee1-empty", "employee1-active-shell",
  "employee2-empty", "employee2-active-shell",
  "employee3-empty", "employee3-active-shell",
  "employee4-empty", "employee4-active-shell",
  "break-both-empty", "break-left-occupied", "break-right-occupied", "break-both-occupied",
]);

export const OFFICE_CHARACTER_SPECS = Object.freeze([
  { id: "boss-f-01", hair: "long glossy black waves with pearl side pin", outfit: "dusty-rose blazer, ivory blouse, fitted charcoal short skirt, sheer tights, pointed ankle boots", persona: "elegant executive" },
  { id: "boss-f-02", hair: "long chestnut half-up curls with ribbon barrette", outfit: "mist-blue belted midi dress, cropped ivory jacket, slingback heels", persona: "soft romantic founder" },
  { id: "boss-f-03", hair: "very long ash-brown straight hair with face-framing layers", outfit: "muted-lavender blouse, pearl-white tailored trousers, silver loafers", persona: "modern fashion director" },
  { id: "boss-f-04", hair: "long dark-plum low ponytail with curled ends", outfit: "ivory knit top, charcoal short A-line skirt, dusty-rose long vest, knee boots", persona: "refined creative chief" },
  { id: "boss-m-01", hair: "clean swept black hair", outfit: "charcoal tailored double-breasted suit, pearl-white open-collar shirt, black loafers", persona: "decisive executive" },
  { id: "boss-m-02", hair: "soft dark-brown side-part with fine fringe", outfit: "mist-blue turtleneck, pale-gray tailored coat, charcoal trousers, leather sneakers", persona: "quiet intellectual founder" },
  { id: "boss-m-03", hair: "textured ash-black crop", outfit: "muted-lavender overshirt, ivory tee, tapered black trousers, designer trainers", persona: "fashion-forward creative" },
  { id: "boss-m-04", hair: "slightly long wavy raven hair tucked behind one ear", outfit: "pearl-white knit polo, dusty-rose relaxed blazer, slate trousers, suede loafers", persona: "relaxed charismatic founder" },
  { id: "employee-f-01", hair: "long honey-brown twin low ponytails with soft curled ends", outfit: "mist-blue cardigan, ivory blouse, charcoal pleated short skirt, loafers", persona: "sweet preppy analyst" },
  { id: "employee-f-02", hair: "long straight blue-black hair with airy bangs", outfit: "dusty-rose blouse, pearl-white tailored shorts, ankle socks, Mary Jane shoes", persona: "gentle office planner" },
  { id: "employee-f-03", hair: "long warm-brown braid over one shoulder with loose wisps", outfit: "muted-lavender knit, ivory short A-line skirt, pale-gray boots", persona: "chic minimalist designer" },
  { id: "employee-f-04", hair: "long dark-auburn loose curls with velvet headband", outfit: "pearl-white blouse, dusty-rose suspender dress at the knee, low heels", persona: "graceful vintage editor" },
  { id: "employee-m-01", hair: "neat black comma hair", outfit: "mist-blue shirt jacket, ivory tee, charcoal chinos, white sneakers", persona: "clean-cut professional" },
  { id: "employee-m-02", hair: "spiky dark-brown undercut", outfit: "charcoal cropped jacket, muted-lavender hoodie, black cargo trousers, high-top sneakers", persona: "streetwear designer" },
  { id: "employee-m-03", hair: "smooth ash-brown layered hair", outfit: "pearl-white shirt, slate knit vest, tailored trousers, oxford shoes", persona: "elegant technical lead" },
  { id: "employee-m-04", hair: "medium wavy black hair with long fringe", outfit: "dusty-rose workwear overshirt, charcoal tee, loose pale-gray trousers, canvas shoes", persona: "understated artist" },
].map((spec) => Object.freeze(spec)));

const STATION_DIRECTIONS = Object.freeze({
  boss: Object.freeze({
    placement: "larger luxurious executive workstation",
    accent: "pearl-white and restrained charcoal with a subtle dusty-rose accent",
  }),
  employee1: Object.freeze({
    placement: "compact employee workstation for the upper-left bay",
    accent: "dusty-rose accent",
  }),
  employee2: Object.freeze({
    placement: "compact employee workstation for the upper-right bay",
    accent: "mist-blue accent",
  }),
  employee3: Object.freeze({
    placement: "compact employee workstation for the lower-left bay",
    accent: "muted-lavender accent",
  }),
  employee4: Object.freeze({
    placement: "compact employee workstation for the lower-right bay",
    accent: "neutral-charcoal accent",
  }),
});

export const getStationPairPrompt = (slotId) => {
  const direction = STATION_DIRECTIONS[slotId];
  if (!direction) throw new Error(`Unknown office station: ${slotId}`);

  return `Use case: stylized-concept
Asset type: paired modular furniture state sheet for a portrait mobile game office
Primary request: create a strict side-by-side two-state sheet of one front-facing workstation, specifically a ${direction.placement}. LEFT HALF is the EMPTY state: the complete desk, one empty chair, idle computer, desk lamp, and restrained accessories. RIGHT HALF is the ACTIVE-SHELL state: the identical desk geometry, materials, scale, camera, lighting, and fixed lamp, but removes the chair, computer, books, phone, food, controller, and all loose props.
Scene/backdrop: both halves use one perfectly flat solid #00ff00 chroma-key background for background removal.
Style/medium: high-detail polished Japanese mobile-game environment illustration, orthographic three-quarter top-down perspective matching a portrait office scene, clean precise edges, soft controlled shading.
Composition/framing: exact horizontal midpoint split; one state centered in each half with equal bounds and generous padding; identical desk silhouette and placement in both states; keep the desk's long front edge perfectly horizontal and parallel to the image edge; no diagonal, rotated, or corner-facing desk; no panel divider, labels, borders, or guides.
Lighting/mood: airy soft studio light consistent between both states; no cast shadow beyond a soft local contact shadow directly beneath the furniture.
Color palette: pearl white, pale cool gray, white oak, brushed silver, and ${direction.accent}; elegant low saturation.
Constraints: opaque furniture with crisp separable edges; the two states must be a true matched pair; keep all object pixels fully inside their own half; do not use #00ff00 anywhere in the furniture.
Avoid: people, silhouettes, diagonal desk placement, angled desk footprint, duplicate desks, extra chairs, perspective drift between states, mismatched scale, floor plane, room background, reflections, text, UI, watermark, green spill, gradient or textured backdrop.`;
};

export const getBreakSheetPrompt = () => `Use case: stylized-concept
Asset type: four-state modular break furniture sheet for a portrait mobile game office
Primary request: create a strict 2 x 2 state sheet containing only two stools and restrained plated food for an existing compact pearl-white break counter. The fixed break counter is already baked into the office background, so do not draw the counter in any cell. States in exact reading order: top-left: both seats empty; top-right: left occupied; bottom-left: right occupied; bottom-right: both occupied. Occupied means remove the corresponding stool and loose food. The bottom-right cell must be completely empty chroma-key background. No people appear in any state.
Scene/backdrop: all four cells use one perfectly flat solid #00ff00 chroma-key background for background removal.
Style/medium: high-detail polished Japanese mobile-game environment illustration, orthographic three-quarter top-down perspective matching a portrait office scene, clean precise edges, soft controlled shading.
Composition/framing: exact equal 2 x 2 grid; use identical stool and food geometry, scale, camera, lighting, and placement across matching states; equal bounds and generous padding; no dividers, labels, borders, or guides.
Lighting/mood: airy soft studio light consistent across all four states; no cast shadow beyond a soft local contact shadow directly beneath the furniture.
Color palette: pearl white, pale cool gray, white oak, brushed silver, dusty rose and mist blue food accents; elegant low saturation.
Constraints: opaque stools and food with crisp separable edges; all four states must be true matched variants; keep all object pixels fully inside their own cell; do not use #00ff00 anywhere in the objects.
Avoid: people, silhouettes, any counter or island, extra stools, state-order mistakes, perspective drift, mismatched scale, floor plane, room background, reflections, text, UI, watermark, green spill, gradient or textured backdrop.`;
