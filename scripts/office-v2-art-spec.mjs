export const OFFICE_V2_SCENE_IDS = Object.freeze(["scene-office", "scene-lounge"]);

export const OFFICE_V2_FURNITURE_IDS = Object.freeze([
  "employee-desk-rear", "employee-desk-front",
  "boss-desk-rear", "boss-desk-front",
  "printer", "whiteboard", "file-cabinet", "office-door", "lounge-door",
  "pantry", "dining-table-rear", "dining-table-front",
  "sofa-rear", "sofa-front", "coffee-table", "television",
]);

export const OFFICE_V2_PROP_IDS = Object.freeze([
  "phone", "book", "headphones", "keyboard", "laptop", "tablet", "game-device",
  "files-documents", "pen", "sticky-notes", "coffee-cup", "water-cup", "meal-tray",
  "food-plate", "printer-paper", "delivery-parcel", "television-content", "cleaning-cloth",
  "desk-organizer", "utensils",
]);

const CHARACTER_FORBIDDEN_BAKED_SUBJECTS = Object.freeze([
  "desk", "chair", "sofa", "table", "meal", "phone", "book", "screen",
  "computer", "food", "tray", "document", "parcel", "whiteboard", "furniture", "prop",
]);

const CHARACTER_NORMALIZATION = Object.freeze({
  cellSize: 384,
  feetAnchor: Object.freeze({ x: 192, y: 359 }),
  transparentEdgePadding: 24,
  sharpening: Object.freeze({
    method: "edge-preserving-unsharp-mask",
    radius: 0.6,
    amount: 0.35,
    threshold: 8,
  }),
  output: Object.freeze({ format: "webp", quality: 95 }),
});

const CHARACTER_PROMPT = `Use case: stylized-concept
Asset type: body-only office character animation master on a transparent background
Primary request: Draw one consistent adult chibi office character with a stable face, hairstyle,
outfit, proportions, and scale across every frame. Locomotion masters use an exact 8-column by
4-row grid with front, left, right, and back walking rows. Action masters use an exact 4-column by
1-row grid. Walking must show alternating legs, opposing arm swing, weight transfer, and stable
foot contact. Seated poses use the same body and foot anchors without drawing the seat.
Composition/framing: center the character's feet on the shared frame anchor. Keep the complete hair,
hands, clothing, and shoes inside every cell with at least 24 transparent pixels on every edge.
Style/medium: polished Japanese mobile-game chibi, crisp anime line art, restrained cel shading,
detailed readable facial and garment edges, no soft focus.
Constraints: body only. All interaction objects are separate runtime layers. Do not bake a desk,
chair, sofa, table, meal, phone, book, screen, computer, food, tray, document, parcel, whiteboard,
furniture, prop, floor, room scenery, cast shadow, text, border, grid line, or watermark into a frame.
Normalization: slice the transparent grid cells, align every pair of feet to x 192 and baseline y
359, preserve a 24-pixel transparent gutter on all sides, apply restrained edge-preserving unsharp
mask sharpening, and encode lossless-alpha WebP at quality 95.`;

export const OFFICE_V2_CHARACTER_CONTRACT = Object.freeze({
  bodyOnly: true,
  prompt: CHARACTER_PROMPT,
  forbiddenBakedSubjects: CHARACTER_FORBIDDEN_BAKED_SUBJECTS,
  masters: Object.freeze({
    locomotion: Object.freeze({ width: 3072, height: 1536, columns: 8, rows: 4 }),
    action: Object.freeze({ width: 1536, height: 384, columns: 4, rows: 1 }),
  }),
  source: Object.freeze({
    background: "transparent",
    sliceMode: "fixed-grid-cells",
    acceptsGeneratedMasters: true,
  }),
  normalization: CHARACTER_NORMALIZATION,
});

const STYLE = `polished Japanese mobile-game environment illustration, hand-drawn clean 2D line
art, high near-orthographic camera with a straight front-facing layout, simplified planar geometry,
precise outlines, flat color shapes, restrained two-step cel shading, sharp readable edges,
realistic workplace scale, pearl white and light neutral gray, white oak, mist-blue and restrained
dusty-rose accents, elegant low saturation, no green-dominant palette`;

const CHROMA = `Create the isolated subject on a perfectly flat solid #00ff00 chroma-key background
for background removal. The background must be one uniform color with no shadows, gradients,
texture, reflections, floor plane, or lighting variation. Keep the subject fully separated from
the background with crisp edges and generous padding. Do not use #00ff00 anywhere in the subject.
No cast shadow, no contact shadow, no reflection, no people, no text, no watermark.`;

