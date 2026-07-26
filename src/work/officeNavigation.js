import { getOfficeGeometry, getOfficePoint } from "./officeGeometry.js";
import { getSegmentDuration, getSegmentFacing, planOfficePath } from "./officePathfinding.js";

export const OBJECT_DESTINATIONS = Object.freeze({
  bossDesk: "boss-home",
  employee1Desk: "employee1-home",
  employee2Desk: "employee2-home",
  employee3Desk: "employee3-home",
  employee4Desk: "employee4-home",
  employee5Desk: "employee5-home",
  employee6Desk: "employee6-home",
  printStation: "print-station",
});

export function createOfficeRoute({ from, destination, viewport }) {
  const goal = getOfficePoint(destination);
  if (!from || !goal || !viewport) return [];
  const geometry = getOfficeGeometry(viewport);
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
