import { getBreakroomGeometry, getBreakroomPoint } from "./breakroomGeometry.js";
import { getSegmentDuration, getSegmentFacing, planOfficePath } from "./officePathfinding.js";

export const BREAKROOM_DESTINATIONS = Object.freeze({
  drinkCounter: "drink-counter",
  coffeeMachine: "coffee-machine",
  fridge: "fridge",
  microwave: "microwave",
  snackCabinet: "snack-cabinet",
  diningTable: "dining-table",
});

export function createBreakroomRoute({ from, destination, viewport }) {
  const goal = getBreakroomPoint(destination);
  if (!from || !goal || !viewport) return [];
  const geometry = getBreakroomGeometry(viewport);
  const path = planOfficePath({ start: from, goal, viewport, obstacles: geometry.obstacles });
  return path.slice(1).map((point, index) => {
    const previous = path[index];
    return {
      point,
      durationMs: getSegmentDuration(previous, point, viewport),
      facing: getSegmentFacing(previous, point),
    };
  });
}