const scenePrompt = (scene) => scene === "office" ? `Use case: stylized-concept
Asset type: architecture-only 2160x3840 portrait mobile-game office map background
Primary request: Create a finished 2D office room board for furniture sprites placed by logical x/y
coordinates. Use a high near-orthographic camera looking straight down with only a tiny front-facing
tilt and no isometric rotation. At least 94 percent of the canvas is one continuous pale white-oak
hard floor. Show only a narrow pearl-white top baseboard and thin perimeter trim. The usable floor
begins within the top 5 percent. Floorboard scale stays constant with no perspective convergence.
Add only a small threshold notch at the extreme lower-right edge for the overlaid office door.
Style/medium: ${STYLE}.
Constraints: architecture only and completely unfurnished; no door leaf or frame baked in; no
ceiling, horizon, windows, city view, furniture, fixtures, plants, props, people, rugs, carpet,
mats, floor zones, inlays, platforms, internal walls, partitions, cubicles, text, or watermark.
Avoid: photorealism, photography, 3D render, CGI, ray tracing, dramatic shadows, lens perspective,
fisheye, strong vanishing point, blur, isometric view.` : `Use case: stylized-concept
Asset type: architecture-only 2160x3840 portrait mobile-game lounge map background
Primary request: Create a finished 2D workplace lounge room board for furniture sprites placed by
logical x/y coordinates. Match the office map's high near-orthographic camera and straight
front-facing layout. At least 94 percent of the canvas is one continuous pale white-oak hard floor.
Show only a narrow pearl-white top baseboard and thin perimeter trim. The usable floor begins within
the top 5 percent. Floorboard scale stays constant with no perspective convergence. Add only a small
threshold notch at the extreme lower-left edge for the overlaid return door.
Style/medium: ${STYLE}.
Constraints: architecture only and completely unfurnished; no door leaf or frame baked in; no
ceiling, horizon, windows, city view, pantry, dining furniture, sofa, television, fixtures, plants,
props, people, rugs, carpet, mats, floor zones, inlays, platforms, internal walls, partitions, text,
or watermark.
Avoid: photorealism, photography, 3D render, CGI, ray tracing, dramatic shadows, lens perspective,
fisheye, strong vanishing point, blur, isometric view.`;

const FURNITURE_SUBJECTS = Object.freeze({
  "employee-desk": "one complete compact employee workstation with pearl-white desk, white-oak worktop, one elegant light-gray office chair, slim monitor, and understated cable management",
  "boss-desk": "one complete executive workstation with a wider pearl-white and white-oak desk, one elegant light-gray executive chair, slim monitor, and understated storage pedestal",
  printer: "one premium compact office printer and copier with closed paper trays",
  whiteboard: "one clean mobile planning whiteboard on a slim brushed-silver stand, blank surface",
  "file-cabinet": "one tall pearl-white office file cabinet with closed drawers and restrained mist-blue handles",
  "office-door": "one real open office door and slim pearl-white frame viewed from inside, hinged on the right, no surrounding wall",
  "lounge-door": "one real open return door and slim pearl-white frame viewed from inside, hinged on the left, no surrounding wall",
  pantry: "one continuous workplace pantry unit with pearl-white cabinets, sink, compact refrigerator, coffee machine, water dispenser, storage and clear pickup counter",
  "dining-table": "one real four-seat workplace dining table with white-oak top and four matching light-gray dining chairs, empty tabletop",
  sofa: "one elegant three-seat low-profile mist-blue and pearl-gray workplace sofa viewed strictly from the back, with a continuous rear shell and the seat hidden",
  "coffee-table": "one low oval pearl-white and white-oak coffee table, empty surface",
  television: "one slim television on a pearl-white low media cabinet, blank dark screen",
});

const PROP_SUBJECTS = Object.freeze({
  phone: "one modern graphite smartphone with blank screen",
  book: "one closed muted-lavender hardcover book with no title",
  headphones: "one pair of elegant over-ear graphite and pearl-gray headphones",
  keyboard: "one slim pearl-white computer keyboard",
  laptop: "one open slim silver laptop with a blank mist-blue screen",
  tablet: "one slim graphite tablet with a blank dark screen",
  "game-device": "one compact handheld game device in pearl-gray and dusty rose with blank screen",
  "files-documents": "one tidy stack of office documents with a pale-blue file folder, no readable text",
  pen: "one elegant brushed-silver pen",
  "sticky-notes": "one small arranged set of dusty-rose, mist-blue and muted-lavender sticky notes, blank",
  "coffee-cup": "one pearl-white ceramic coffee cup with a restrained dusty-rose rim, opaque beverage",
  "water-cup": "one reusable pearl-gray water tumbler with mist-blue band, opaque material",
  "meal-tray": "one workplace meal tray with compartments, white and light-gray materials",
  "food-plate": "one ceramic plate with a simple colorful balanced lunch, low-saturation food colors",
  "printer-paper": "one neat output stack of blank printer paper",
  "delivery-parcel": "one small sealed light-gray delivery parcel with a blank label",
  "television-content": "one abstract television program frame using mist-blue, dusty-rose, pearl-white and charcoal shapes, no text",
  "cleaning-cloth": "one folded pale-blue microfiber cleaning cloth with a small pearl-white cleaning brush",
  "desk-organizer": "one compact pearl-white desk organizer holding blank note cards and two pens",
  utensils: "one clean brushed-silver fork, spoon and pair of chopsticks arranged together",
});

