const area = (x, y, width = 26, height = 14) => ({ x, y, width, height });

const themeHitAreas = {
  modern: [area(22, 26, 40, 18), area(78, 26, 40, 18), area(78, 47, 34, 18), area(78, 69, 38, 20), area(22, 68, 40, 20)],
  ancient_cn: [area(22, 26, 40, 18), area(78, 26, 40, 18), area(77, 47, 36, 18), area(77, 68, 38, 20), area(22, 68, 40, 20)],
  xuanhuan: [area(22, 25, 40, 19), area(78, 25, 40, 19), area(77, 47, 36, 18), area(78, 68, 40, 20), area(22, 68, 40, 20)],
  western_fantasy: [area(22, 25, 40, 19), area(78, 25, 40, 19), area(77, 46, 36, 18), area(78, 69, 40, 20), area(22, 68, 40, 20)],
  scifi: [area(22, 25, 40, 19), area(78, 25, 40, 19), area(77, 46, 36, 18), area(78, 69, 40, 20), area(22, 68, 40, 20)],
  wasteland: [area(22, 26, 40, 19), area(78, 26, 40, 19), area(77, 48, 36, 18), area(78, 70, 36, 20), area(22, 68, 40, 20)],
};

const place = (type, name, icon, title, content, hitArea, color) => ({
  type,
  name,
  icon,
  title,
  content,
  hitArea,
  pin: { x: hitArea.x, y: hitArea.y },
  color,
});

