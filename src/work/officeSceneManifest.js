export const OFFICE_WORLD_SIZE = Object.freeze({ width: 1080, height: 1920 });

const object = ({ id, templateId, assetId, slotId = "", x, y, width, height, colliders = [], occlusionRects = [] }) => Object.freeze({
  id,
  templateId,
  assetId,
  slotId,
  x,
  y,
  width,
  height,
  colliders: Object.freeze(colliders.map((collider) => Object.freeze({ ...collider }))),
  occlusionRects: Object.freeze(occlusionRects.map((rectangle) => Object.freeze({ ...rectangle }))),
});

const freezeAnchors = (anchors) => Object.freeze(Object.fromEntries(
  Object.entries(anchors).map(([id, anchor]) => [id, Object.freeze({ ...anchor })]),
));

const OFFICE_SHARED_OBJECTS = Object.freeze([
  object({ id: "printer", templateId: "printer", assetId: "printer", x: 45, y: 1430, width: 210, height: 190, colliders: [{ x: 45, y: 1490, width: 210, height: 130 }] }),
  object({ id: "file-cabinet", templateId: "file-cabinet", assetId: "file-cabinet", x: 45, y: 310, width: 190, height: 300, colliders: [{ x: 45, y: 390, width: 190, height: 220 }] }),
  object({ id: "whiteboard", templateId: "whiteboard", assetId: "whiteboard", x: 800, y: 330, width: 220, height: 300, colliders: [{ x: 800, y: 560, width: 220, height: 70 }] }),
  object({ id: "office-door", templateId: "door", assetId: "office-door", x: 875, y: 1640, width: 170, height: 280, colliders: [{ x: 875, y: 1640, width: 25, height: 280 }, { x: 1020, y: 1640, width: 25, height: 280 }] }),
]);

const LOUNGE_OBJECTS = Object.freeze([
  object({ id: "pantry", templateId: "pantry", assetId: "pantry", x: 90, y: 250, width: 900, height: 280, colliders: [{ x: 90, y: 390, width: 900, height: 140 }] }),
  object({ id: "dining-table", templateId: "dining-table", assetId: "dining-table", x: 260, y: 720, width: 560, height: 330, colliders: [{ x: 260, y: 850, width: 560, height: 190 }], occlusionRects: [{ x: 260, y: 760, width: 560, height: 290 }] }),
  object({ id: "sofa", templateId: "sofa", assetId: "sofa", x: 240, y: 1400, width: 570, height: 300, colliders: [{ x: 240, y: 1570, width: 570, height: 130 }], occlusionRects: [{ x: 240, y: 1480, width: 570, height: 220 }] }),
  object({ id: "coffee-table", templateId: "coffee-table", assetId: "coffee-table", x: 420, y: 1670, width: 330, height: 170, colliders: [{ x: 420, y: 1710, width: 330, height: 130 }] }),
  object({ id: "television", templateId: "television", assetId: "television", x: 850, y: 1420, width: 210, height: 240, colliders: [{ x: 850, y: 1520, width: 210, height: 140 }] }),
  object({ id: "lounge-door", templateId: "door", assetId: "lounge-door", x: 35, y: 1640, width: 170, height: 280, colliders: [{ x: 35, y: 1640, width: 25, height: 280 }, { x: 180, y: 1640, width: 25, height: 280 }] }),
]);

