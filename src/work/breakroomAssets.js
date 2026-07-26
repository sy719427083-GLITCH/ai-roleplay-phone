import { BREAKROOM_LAYOUT } from "./breakroomGeometry.js";
import { BREAKROOM_DESTINATIONS } from "./breakroomNavigation.js";

export const BREAKROOM_BACKGROUND_URL = "/ai-roleplay-phone/work-office-assets/orbit-breakroom-background.png";

export const BREAKROOM_FACILITIES = Object.freeze([
  { id: "drinkCounter", kind: "drink-counter", label: "饮品吧台", destination: BREAKROOM_DESTINATIONS.drinkCounter, message: "正在挑选饮品", asset: "/ai-roleplay-phone/work-office-assets/orbit-drink-counter.png", layout: BREAKROOM_LAYOUT.drinkCounter },
  { id: "coffeeMachine", kind: "coffee-machine", label: "咖啡机", destination: BREAKROOM_DESTINATIONS.coffeeMachine, message: "正在制作咖啡", asset: "/ai-roleplay-phone/work-office-assets/orbit-coffee-machine.png", layout: BREAKROOM_LAYOUT.coffeeMachine },
  { id: "fridge", kind: "fridge", label: "冰箱", destination: BREAKROOM_DESTINATIONS.fridge, message: "正在查看冰箱", asset: "/ai-roleplay-phone/work-office-assets/orbit-fridge.png", layout: BREAKROOM_LAYOUT.fridge },
  { id: "microwave", kind: "microwave", label: "微波炉", destination: BREAKROOM_DESTINATIONS.microwave, message: "正在加热餐食", asset: "/ai-roleplay-phone/work-office-assets/orbit-microwave.png", layout: BREAKROOM_LAYOUT.microwave },
  { id: "snackCabinet", kind: "snack-cabinet", label: "零食柜", destination: BREAKROOM_DESTINATIONS.snackCabinet, message: "正在挑选零食", asset: "/ai-roleplay-phone/work-office-assets/orbit-snack-cabinet.png", layout: BREAKROOM_LAYOUT.snackCabinet },
  { id: "diningTable", kind: "dining-table", label: "员工餐桌", destination: BREAKROOM_DESTINATIONS.diningTable, message: "正在用餐", asset: "/ai-roleplay-phone/work-office-assets/orbit-dining-table.png", layout: BREAKROOM_LAYOUT.diningTable },
]);