const furniturePrompt = (id) => `Use case: stylized-concept
Asset type: isolated modular furniture for a portrait mobile game office
Primary request: ${FURNITURE_SUBJECTS[id]}.
Style/medium: ${STYLE}. Match the same centered camera and upper-left lighting as the scene masters.
Composition/framing: show the complete object, centered, generous padding, no clipped edges.
Constraints: furniture only; no people and no unrelated props. ${CHROMA}`;

const propPrompt = (id) => `Use case: stylized-concept
Asset type: isolated activity prop for a portrait mobile game office
Primary request: ${PROP_SUBJECTS[id]}.
Style/medium: ${STYLE}. Match the same centered camera and upper-left lighting as the scene masters.
Composition/framing: one complete compact prop set, centered, generous padding, no clipped edges.
Constraints: prop only; no hands, people, furniture, room scenery, or unrelated objects. ${CHROMA}`;

const TRANSPARENT_OUTPUTS = Object.freeze({
  "employee-desk": Object.freeze({ width: 1520, height: 1000, split: 0.58 }),
  "boss-desk": Object.freeze({ width: 1680, height: 1000, split: 0.58 }),
  printer: Object.freeze({ width: 840, height: 760 }),
  whiteboard: Object.freeze({ width: 880, height: 1200 }),
  "file-cabinet": Object.freeze({ width: 760, height: 1200 }),
  "office-door": Object.freeze({ width: 680, height: 1120 }),
  "lounge-door": Object.freeze({ width: 680, height: 1120 }),
  pantry: Object.freeze({ width: 1800, height: 700 }),
  "dining-table": Object.freeze({ width: 1600, height: 1000, split: 0.58 }),
  sofa: Object.freeze({ width: 1600, height: 900, split: 0.55 }),
  "coffee-table": Object.freeze({ width: 1000, height: 600 }),
  television: Object.freeze({ width: 840, height: 960 }),
  ...Object.fromEntries(OFFICE_V2_PROP_IDS.map((id) => [id, Object.freeze({ width: 768, height: 768 })])),
});

export const OFFICE_V2_ART_SPEC = Object.freeze({
  scenes: Object.freeze({
    "scene-office": Object.freeze({ source: "scene-office.png", output: "scenes/office.webp", width: 2160, height: 3840, prompt: scenePrompt("office") }),
    "scene-lounge": Object.freeze({ source: "scene-lounge.png", output: "scenes/lounge.webp", width: 2160, height: 3840, prompt: scenePrompt("lounge") }),
  }),
  furnitureSources: Object.freeze(Object.fromEntries(Object.keys(FURNITURE_SUBJECTS).map((id) => [id, Object.freeze({
    source: `furniture-${id}.png`, prompt: furniturePrompt(id), ...TRANSPARENT_OUTPUTS[id],
  })]))),
  props: Object.freeze(Object.fromEntries(OFFICE_V2_PROP_IDS.map((id) => [id, Object.freeze({
    source: `prop-${id}.png`, output: `props/${id}.webp`, prompt: propPrompt(id), ...TRANSPARENT_OUTPUTS[id],
  })]))),
  runtimeAliases: Object.freeze({
    office: "/ai-roleplay-phone/work-office-v2/scenes/office.webp",
    lounge: "/ai-roleplay-phone/work-office-v2/scenes/lounge.webp",
    "boss-desk": "/ai-roleplay-phone/work-office-v2/objects/boss-desk.webp",
    "employee-desk": "/ai-roleplay-phone/work-office-v2/objects/employee-desk.webp",
    pantry: "/ai-roleplay-phone/work-office-v2/objects/pantry.webp",
  }),
  constraints: Object.freeze({
    sceneDimensions: Object.freeze({ width: 2160, height: 3840 }),
    sceneOpaque: true,
    transparentMinimumRatio: 0.08,
    usefulCoverageMinimumRatio: 0.015,
    bannedFilenameParts: Object.freeze(["rug", "carpet", "employee1-desk", "employee2-desk", "employee3-desk", "employee4-desk"]),
  }),
});

export function getOfficeV2PromptSet() {
  return Object.freeze([
    ...Object.entries(OFFICE_V2_ART_SPEC.scenes).map(([id, spec]) => Object.freeze({ id, prompt: spec.prompt })),
    ...Object.entries(OFFICE_V2_ART_SPEC.furnitureSources).map(([id, spec]) => Object.freeze({ id: `furniture-${id}`, prompt: spec.prompt })),
    ...Object.entries(OFFICE_V2_ART_SPEC.props).map(([id, spec]) => Object.freeze({ id: `prop-${id}`, prompt: spec.prompt })),
  ]);
}
