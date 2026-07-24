import { OBJECT_DESTINATIONS } from "./officeNavigation.js";

export const OFFICE_BACKGROUND_URL = "/ai-roleplay-phone/work-office-assets/orbit-office-background.png";
export const OFFICE_OBJECT_ASSETS = {
  bossDesk: "/ai-roleplay-phone/work-office-assets/orbit-boss-desk.png",
  employeeDesk: "/ai-roleplay-phone/work-office-assets/orbit-employee-desk.png",
  tea: "/ai-roleplay-phone/work-office-assets/orbit-tea-counter.png",
  doorLeft: "/ai-roleplay-phone/work-office-assets/orbit-door-left.png",
  doorRight: "/ai-roleplay-phone/work-office-assets/orbit-door-right.png",
};

export const OFFICE_FURNITURE = [
  { id: "leftDoor", kind: "door left-door", label: "左侧出口", destination: OBJECT_DESTINATIONS.leftDoor, asset: OFFICE_OBJECT_ASSETS.doorLeft },
  { id: "rightTopDoor", kind: "door right-top-door", label: "右上出口", destination: OBJECT_DESTINATIONS.rightTopDoor, asset: OFFICE_OBJECT_ASSETS.doorRight },
  { id: "rightMidDoor", kind: "door right-mid-door", label: "右侧出口", destination: OBJECT_DESTINATIONS.rightMidDoor, asset: OFFICE_OBJECT_ASSETS.doorRight },
  { id: "bossDesk", kind: "desk boss", label: "老板桌", destination: OBJECT_DESTINATIONS.bossDesk, asset: OFFICE_OBJECT_ASSETS.bossDesk },
  ...[1, 2, 3, 4, 5, 6].map((number) => ({
    id: `employee${number}Desk`,
    kind: `desk employee employee-${number} tone-${number}`,
    label: `员工桌 ${number}`,
    destination: OBJECT_DESTINATIONS[`employee${number}Desk`],
    asset: OFFICE_OBJECT_ASSETS.employeeDesk,
  })),
  { id: "tea", kind: "tea", label: "茶水吧台", destination: OBJECT_DESTINATIONS.tea, asset: OFFICE_OBJECT_ASSETS.tea },
];