export const WORK_MAP_THEMES = {
  modern: {
    id: "modern",
    name: "现代街区",
    asset: "map-modern.png",
    places: [
      place("bookstore", "书店", "writing", "新书上架", "按分类摆放新书并补齐书架标签", themeHitAreas.modern[0], "blue"),
      place("flower_shop", "花店", "beauty", "花束包装", "整理花材、包装花束并更新陈列", themeHitAreas.modern[1], "coral"),
      place("clinic", "诊所", "care", "临时陪护", "陪同候诊、记录状态并完成交接", themeHitAreas.modern[2], "mint"),
      place("parcel_station", "快递站", "delivery", "包裹分拣", "核对面单、分区归类并协助出库", themeHitAreas.modern[3], "gold"),
      place("cafe", "咖啡馆", "kitchen", "桌面整理", "整理桌椅、补齐用品并完成清洁", themeHitAreas.modern[4], "lavender"),
    ],
  },
  ancient_cn: {
    id: "ancient_cn",
    name: "古代城坊",
    asset: "map-ancient-cn.png",
    places: [
      place("yamen", "衙门", "review", "整理案卷", "核对卷宗、归档案册并登记缺页", themeHitAreas.ancient_cn[0], "blue"),
      place("inn", "客栈", "assistant", "客栈帮工", "整理客房、核对住客名册并补齐用品", themeHitAreas.ancient_cn[1], "coral"),
      place("medical_hall", "医馆", "care", "药柜清点", "核对药材、整理药柜并记录短缺", themeHitAreas.ancient_cn[2], "mint"),
      place("academy", "书院", "writing", "抄录典籍", "誊写书目、整理竹简并归还典籍", themeHitAreas.ancient_cn[3], "gold"),
      place("escort_agency", "镖局", "delivery", "核对镖单", "清点货箱、核验路线并登记交接", themeHitAreas.ancient_cn[4], "lavender"),
    ],
  },
  xuanhuan: {
    id: "xuanhuan",
    name: "玄幻仙境",
    asset: "map-xuanhuan.png",
    places: [
      place("sect_gate", "宗门山门", "night", "山门巡守", "巡查山门石阶、记录灵阵波动", themeHitAreas.xuanhuan[0], "blue"),
      place("alchemy", "炼丹阁", "review", "整理丹方", "将新到丹方归类并核对灵药标记", themeHitAreas.xuanhuan[1], "lavender"),
      place("herb_garden", "灵药园", "beauty", "照料灵药", "记录灵植长势、补充灵泉并清理杂草", themeHitAreas.xuanhuan[2], "mint"),
      place("mission_hall", "任务堂", "assistant", "登记委托", "核验任务玉简、整理等级并完成登记", themeHitAreas.xuanhuan[3], "gold"),
      place("forge", "炼器坊", "device", "清点灵材", "核对灵矿、归置器胚并登记损耗", themeHitAreas.xuanhuan[4], "coral"),
    ],
  },
  western_fantasy: {
    id: "western_fantasy",
    name: "西幻城邦",
    asset: "map-western-fantasy.png",
    places: [
      place("guild", "冒险者公会", "assistant", "登记委托", "整理委托板、核对等级并登记队伍", themeHitAreas.western_fantasy[0], "blue"),
      place("magic_academy", "魔法学院", "writing", "整理卷轴", "归档法术卷轴并核对借阅记录", themeHitAreas.western_fantasy[1], "lavender"),
      place("potion_shop", "药剂店", "care", "清点药剂", "检查瓶签、归置药剂并登记库存", themeHitAreas.western_fantasy[2], "mint"),
      place("smithy", "铁匠铺", "device", "整理锻材", "清点矿锭、归置工具并记录耗材", themeHitAreas.western_fantasy[3], "gold"),
      place("castle", "城堡", "night", "城墙巡查", "巡查城墙、记录岗哨并提交报告", themeHitAreas.western_fantasy[4], "coral"),
    ],
  },
  scifi: {
    id: "scifi",
    name: "星际港区",
    asset: "map-scifi.png",
    places: [
      place("research_lab", "研究舱", "review", "校对实验记录", "核对实验批次、标注异常并归档", themeHitAreas.scifi[0], "blue"),
      place("repair_dock", "维修坞", "device", "设备检修", "扫描设备状态、登记故障并更换组件", themeHitAreas.scifi[1], "coral"),
      place("trade_port", "贸易港", "shop", "货单核验", "核对货柜编号、整理清单并完成交接", themeHitAreas.scifi[2], "gold"),
      place("navigation_station", "导航站", "survey", "航线校准", "比对星图、修正航点并提交校准值", themeHitAreas.scifi[3], "lavender"),
      place("eco_cabin", "生态舱", "beauty", "生态维护", "记录植株状态、补充营养并清理舱室", themeHitAreas.scifi[4], "mint"),
    ],
  },
  wasteland: {
    id: "wasteland",
    name: "废土聚落",
    asset: "map-wasteland.png",
    places: [
      place("shelter", "避难所", "assistant", "物资登记", "核对入库物资、标记批次并登记库存", themeHitAreas.wasteland[0], "blue"),
      place("supply_station", "补给站", "shop", "补给分装", "清点饮水、分装口粮并核对领取表", themeHitAreas.wasteland[1], "gold"),
      place("medical_camp", "医疗营地", "care", "伤员协助", "整理床位、记录状态并完成物资交接", themeHitAreas.wasteland[2], "mint"),
      place("watch_post", "巡逻哨", "night", "外围巡查", "检查围栏、记录异常并更新巡逻图", themeHitAreas.wasteland[3], "lavender"),
      place("repair_station", "修理站", "device", "零件清点", "分类零件、检查工具并登记可用设备", themeHitAreas.wasteland[4], "coral"),
    ],
  },
};

export const getWorkTheme = (themeId) => WORK_MAP_THEMES[themeId] || WORK_MAP_THEMES.modern;

export const inferWorkMapTheme = (world = {}) => {
  if (
    world.workMapThemeMode === "manual"
    && world.workMapTheme
    && WORK_MAP_THEMES[world.workMapTheme]
  ) return world.workMapTheme;
  const source = `${world.genre || ""} ${world.tone || ""}`;
  if (/玄幻|仙侠|修真|高魔东方|高魔史诗/.test(source)) return "xuanhuan";
  if (/古代|宫廷|武侠|江湖/.test(source)) return "ancient_cn";
  if (/西幻|魔法|中世纪/.test(source)) return "western_fantasy";
  if (/科幻|星际|赛博|未来|殖民/.test(source)) return "scifi";
  if (/末世|废土|灾变/.test(source)) return "wasteland";
  return "modern";
};

export const withWorkMapTheme = (world = {}) => ({
  ...world,
  workMapThemeMode: world.workMapThemeMode === "manual" ? "manual" : "auto",
  workMapTheme: inferWorkMapTheme(world),
});

