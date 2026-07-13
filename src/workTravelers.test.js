import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_WORK_TRAVELER_ID,
  WORK_TRAVELER_GROUPS,
  formatWorkDuration,
  getWorkTraveler,
  normalizeWorkTravelerId,
} from "./workTravelers.js";

const flattenTravelers = () => WORK_TRAVELER_GROUPS.flatMap((group) => group.travelers.map((traveler) => ({
  ...traveler,
  groupId: group.id,
})));

test("defines four traveler groups with two distinct travelers each", () => {
  assert.deepEqual(
    WORK_TRAVELER_GROUPS.map((group) => ({ id: group.id, label: group.label })),
    [
      { id: "campus", label: "校园清新" },
      { id: "trend", label: "甜酷潮流" },
      { id: "literary", label: "温柔文艺" },
      { id: "luxe", label: "轻奢日常" },
    ],
  );

  const travelers = flattenTravelers();

  assert.equal(WORK_TRAVELER_GROUPS.length, 4);
  assert.ok(WORK_TRAVELER_GROUPS.every((group) => group.travelers.length === 2));
  assert.equal(travelers.length, 8);
  assert.equal(new Set(travelers.map((traveler) => traveler.id)).size, 8);
  assert.equal(new Set(travelers.map((traveler) => traveler.asset)).size, 8);
});

test("stores detailed metadata so travelers are not simple recolors", () => {
  const travelers = flattenTravelers();
  const femaleTravelers = travelers.filter((traveler) => traveler.gender === "female");
  const metadataSignature = (traveler) => [
    traveler.hair,
    traveler.headwear,
    traveler.bag,
    traveler.outfit,
    traveler.accent,
    traveler.shoes,
    traveler.silhouette,
  ].join("|");

  assert.equal(femaleTravelers.length, 4);
  assert.ok(femaleTravelers.every((traveler) => traveler.hair.startsWith("long-")));
  assert.ok(travelers.every((traveler) => (
    traveler.hair
    && traveler.headwear
    && traveler.bag
    && traveler.outfit
    && traveler.accent
    && traveler.shoes
    && traveler.silhouette
  )));
  assert.equal(new Set(travelers.map((traveler) => traveler.shoes)).size, travelers.length);
  assert.equal(new Set(travelers.map((traveler) => traveler.silhouette)).size, travelers.length);
  assert.equal(new Set(travelers.map(metadataSignature)).size, travelers.length);
  assert.ok(WORK_TRAVELER_GROUPS.every((group) => {
    const signatures = group.travelers.map(metadataSignature);
    return new Set(signatures).size === signatures.length;
  }));
});

test("normalizes invalid traveler ids back to the default traveler", () => {
  assert.equal(DEFAULT_WORK_TRAVELER_ID, "campus-female");
  assert.equal(normalizeWorkTravelerId(" trend-male "), "trend-male");
  assert.equal(normalizeWorkTravelerId("missing-traveler"), DEFAULT_WORK_TRAVELER_ID);
  assert.equal(normalizeWorkTravelerId(""), DEFAULT_WORK_TRAVELER_ID);
  assert.equal(getWorkTraveler("literary-male").name, "言舟");
  assert.equal(getWorkTraveler("missing-traveler").id, DEFAULT_WORK_TRAVELER_ID);
});

test("formats work durations with second accuracy", () => {
  assert.equal(formatWorkDuration(0), "00:00");
  assert.equal(formatWorkDuration(59_000), "00:59");
  assert.equal(formatWorkDuration(60_000), "01:00");
  assert.equal(formatWorkDuration(3_599_000), "59:59");
  assert.equal(formatWorkDuration(3_600_000), "01:00:00");
  assert.equal(formatWorkDuration(3_661_000), "01:01:01");
});
