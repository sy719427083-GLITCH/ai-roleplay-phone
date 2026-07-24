import { OBJECT_DESTINATIONS } from "./officeNavigation.js";

export const OFFICE_BACKGROUND_URL = "/ai-roleplay-phone/work-office-assets/orbit-office-background.png";
export const OFFICE_OBJECT_ASSETS = {
  bossDesk: "/ai-roleplay-phone/work-office-assets/orbit-boss-desk.png",
  employeeDesk: "/ai-roleplay-phone/work-office-assets/orbit-employee-desk.png",
  tea: "/ai-roleplay-phone/work-office-assets/orbit-tea-counter.png",
};

export const OFFICE_FURNITURE = [
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
