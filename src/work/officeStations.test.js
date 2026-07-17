import assert from "node:assert/strict";
import test from "node:test";
import {
  OFFICE_BREAK_ASSETS,
  OFFICE_STATION_ASSETS,
  resolveOfficeModuleState,
} from "./officeStations.js";

const character = (overrides = {}) => ({
  phase: "active",
  activity: "working",
  positionNode: "employee1-home",
  homeNode: "employee1-home",
  ...overrides,
});

test("ships ten station states and four break states", () => {
  assert.equal(Object.keys(OFFICE_STATION_ASSETS).length, 5);
  assert.equal(Object.values(OFFICE_STATION_ASSETS).flatMap(Object.values).length, 10);
  assert.deepEqual(Object.keys(OFFICE_BREAK_ASSETS), [
    "both-empty", "left-occupied", "right-occupied", "both-occupied",
  ]);
});

test("uses active shell only for a seated activity at home", () => {
  const state = resolveOfficeModuleState({
    characters: { employee1: character() },
    reservations: {},
    loadedModuleIds: new Set(["employee1-active-shell"]),
  });
  assert.equal(state.stations.employee1.state, "active-shell");
  assert.equal(state.characters.employee1.furnitureReady, true);

  for (const moving of ["walkingToActivity", "returning", "chatting"]) {
    const next = resolveOfficeModuleState({
      characters: { employee1: character({ phase: moving }) },
      reservations: {},
      loadedModuleIds: new Set(["employee1-active-shell"]),
    });
    assert.equal(next.stations.employee1.state, "empty");
    assert.equal(next.characters.employee1.furnitureReady, true);
  }
});

test("keeps two break seats independent", () => {
  const state = resolveOfficeModuleState({
    characters: {
      employee1: character({ activity: "eating", positionNode: "break-1" }),
      employee2: character({ activity: "eating", positionNode: "break-2", homeNode: "employee2-home" }),
    },
    reservations: {
      "break-1": { anchorId: "break-1", slotId: "employee1" },
      "break-2": { anchorId: "break-2", slotId: "employee2" },
    },
    loadedModuleIds: new Set(["break-both-occupied"]),
  });
  assert.equal(state.breakArea.state, "both-occupied");
  assert.equal(state.characters.employee1.furnitureReady, true);
  assert.equal(state.characters.employee2.furnitureReady, true);
});

test("suppresses chair frames when an active shell is unavailable", () => {
  const state = resolveOfficeModuleState({
    characters: { employee1: character() },
    reservations: {},
    loadedModuleIds: new Set(),
  });
  assert.equal(state.stations.employee1.state, "empty");
  assert.equal(state.characters.employee1.furnitureReady, false);
});
