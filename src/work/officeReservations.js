const cloneReservation = (reservation) => (
  reservation && typeof reservation === "object" ? { ...reservation } : reservation
);

const cloneReservations = (reservations) => Object.fromEntries(
  Object.entries(reservations && typeof reservations === "object" && !Array.isArray(reservations)
    ? reservations
    : {}).map(([anchorId, reservation]) => [anchorId, cloneReservation(reservation)]),
);

const hasReservationForSlot = (reservations, slotId) => Object.values(reservations).some(
  (reservation) => reservation?.slotId === slotId,
);

const hasUniqueAnchorIds = (anchorIds) => (
  Array.isArray(anchorIds)
  && anchorIds.length > 0
  && anchorIds.every((anchorId) => typeof anchorId === "string" && anchorId.length > 0)
  && new Set(anchorIds).size === anchorIds.length
);

export function reserveAnchors(reservations, request = {}) {
  const anchorIds = request?.anchorIds;
  if (
    typeof request?.sceneId !== "string"
    || typeof request?.reservationGroupId !== "string"
    || typeof request?.slotId !== "string"
    || !hasUniqueAnchorIds(anchorIds)
  ) return null;

  const current = cloneReservations(reservations);
  if (hasReservationForSlot(current, request.slotId)) return null;
  if (anchorIds.some((anchorId) => Object.hasOwn(current, anchorId))) return null;

  const next = cloneReservations(current);
  for (const anchorId of anchorIds) {
    next[anchorId] = {
      anchorId,
      slotId: request.slotId,
      reservationGroupId: request.reservationGroupId,
      sceneId: request.sceneId,
      expiresAt: request.expiresAt,
    };
  }
  return next;
}

export function releaseReservationGroup(reservations, reservationGroupId) {
  const next = cloneReservations(reservations);
  for (const [anchorId, reservation] of Object.entries(next)) {
    if (reservation?.reservationGroupId === reservationGroupId) delete next[anchorId];
  }
  return next;
}
