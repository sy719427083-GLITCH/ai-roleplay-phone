export const DEFAULT_RESERVATION_TTL_MS = 5 * 60 * 1_000;

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

const getReservationClock = (now) => (Number.isFinite(now) ? now : Date.now());

const removeExpiredReservations = (reservations, now) => {
  const next = cloneReservations(reservations);
  for (const [anchorId, reservation] of Object.entries(next)) {
    if (Number.isFinite(reservation?.expiresAt) && reservation.expiresAt <= now) {
      delete next[anchorId];
    }
  }
  return next;
};

export function reserveAnchors(reservations, request = {}) {
  const anchorIds = request?.anchorIds;
  if (
    typeof request?.sceneId !== "string"
    || typeof request?.reservationGroupId !== "string"
    || typeof request?.slotId !== "string"
    || !hasUniqueAnchorIds(anchorIds)
  ) return null;

  const now = getReservationClock(request.now);
  const hasRequestedExpiry = Object.hasOwn(request, "expiresAt") && Number.isFinite(request.expiresAt);
  if (hasRequestedExpiry && request.expiresAt <= now) return null;

  const current = removeExpiredReservations(reservations, now);
  if (hasReservationForSlot(current, request.slotId)) return null;
  if (anchorIds.some((anchorId) => Object.hasOwn(current, anchorId))) return null;

  const next = cloneReservations(current);
  const expiresAt = hasRequestedExpiry ? request.expiresAt : now + DEFAULT_RESERVATION_TTL_MS;
  for (const anchorId of anchorIds) {
    next[anchorId] = {
      anchorId,
      slotId: request.slotId,
      reservationGroupId: request.reservationGroupId,
      sceneId: request.sceneId,
      expiresAt,
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