const OFFICE_ANCHORS = freezeAnchors({
  entry: { x: 940, y: 1700 }, exit: { x: 940, y: 1770 }, delivery: { x: 840, y: 1690 },
  "office-chat:1": { x: 500, y: 1860 }, "office-chat:2": { x: 840, y: 1860 },
  "boss:seat": { x: 540, y: 410 }, "boss:seat-approach": { x: 540, y: 655 },
  "boss:visitor-front": { x: 540, y: 680 }, "boss:visitor-left": { x: 440, y: 665 }, "boss:visitor-right": { x: 640, y: 665 },
  "employee1:seat": { x: 280, y: 770 }, "employee1:seat-approach": { x: 280, y: 1120 },
  "employee1:visitor-front": { x: 280, y: 1140 }, "employee1:visitor-left": { x: 70, y: 1160 }, "employee1:visitor-right": { x: 500, y: 1160 },
  "employee2:seat": { x: 800, y: 770 }, "employee2:seat-approach": { x: 800, y: 1120 },
  "employee2:visitor-front": { x: 800, y: 1140 }, "employee2:visitor-left": { x: 580, y: 1160 }, "employee2:visitor-right": { x: 1010, y: 1160 },
  "employee3:seat": { x: 280, y: 1160 }, "employee3:seat-approach": { x: 300, y: 1520 },
  "employee3:visitor-front": { x: 280, y: 1450 }, "employee3:visitor-left": { x: 70, y: 1470 }, "employee3:visitor-right": { x: 500, y: 1470 },
  "employee4:seat": { x: 800, y: 1160 }, "employee4:seat-approach": { x: 800, y: 1520 },
  "employee4:visitor-front": { x: 800, y: 1450 }, "employee4:visitor-left": { x: 580, y: 1470 }, "employee4:visitor-right": { x: 1010, y: 1470 },
  "printer:front": { x: 300, y: 1450 }, "file-cabinet:front": { x: 285, y: 500 },
  "whiteboard:1": { x: 550, y: 700 }, "whiteboard:2": { x: 750, y: 700 }, "whiteboard:3": { x: 950, y: 700 },
});

const LOUNGE_ANCHORS = freezeAnchors({
  entry: { x: 130, y: 1710 }, exit: { x: 90, y: 1780 },
  "pantry:pickup": { x: 300, y: 600 }, "pantry:coffee": { x: 540, y: 600 }, "pantry:water": { x: 760, y: 600 },
  "dining:seat-1": { x: 330, y: 790 }, "dining:seat-2": { x: 750, y: 790 },
  "dining:seat-3": { x: 330, y: 1110 }, "dining:seat-4": { x: 750, y: 1110 },
  "dining:visitor-1": { x: 200, y: 1080 }, "dining:visitor-2": { x: 880, y: 1080 },
  "sofa:seat-1": { x: 380, y: 1530 }, "sofa:seat-2": { x: 530, y: 1530 }, "sofa:seat-3": { x: 680, y: 1530 },
  "sofa:visitor-1": { x: 360, y: 1860 }, "sofa:visitor-2": { x: 820, y: 1860 }, "tv:view": { x: 820, y: 1660 },
});

export const OFFICE_SCENES = Object.freeze({
  office: Object.freeze({
    id: "office",
    backgroundAssetId: "scene-office",
    objects: Object.freeze([
      object({ id: "boss-desk", templateId: "boss-desk", assetId: "boss-desk", slotId: "boss", x: 330, y: 350, width: 420, height: 250, colliders: [{ x: 330, y: 420, width: 420, height: 170 }] }),
      ...["employee1", "employee2", "employee3", "employee4"].map((slotId, index) => object({
        id: `${slotId}-desk`, templateId: "employee-desk", assetId: "employee-desk", slotId,
        x: index % 2 ? 610 : 90, y: index < 2 ? 720 : 1110, width: 380, height: 250,
        colliders: [{ x: index % 2 ? 610 : 90, y: index < 2 ? 790 : 1180, width: 380, height: 170 }],
      })),
      ...OFFICE_SHARED_OBJECTS,
    ]),
    anchors: OFFICE_ANCHORS,
  }),
  lounge: Object.freeze({
    id: "lounge",
    backgroundAssetId: "scene-lounge",
    objects: LOUNGE_OBJECTS,
    anchors: LOUNGE_ANCHORS,
  }),
});

export const OFFICE_DOOR_PAIRS = Object.freeze({
  "office:exit": Object.freeze({ sceneId: "lounge", anchorId: "entry" }),
  "lounge:exit": Object.freeze({ sceneId: "office", anchorId: "entry" }),
});

export function getSceneAnchor(sceneId, anchorId) {
  return OFFICE_SCENES[sceneId]?.anchors[anchorId] ?? null;
}

export function getSceneObject(sceneId, objectId) {
  return OFFICE_SCENES[sceneId]?.objects.find((sceneObject) => sceneObject.id === objectId) ?? null;
}
