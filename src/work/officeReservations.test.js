import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_RESERVATION_TTL_MS,
  releaseReservationGroup,
  reserveAnchors,
} from "./officeReservations.js";

test("atomically reserves all desk visitor anchors or none", () => {
  const request = {
    sceneId: "office",
    reservationGroupId: "chat-1",
    slotId: "employee1",
    anchorIds: ["employee2:visitor-front", "employee2:visitor-left"],
  };
  const claimed = reserveAnchors({}, request);

  assert.deepEqual(Object.keys(claimed).sort(), request.anchorIds.slice().sort());
  assert.equal(reserveAnchors(claimed, { ...request, reservationGroupId: "chat-2" }), null);
  assert.deepEqual(releaseReservationGroup(claimed, "chat-1"), {});
});

test("clones inputs and stores complete reservation records", () => {
  const reservations = Object.freeze({
    "boss:visitor-front": Object.freeze({
      anchorId: "boss:visitor-front",
      slotId: "boss",
      reservationGroupId: "chat-boss",
      sceneId: "office",
      expiresAt: 1_780_000_000_000,
    }),
  });
  const request = {
    sceneId: "office",
    reservationGroupId: "chat-employee1",
    slotId: "employee1",
    anchorIds: ["employee2:visitor-front", "employee2:visitor-left"],
    expiresAt: 1_780_000_100_000,
    now: 1_779_000_000_000,
  };
  const claimed = reserveAnchors(reservations, request);

  assert.deepEqual(claimed["employee2:visitor-front"], {
    anchorId: "employee2:visitor-front",
    slotId: "employee1",
    reservationGroupId: "chat-employee1",
    sceneId: "office",
    expiresAt: 1_780_000_100_000,
  });
  assert.notStrictEqual(claimed["boss:visitor-front"], reservations["boss:visitor-front"]);
  assert.deepEqual(reservations, {
    "boss:visitor-front": {
      anchorId: "boss:visitor-front",
      slotId: "boss",
      reservationGroupId: "chat-boss",
      sceneId: "office",
      expiresAt: 1_780_000_000_000,
    },
  });

  const released = releaseReservationGroup(claimed, "chat-employee1");
  assert.deepEqual(released, reservations);
  assert.notStrictEqual(released["boss:visitor-front"], reservations["boss:visitor-front"]);
});

test("rejects duplicate owners and occupied anchors without partial writes", () => {
  const original = Object.freeze({
    "employee2:visitor-front": Object.freeze({
      anchorId: "employee2:visitor-front",
      slotId: "employee2",
      reservationGroupId: "chat-2",
      sceneId: "office",
      expiresAt: 1_780_000_000_000,
    }),
  });
  const request = {
    sceneId: "office",
    reservationGroupId: "chat-1",
    slotId: "employee1",
    anchorIds: ["employee1:visitor-front", "employee2:visitor-front"],
    expiresAt: 1_780_000_100_000,
  };

  assert.equal(reserveAnchors(original, request), null);
  assert.deepEqual(original, {
    "employee2:visitor-front": {
      anchorId: "employee2:visitor-front",
      slotId: "employee2",
      reservationGroupId: "chat-2",
      sceneId: "office",
      expiresAt: 1_780_000_000_000,
    },
  });
  assert.equal(reserveAnchors(original, {
    ...request,
    anchorIds: ["employee1:visitor-front"],
    slotId: "employee2",
  }), null);
});

test("allows an expired reservation to be taken over", () => {
  const now = 1_780_000_000_000;
  const reservations = {
    "employee2:visitor-front": {
      anchorId: "employee2:visitor-front",
      slotId: "employee2",
      reservationGroupId: "chat-2",
      sceneId: "office",
      expiresAt: now - 1,
    },
  };

  const claimed = reserveAnchors(reservations, {
    sceneId: "office",
    reservationGroupId: "chat-1",
    slotId: "employee1",
    anchorIds: ["employee2:visitor-front"],
    now,
  });

  assert.equal(claimed["employee2:visitor-front"].slotId, "employee1");
  assert.equal(reservations["employee2:visitor-front"].slotId, "employee2");
});

test("keeps an unexpired reservation occupied", () => {
  const now = 1_780_000_000_000;
  const reservations = {
    "employee2:visitor-front": {
      anchorId: "employee2:visitor-front",
      slotId: "employee2",
      reservationGroupId: "chat-2",
      sceneId: "office",
      expiresAt: now + 1,
    },
  };

  assert.equal(reserveAnchors(reservations, {
    sceneId: "office",
    reservationGroupId: "chat-1",
    slotId: "employee1",
    anchorIds: ["employee2:visitor-front"],
    now,
  }), null);
});

test("assigns a finite default expiry from the deterministic request clock", () => {
  const now = 1_780_000_000_000;
  const claimed = reserveAnchors({}, {
    sceneId: "office",
    reservationGroupId: "chat-1",
    slotId: "employee1",
    anchorIds: ["employee2:visitor-front"],
    now,
  });

  assert.equal(claimed["employee2:visitor-front"].expiresAt, now + DEFAULT_RESERVATION_TTL_MS);
});

test("rejects a requested expiry that has already elapsed", () => {
  const now = 1_780_000_000_000;

  assert.equal(reserveAnchors({}, {
    sceneId: "office",
    reservationGroupId: "chat-1",
    slotId: "employee1",
    anchorIds: ["employee2:visitor-front"],
    expiresAt: now,
    now,
  }), null);
});
