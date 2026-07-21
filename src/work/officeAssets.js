import { OBJECT_DESTINATIONS } from "./officeNavigation.js";

export const OFFICE_BACKGROUND_URL = "/ai-roleplay-phone/work-office-assets/office-background.png";

export const OFFICE_FURNITURE = [
  { id: "leftDoor", kind: "door left-door", label: "左侧门", destination: OBJECT_DESTINATIONS.leftDoor },
  { id: "rightTopDoor", kind: "door right-top-door", label: "右上门", destination: OBJECT_DESTINATIONS.rightTopDoor },
  { id: "rightMidDoor", kind: "door right-mid-door", label: "右侧门", destination: OBJECT_DESTINATIONS.rightMidDoor },
  { id: "bossDesk", kind: "desk boss", label: "老板桌", destination: OBJECT_DESTINATIONS.bossDesk },
  ...[1, 2, 3, 4].map((number) => ({
    id: `employee${number}Desk`,
    kind: `desk employee employee-${number}`,
    label: `员工桌 ${number}`,
    destination: OBJECT_DESTINATIONS[`employee${number}Desk`],
  })),
  { id: "tea", kind: "tea", label: "茶水吧台", destination: OBJECT_DESTINATIONS.tea },
];
