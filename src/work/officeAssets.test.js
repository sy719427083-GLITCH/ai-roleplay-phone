import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";
import {
  OFFICE_CHIBIS,
  getActivityFrame,
  getOfficeChibi,
} from "./officeAssets.js";

const CATEGORIES = [
  ["boss", "female", "boss-f", "女老板"],
  ["boss", "male", "boss-m", "男老板"],
  ["employee", "female", "employee-f", "女员工"],
  ["employee", "male", "employee-m", "男员工"],
];

const EXPECTED_IDS = CATEGORIES.flatMap(([, , prefix]) => (
  Array.from({ length: 4 }, (_, index) => `${prefix}-${String(index + 1).padStart(2, "0")}`)
));

const EXPECTED_NAMES = CATEGORIES.flatMap(([, , , label]) => (
  Array.from({ length: 4 }, (_, index) => `${label} ${String(index + 1).padStart(2, "0")}`)
));

const publicAssetUrl = (src) => new URL(
  `../../public${src.replace(/^\/ai-roleplay-phone/, "")}`,
  import.meta.url,
);

test("ships all sixteen categorized chibi atlases", async () => {
  assert.equal(OFFICE_CHIBIS.length, 16);
  assert.deepEqual(OFFICE_CHIBIS.map((item) => item.id), EXPECTED_IDS);
  assert.deepEqual(OFFICE_CHIBIS.map((item) => item.name), EXPECTED_NAMES);
  assert.equal(new Set(OFFICE_CHIBIS.map((item) => item.src)).size, 16);

  for (const [kind, gender] of CATEGORIES) {
    assert.equal(
      OFFICE_CHIBIS.filter((item) => item.kind === kind && item.gender === gender).length,
      4,
    );
  }

  for (const item of OFFICE_CHIBIS) {
    assert.deepEqual(Object.keys(item), ["id", "name", "kind", "gender", "src"]);
    assert.ok(item.name.length > 0, `${item.id} should have a display name`);
    assert.equal(
      item.src,
      `/ai-roleplay-phone/work-office-assets/chibi/${item.id}.png`,
    );
  }

  await Promise.all(OFFICE_CHIBIS.map((item) => access(publicAssetUrl(item.src))));
});

test("looks up a chibi within its role and falls back within the requested role", () => {
  assert.equal(getOfficeChibi("boss-m-03", "boss").id, "boss-m-03");
  assert.equal(getOfficeChibi("employee-f-04", "employee").id, "employee-f-04");
  assert.equal(getOfficeChibi("missing", "boss").id, "boss-f-01");
  assert.equal(getOfficeChibi("boss-f-01", "employee").id, "employee-f-01");
});

test("maps activities and loop phases to all nine atlas cells", () => {
  const cases = [
    ["idle", 0, 0],
    ["walking", 0, 1],
    ["walking", 1, 2],
    ["walking", 2, 1],
    ["working", 0, 3],
    ["working", 1, 4],
    ["working", 2, 3],
    ["slacking", 0, 5],
    ["eating", 0, 6],
    ["gaming", 0, 7],
    ["chatting", 0, 8],
  ];

  for (const [activity, phase, expectedIndex] of cases) {
    assert.equal(getActivityFrame(activity, phase).index, expectedIndex, `${activity}:${phase}`);
  }
});

test("returns background-grid values that can be spread into a sprite style", () => {
  assert.deepEqual(getActivityFrame("working", 1), {
    index: 4,
    row: 1,
    column: 1,
    backgroundSize: "300% 300%",
    backgroundPosition: "50% 50%",
    "--office-frame-index": 4,
    "--office-frame-row": 1,
    "--office-frame-column": 1,
  });

  assert.deepEqual(getActivityFrame("unknown", 99), getActivityFrame("idle", 0));
});
