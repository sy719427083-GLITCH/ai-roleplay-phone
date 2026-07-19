import { OFFICE_CHARACTER_IDS, getCharacterClipSource } from "./officeCharacterClips.js";

const CHARACTER_LABELS = Object.freeze([
  ["boss", "female", "boss-f", "女老板"],
  ["boss", "male", "boss-m", "男老板"],
  ["employee", "female", "employee-f", "女员工"],
  ["employee", "male", "employee-m", "男员工"],
]);

const firstKnownCharacterId = OFFICE_CHARACTER_IDS[0];

export const OFFICE_CHIBIS = Object.freeze(CHARACTER_LABELS.flatMap(([kind, gender, prefix, label]) => (
  Array.from({ length: 4 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    const id = `${prefix}-${number}`;
    return Object.freeze({
      id,
      name: `${label} ${number}`,
      kind,
      gender,
      src: getCharacterClipSource(id, "idle-standing").src,
      columns: 4,
      rows: 1,
    });
  })
)));

const asset = (path) => `${import.meta.env?.BASE_URL || "/"}work-office-v2/${path}`;

export const OFFICE_ASSET_MANIFEST = Object.freeze({
  scenes: Object.freeze({
    office: asset("scenes/office.webp"),
    lounge: asset("scenes/lounge.webp"),
  }),
  furniture: Object.freeze({
    "boss-desk": Object.freeze({ rear: asset("furniture/boss-desk-rear.webp"), front: asset("furniture/boss-desk-front.webp") }),
    "employee-desk": Object.freeze({ rear: asset("furniture/employee-desk-rear.webp"), front: asset("furniture/employee-desk-front.webp") }),
    "dining-table": Object.freeze({ rear: asset("furniture/dining-table-rear.webp"), front: asset("furniture/dining-table-front.webp") }),
    sofa: Object.freeze({ rear: asset("furniture/sofa-rear.webp"), front: asset("furniture/sofa-front.webp") }),
    "coffee-table": Object.freeze({ front: asset("furniture/coffee-table.webp") }),
    pantry: Object.freeze({ front: asset("furniture/pantry.webp") }),
    printer: Object.freeze({ front: asset("furniture/printer.webp") }),
    "file-cabinet": Object.freeze({ front: asset("furniture/file-cabinet.webp") }),
    whiteboard: Object.freeze({ front: asset("furniture/whiteboard.webp") }),
    television: Object.freeze({ front: asset("furniture/television.webp") }),
    "office-door": Object.freeze({ front: asset("furniture/office-door.webp") }),
    "lounge-door": Object.freeze({ front: asset("furniture/lounge-door.webp") }),
  }),
  props: Object.freeze({
    book: asset("props/book.webp"),
    "cleaning-cloth": asset("props/cleaning-cloth.webp"),
    "coffee-cup": asset("props/coffee-cup.webp"),
    "delivery-parcel": asset("props/delivery-parcel.webp"),
    "desk-organizer": asset("props/desk-organizer.webp"),
    "files-documents": asset("props/files-documents.webp"),
    "food-plate": asset("props/food-plate.webp"),
    "game-device": asset("props/game-device.webp"),
    headphones: asset("props/headphones.webp"),
    keyboard: asset("props/keyboard.webp"),
    laptop: asset("props/laptop.webp"),
    "meal-tray": asset("props/meal-tray.webp"),
    pen: asset("props/pen.webp"),
    phone: asset("props/phone.webp"),
    "printer-paper": asset("props/printer-paper.webp"),
    "sticky-notes": asset("props/sticky-notes.webp"),
    tablet: asset("props/tablet.webp"),
    "television-content": asset("props/television-content.webp"),
    utensils: asset("props/utensils.webp"),
    "water-cup": asset("props/water-cup.webp"),
  }),
});

export function getActorClipSource(actor = {}, clipId = "idle-standing") {
  const requestedCharacterId = actor.characterId || actor.chibiId || actor.assetId;
  const characterId = OFFICE_CHARACTER_IDS.includes(requestedCharacterId)
    ? requestedCharacterId
    : firstKnownCharacterId;
  return getCharacterClipSource(characterId, clipId);
}