export const resolveWorkMapView = (worlds = [], selectedWorldId = "", source = "reality") => {
  const selectedWorld = worlds.find((world) => world.id === selectedWorldId) || worlds[0] || null;
  const themeId = source === "worldbook" && selectedWorld ? inferWorkMapTheme(selectedWorld) : "modern";
  return {
    selectedWorld,
    themeId,
    theme: getWorkTheme(themeId),
  };
};

const normalizeNumber = (value, fallback, min, max) => {
  const parsed = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(parsed) ? parsed : fallback));
};

const normalizeJob = (item, theme, index) => {
  const placeMeta = theme.places.find((entry) => entry.type === item?.placeType);
  if (!placeMeta) return null;
  const durationMinutes = Math.round(normalizeNumber(item.durationMinutes, 60, 30, 600));
  const level = Math.round(normalizeNumber(item.level, 1, 1, 5));
  const hourlyRate = Math.round(normalizeNumber(item.hourlyRate, 40 + level * 5, 5, 999));
  const reward = Math.round(normalizeNumber(item.reward, hourlyRate * (durationMinutes / 60), 5, 9999));
  return {
    ...item,
    themeId: theme.id,
    key: item.key || `${placeMeta.type}_${Date.now()}_${index}`,
    placeType: placeMeta.type,
    placeName: item.placeName || placeMeta.name,
    cn: item.cn || placeMeta.name,
    en: item.en || "Work",
    title: item.title || placeMeta.title,
    titleEn: item.titleEn || "World Work",
    content: item.content || placeMeta.content,
    contentEn: item.contentEn || "Complete the assigned work.",
    icon: placeMeta.icon,
    durationMinutes,
    hourlyRate,
    reward,
    level,
    distance: item.distance || `${(0.4 + index * 0.5).toFixed(1)} km`,
    pin: placeMeta.pin,
    hitArea: placeMeta.hitArea,
    color: placeMeta.color,
  };
};

export const normalizeThemeJobs = (items, themeId, fallbackFactory = () => null) => {
  const theme = getWorkTheme(themeId);
  return (Array.isArray(items) ? items : []).map((item, index) => {
    const normalized = normalizeJob(item, theme, index);
    if (normalized) return normalized;
    const fallback = fallbackFactory(index, theme.places[index % theme.places.length], theme);
    return normalizeJob(fallback, theme, index) || fallback;
  }).filter(Boolean);
};

export const buildLocalThemeJobs = (themeId) => {
  const theme = getWorkTheme(themeId);
  return theme.places.map((placeMeta, index) => normalizeJob({
    placeType: placeMeta.type,
    title: placeMeta.title,
    content: placeMeta.content,
    durationMinutes: 60 + index * 35,
    hourlyRate: 35 + index * 8,
    level: Math.min(5, index + 1),
  }, theme, index));
};

export const buildWorkGenerationPrompt = ({ world = null, themeId = "modern" } = {}) => {
  const theme = getWorkTheme(themeId);
  const worldLine = world
    ? `世界书：${world.name || "未命名世界"}；类型：${world.genre || "自定义"}；氛围：${world.tone || "未填写"}。`
    : "来源：现实世界。";
  const places = theme.places.map((entry) => `${entry.type}=${entry.name}（${entry.title}、${entry.content}）`).join("；");
  return `你是 Ccat OS 的工作派单生成器。${worldLine}
当前工作地图主题：${theme.name}。
只能从以下地点生成工作：${places}。
返回 5 个工作，每个地点恰好使用一次。建筑、placeType、placeName、title 和 content 必须相符。
只返回 JSON，不要 Markdown。格式：
{"jobs":[{"placeType":"${theme.places[0].type}","placeName":"${theme.places[0].name}","title":"${theme.places[0].title}","content":"${theme.places[0].content}","durationMinutes":90,"hourlyRate":45,"reward":70,"level":2}]}
规则：durationMinutes 30 到 600；reward 约等于 hourlyRate * durationMinutes / 60；level 1 到 5；不要生成白名单之外的现代、古代或幻想地点。`;
};
