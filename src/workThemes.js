import { getWorkRouteTheme } from "./workRouteData.js";

export { interpolateWorkRoute } from "./workRouteData.js";

const area = (x, y, width = 26, height = 14) => ({ x, y, width, height });

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

const theme = (id, tag, name, asset, hitAreas, places) => ({
  id,
  tag,
  name,
  asset,
  places: places.map(([type, placeName, icon, title, content, color], index) => (
    place(type, placeName, icon, title, content, hitAreas[index], color)
  )),
});

export const TAG_WORK_THEME_IDS = Object.freeze({
  "上古": "prehistoric",
  "古代": "ancient",
  "西域": "western_regions",
  "仙侠": "xianxia",
  "玄幻": "xuanhuan",
  "秘境": "mystic_realm",
  "地府幽冥": "underworld",
  "中世纪": "medieval",
  "西幻": "western_fantasy",
  "奇幻": "fantasy",
  "魔法世界": "magic_world",
  "魔法学院": "magic_academy",
  "海岛": "island",
  "海洋": "ocean",
  "民国": "republican",
  "港风": "hong_kong",
  "现代": "modern",
  "校园": "campus",
  "冰河时代": "ice_age",
  "废土末世": "wasteland",
  "赛博朋克": "cyberpunk",
  "科幻星际": "scifi",
  "外星文明": "alien_civilization",
  "网游": "online_game",
  "克苏鲁": "cthulhu",
});

const LEGACY_THEME_ID_MIGRATIONS = Object.freeze({
  ancient_cn: "ancient",
  western_fantasy: "western_fantasy",
  xuanhuan: "xuanhuan",
  scifi: "scifi",
  wasteland: "wasteland",
  modern: "modern",
});

export const WORK_MAP_THEMES = {
  prehistoric: theme("prehistoric", "上古", "上古荒原", "map-prehistoric.png", [
    area(46, 12, 24, 16), area(76, 34, 20, 15), area(55, 69, 23, 15), area(16, 61, 22, 17), area(13, 29, 21, 16),
  ], [
    ["fire_pit", "篝火营地", "kitchen", "续添柴薪", "整理柴堆、维持火种并记录夜间值守", "coral"],
    ["cave_archive", "岩洞壁画", "writing", "拓录壁画", "清理岩壁、拓录图样并归档颜料", "gold"],
    ["riverbank", "河湾采集点", "beauty", "采集浆果", "分拣浆果、清洗容器并记录采集量", "mint"],
    ["bone_workshop", "骨器工坊", "device", "整理骨器", "清点骨料、归置工具并登记成品", "blue"],
    ["stone_lookout", "石台瞭望处", "night", "荒原瞭望", "观察兽群动向、更新石刻标记并交接", "lavender"],
  ]),
  ancient: theme("ancient", "古代", "古代城坊", "map-ancient.png", [
    area(13, 18, 28, 16), area(43, 32, 24, 15), area(68, 46, 24, 16), area(47, 67, 27, 15), area(17, 73, 24, 15),
  ], [
    ["yamen", "衙门", "review", "整理案卷", "核对卷宗、归档案册并登记缺页", "blue"],
    ["inn", "客栈", "assistant", "客栈帮工", "整理客房、核对住客名册并补齐用品", "coral"],
    ["medical_hall", "医馆", "care", "药柜清点", "核对药材、整理药柜并记录短缺", "mint"],
    ["academy", "书院", "writing", "抄录典籍", "誊写书目、整理竹简并归还典籍", "gold"],
    ["escort_agency", "镖局", "delivery", "核对镖单", "清点货箱、核验路线并登记交接", "lavender"],
  ]),
  western_regions: theme("western_regions", "西域", "西域商道", "map-western-regions.png", [
    area(12, 61, 26, 17), area(30, 43, 23, 15), area(51, 30, 25, 16), area(72, 15, 20, 17), area(72, 69, 21, 16),
  ], [
    ["caravanserai", "驼队客舍", "assistant", "安置驼队", "核对货囊、补给饮水并登记客商", "coral"],
    ["oasis_well", "绿洲井台", "care", "清理井台", "清点水桶、清理井沿并记录取水", "mint"],
    ["silk_bazaar", "丝路市集", "shop", "货品陈列", "分区陈列织物、核对价签并整理摊位", "gold"],
    ["desert_observatory", "星象台", "survey", "校准星盘", "比对星位、擦拭星盘并抄录观测", "blue"],
    ["beacon_tower", "烽燧台", "night", "传递烽讯", "检查烽柴、记录风向并完成值守", "lavender"],
  ]),
  xianxia: theme("xianxia", "仙侠", "仙侠云山", "map-xianxia.png", [
    area(46, 11, 25, 17), area(73, 29, 20, 16), area(64, 61, 24, 17), area(25, 65, 22, 16), area(12, 32, 23, 16),
  ], [
    ["sword_peak", "剑峰", "night", "剑阵巡查", "巡查剑阵灵光、记录风势并校正阵旗", "blue"],
    ["talisman_hall", "符箓堂", "writing", "整理符纸", "归置符纸、核对朱砂并登记新符", "gold"],
    ["spirit_beast_garden", "灵兽园", "beauty", "照料灵兽", "补充灵食、清理兽舍并记录状态", "mint"],
    ["cloud_ferry", "云舟渡口", "delivery", "核验云舟单", "核对行李玉牌、安排登舟并完成交接", "coral"],
    ["scripture_pavilion", "藏经阁", "review", "归架经卷", "清点经卷、修复标签并更新借阅册", "lavender"],
  ]),
  xuanhuan: theme("xuanhuan", "玄幻", "玄幻仙境", "map-xuanhuan.png", [
    area(26, 27, 52, 24), area(77, 27, 42, 22), area(77, 48, 40, 20), area(76, 69, 42, 22), area(24, 69, 44, 23),
  ], [
    ["sect_gate", "宗门山门", "night", "山门巡守", "巡查山门石阶、记录灵阵波动", "blue"],
    ["alchemy", "炼丹阁", "review", "整理丹方", "将新到丹方归类并核对灵药标记", "lavender"],
    ["herb_garden", "灵药园", "beauty", "照料灵药", "记录灵植长势、补充灵泉并清理杂草", "mint"],
    ["mission_hall", "任务堂", "assistant", "登记委托", "核验任务玉简、整理等级并完成登记", "gold"],
    ["forge", "炼器坊", "device", "清点灵材", "核对灵矿、归置器胚并登记损耗", "coral"],
  ]),
  mystic_realm: theme("mystic_realm", "秘境", "秘境迷谷", "map-mystic-realm.png", [
    area(42, 13, 23, 15), area(65, 28, 21, 17), area(56, 50, 25, 15), area(31, 63, 22, 18), area(14, 44, 20, 16),
  ], [
    ["realm_gate", "秘境门扉", "night", "看守门扉", "擦拭门纹、记录开启时辰并值守", "blue"],
    ["crystal_grotto", "晶石洞窟", "device", "晶石分拣", "分类晶石、核对光泽并登记库存", "lavender"],
    ["floating_bridge", "悬桥", "survey", "检修悬桥", "检查桥索、标记裂纹并更新通行牌", "gold"],
    ["relic_vault", "遗物库", "review", "封存遗物", "核验封条、归置遗物并记录来源", "coral"],
    ["mist_pond", "雾泉", "beauty", "净化雾泉", "清理泉边、采集水样并记录雾气变化", "mint"],
  ]),
  underworld: theme("underworld", "地府幽冥", "幽冥渡口", "map-underworld.png", [
    area(14, 12, 28, 16), area(14, 35, 28, 16), area(14, 61, 28, 16), area(59, 24, 27, 17), area(59, 62, 27, 16),
  ], [
    ["ghost_gate", "鬼门关", "night", "关门值守", "核对通关文牒、引导队列并完成交班", "blue"],
    ["judgment_hall", "判官殿", "review", "整理判簿", "归档判簿、核对姓名并补齐索引", "gold"],
    ["forgotten_river", "忘川渡口", "delivery", "引渡魂灵", "清点渡牌、维护栈桥并安排登舟", "coral"],
    ["spirit_registry", "生死簿阁", "writing", "校录名册", "比对名册、修正笔误并登记变更", "lavender"],
    ["mengpo_pavilion", "孟婆亭", "kitchen", "整理汤盏", "清洗汤盏、补齐药草并登记领取", "mint"],
  ]),
  medieval: theme("medieval", "中世纪", "中世纪小镇", "map-medieval.png", [
    area(42, 28, 24, 16), area(69, 15, 21, 17), area(73, 52, 20, 16), area(46, 71, 23, 15), area(13, 54, 22, 17),
  ], [
    ["market_square", "集市广场", "shop", "整理摊位", "归置货篮、更新价牌并清扫摊位", "gold"],
    ["monastery", "修道院", "writing", "誊写手稿", "整理羊皮纸、抄录手稿并归档", "lavender"],
    ["town_armory", "城镇军械库", "device", "清点军械", "核对盾牌、归置器械并登记耗损", "blue"],
    ["horse_stable", "马厩", "beauty", "照料马匹", "补充草料、清理马厩并记录状态", "mint"],
    ["watchtower", "钟楼哨塔", "night", "钟楼巡查", "检查钟绳、记录来访并完成值守", "coral"],
  ]),
  western_fantasy: theme("western_fantasy", "西幻", "西幻城邦", "map-western-fantasy.png", [
    area(22, 25, 40, 19), area(78, 25, 40, 19), area(77, 46, 36, 18), area(78, 69, 40, 20), area(22, 68, 40, 20),
  ], [
    ["guild", "冒险者公会", "assistant", "登记委托", "整理委托板、核对等级并登记队伍", "blue"],
    ["magic_academy", "魔法学院", "writing", "整理卷轴", "归档法术卷轴并核对借阅记录", "lavender"],
    ["potion_shop", "药剂店", "care", "清点药剂", "检查瓶签、归置药剂并登记库存", "mint"],
    ["smithy", "铁匠铺", "device", "整理锻材", "清点矿锭、归置工具并记录耗材", "gold"],
    ["castle", "城堡", "night", "城墙巡查", "巡查城墙、记录岗哨并提交报告", "coral"],
  ]),
  fantasy: theme("fantasy", "奇幻", "奇幻群岛", "map-fantasy.png", [
    area(46, 10, 23, 16), area(75, 26, 20, 16), area(70, 66, 21, 15), area(26, 70, 22, 16), area(11, 31, 23, 17),
  ], [
    ["dragon_library", "龙语图书馆", "writing", "归还龙语典籍", "核对典籍、修补书脊并更新目录", "lavender"],
    ["sky_harbor", "浮空港", "delivery", "检票引导", "核对飞舟票据、整理行李并完成引导", "coral"],
    ["enchantment_market", "附魔市集", "shop", "陈列护符", "归置护符、核对标价并清理柜台", "gold"],
    ["ranger_lodge", "游侠驿站", "assistant", "补给登记", "清点药包、登记补给并更新路线板", "blue"],
    ["moonwell", "月泉", "beauty", "守护月泉", "清理泉石、采集月露并记录水位", "mint"],
  ]),
  magic_world: theme("magic_world", "魔法世界", "魔法都市", "map-magic-world.png", [
    area(12, 18, 23, 15), area(35, 31, 25, 16), area(61, 20, 22, 17), area(66, 57, 24, 16), area(25, 68, 23, 15),
  ], [
    ["spell_bureau", "咒语管理局", "review", "校对咒语档案", "核对咒语许可、归档卷宗并标记到期", "blue"],
    ["broom_station", "飞帚站", "delivery", "维护飞帚架", "整理飞帚、核验停靠牌并记录检修", "coral"],
    ["charm_workshop", "护符工坊", "device", "封装护符", "检查护符纹路、封装成品并登记批次", "gold"],
    ["potion_greenhouse", "药剂温室", "beauty", "照料药草", "记录药草长势、补充养液并清理花架", "mint"],
    ["portal_plaza", "传送门广场", "night", "引导传送", "核对目的地牌、维护队列并完成交接", "lavender"],
  ]),
  magic_academy: theme("magic_academy", "魔法学院", "魔法学院", "map-magic-academy.png", [
    area(13, 19, 24, 17), area(65, 18, 22, 16), area(42, 40, 23, 15), area(15, 66, 24, 16), area(66, 65, 21, 17),
  ], [
    ["academy_dorm", "宿舍塔", "assistant", "整理宿舍公告", "更新公告、补齐用品并登记报修", "coral"],
    ["alchemy_classroom", "炼金教室", "device", "清点实验器材", "清洗器皿、核对材料并登记耗材", "gold"],
    ["dueling_arena", "决斗场", "night", "维护结界", "检查结界石、记录波动并恢复场地", "blue"],
    ["academy_observatory", "天文台", "survey", "抄录星象", "校正望远镜、抄录星图并归档", "lavender"],
    ["academy_library", "学院图书馆", "writing", "归架课本", "核对借阅卡、归架课本并整理书桌", "mint"],
  ]),
  island: theme("island", "海岛", "海岛渔村", "map-island.png", [
    area(10, 68, 25, 17), area(28, 39, 22, 16), area(53, 56, 21, 15), area(72, 21, 20, 18), area(46, 14, 23, 15),
  ], [
    ["island_dock", "小岛码头", "delivery", "整理渔网", "晾晒渔网、核对船牌并清理码头", "coral"],
    ["coconut_grove", "椰林", "beauty", "照料椰苗", "浇灌椰苗、清理落叶并记录生长", "mint"],
    ["diving_shop", "潜水小屋", "device", "检修氧气瓶", "检查氧气瓶、整理面镜并登记租借", "blue"],
    ["island_lighthouse", "白色灯塔", "night", "灯塔值守", "擦拭透镜、记录船讯并更换灯油", "lavender"],
    ["beach_cafe", "沙滩小馆", "kitchen", "备餐整理", "清理桌面、补齐餐具并整理食材", "gold"],
  ]),
  ocean: theme("ocean", "海洋", "蔚蓝深海", "map-ocean.png", [
    area(13, 14, 23, 17), area(68, 13, 22, 16), area(43, 39, 24, 15), area(14, 70, 24, 16), area(69, 68, 21, 17),
  ], [
    ["coral_station", "珊瑚观测站", "survey", "记录珊瑚", "拍摄珊瑚、核对样本并上传观测", "mint"],
    ["submarine_bay", "潜艇湾", "device", "检查舱门", "核对舱门、清理甲板并登记检修", "blue"],
    ["floating_market", "浮岛集市", "shop", "核验海货", "分拣海货、更新价签并完成交接", "gold"],
    ["tide_lab", "潮汐实验室", "review", "整理潮汐数据", "校正仪器、归档数据并标记异常", "lavender"],
    ["abyss_outpost", "深海前哨", "night", "远灯巡查", "检查外灯、记录水压并完成值守", "coral"],
  ]),
  republican: theme("republican", "民国", "民国街巷", "map-republican.png", [
    area(11, 23, 25, 16), area(34, 36, 23, 15), area(56, 49, 25, 16), area(69, 68, 20, 17), area(26, 72, 22, 15),
  ], [
    ["newspaper_office", "报馆", "writing", "校对铅字", "核对版面、归置铅字并整理稿件", "blue"],
    ["tea_house", "茶馆", "kitchen", "整理茶席", "清洗茶盏、补齐茶叶并整理桌椅", "coral"],
    ["tram_depot", "电车总站", "delivery", "核验车票", "整理票据、引导乘客并记录班次", "gold"],
    ["film_studio", "电影制片厂", "assistant", "整理道具", "清点道具、整理场记并归还服装", "lavender"],
    ["tailor_shop", "裁缝铺", "beauty", "熨整衣料", "分类衣料、熨整成衣并登记取件", "mint"],
  ]),
  hong_kong: theme("hong_kong", "港风", "港风霓虹", "map-hong-kong.png", [
    area(13, 13, 22, 16), area(64, 13, 25, 17), area(70, 42, 21, 16), area(58, 70, 24, 15), area(14, 67, 22, 17),
  ], [
    ["cha_chaan_teng", "茶餐厅", "kitchen", "备餐整理", "擦拭卡座、补齐餐具并整理食材", "coral"],
    ["victoria_pier", "维港码头", "delivery", "核对渡轮单", "核对乘船单、整理候船区并引导登船", "blue"],
    ["record_shop", "唱片行", "writing", "归架唱片", "分类唱片、更新标签并整理试听位", "lavender"],
    ["neon_arcade", "霓虹街机厅", "device", "检修街机", "检查投币口、擦拭面板并登记故障", "gold"],
    ["rooftop_laundry", "天台洗衣场", "beauty", "晾晒衣物", "分类衣物、清理晾架并登记取件", "mint"],
  ]),
  modern: theme("modern", "现代", "现代街区", "map-modern.png", [
    area(22, 26, 40, 18), area(78, 26, 40, 18), area(78, 47, 34, 18), area(78, 69, 38, 20), area(22, 68, 40, 20),
  ], [
    ["bookstore", "书店", "writing", "新书上架", "按分类摆放新书并补齐书架标签", "blue"],
    ["flower_shop", "花店", "beauty", "花束包装", "整理花材、包装花束并更新陈列", "coral"],
    ["clinic", "诊所", "care", "临时陪护", "陪同候诊、记录状态并完成交接", "mint"],
    ["parcel_station", "快递站", "delivery", "包裹分拣", "核对面单、分区归类并协助出库", "gold"],
    ["cafe", "咖啡馆", "kitchen", "桌面整理", "整理桌椅、补齐用品并完成清洁", "lavender"],
  ]),
  campus: theme("campus", "校园", "校园生活", "map-campus.png", [
    area(13, 22, 23, 16), area(65, 20, 24, 15), area(42, 42, 22, 17), area(12, 69, 25, 15), area(66, 68, 22, 16),
  ], [
    ["campus_library", "校园图书馆", "writing", "归架图书", "归还图书、整理书桌并更新借阅记录", "lavender"],
    ["campus_cafeteria", "食堂", "kitchen", "餐盘回收", "回收餐盘、补齐调料并清理桌面", "coral"],
    ["campus_lab", "实验楼", "device", "整理器材", "核对器材、清洁台面并登记耗材", "blue"],
    ["campus_gym", "体育馆", "assistant", "整理场地", "归置器材、擦拭座椅并更新预约板", "mint"],
    ["campus_mailroom", "收发室", "delivery", "信件分发", "核对信件、分类上架并通知领取", "gold"],
  ]),
  ice_age: theme("ice_age", "冰河时代", "冰河营地", "map-ice-age.png", [
    area(39, 15, 25, 16), area(70, 30, 21, 17), area(65, 66, 24, 16), area(22, 71, 21, 15), area(11, 37, 23, 18),
  ], [
    ["glacier_camp", "冰川营地", "kitchen", "补给整理", "清点口粮、加固帐篷并记录补给", "coral"],
    ["mammoth_corral", "猛犸围栏", "beauty", "照料兽群", "补充草料、检查围栏并记录足迹", "mint"],
    ["ice_cave", "冰洞", "survey", "勘察冰层", "标记冰裂、采集冰样并绘制路线", "blue"],
    ["hot_spring", "温泉边", "care", "温泉护理", "清理池边、准备热石并登记使用", "lavender"],
    ["signal_ridge", "风雪信标", "night", "维护信标", "添补燃料、检查支架并记录能见度", "gold"],
  ]),
  wasteland: theme("wasteland", "废土末世", "废土聚落", "map-wasteland.png", [
    area(22, 26, 40, 19), area(78, 26, 40, 19), area(77, 48, 36, 18), area(78, 70, 36, 20), area(22, 68, 40, 20),
  ], [
    ["shelter", "避难所", "assistant", "物资登记", "核对入库物资、标记批次并登记库存", "blue"],
    ["supply_station", "补给站", "shop", "补给分装", "清点饮水、分装口粮并核对领取表", "gold"],
    ["medical_camp", "医疗营地", "care", "伤员协助", "整理床位、记录状态并完成物资交接", "mint"],
    ["watch_post", "巡逻哨", "night", "外围巡查", "检查围栏、记录异常并更新巡逻图", "lavender"],
    ["repair_station", "修理站", "device", "零件清点", "分类零件、检查工具并登记可用设备", "coral"],
  ]),
  cyberpunk: theme("cyberpunk", "赛博朋克", "赛博夜城", "map-cyberpunk.png", [
    area(12, 13, 23, 16), area(65, 23, 25, 15), area(48, 46, 22, 17), area(13, 66, 24, 15), area(68, 68, 21, 16),
  ], [
    ["data_bazaar", "数据市集", "shop", "整理数据货架", "核对数据芯片、更新标价并归置货架", "gold"],
    ["cyber_clinic", "义体诊所", "care", "维护义体柜", "清点义体零件、消毒工具并登记预约", "mint"],
    ["drone_garage", "无人机车库", "device", "检修无人机", "检查旋翼、校准导航并记录故障", "blue"],
    ["neon_club", "霓虹俱乐部", "assistant", "整理舞池", "清理舞池、补齐饮料并核对预订", "coral"],
    ["grid_terminal", "网络终端塔", "review", "校验节点", "检查节点状态、标记延迟并提交报告", "lavender"],
  ]),
  scifi: theme("scifi", "科幻星际", "星际港区", "map-scifi.png", [
    area(45, 12, 25, 15), area(73, 31, 20, 17), area(60, 66, 25, 15), area(20, 67, 22, 16), area(10, 31, 23, 17),
  ], [
    ["research_lab", "研究舱", "review", "校对实验记录", "核对实验批次、标注异常并归档", "blue"],
    ["repair_dock", "维修坞", "device", "设备检修", "扫描设备状态、登记故障并更换组件", "coral"],
    ["trade_port", "贸易港", "shop", "货单核验", "核对货柜编号、整理清单并完成交接", "gold"],
    ["navigation_station", "导航站", "survey", "航线校准", "比对星图、修正航点并提交校准值", "lavender"],
    ["eco_cabin", "生态舱", "beauty", "生态维护", "记录植株状态、补充营养并清理舱室", "mint"],
  ]),
  alien_civilization: theme("alien_civilization", "外星文明", "异星文明", "map-alien-civilization.png", [
    area(42, 11, 24, 16), area(72, 30, 20, 17), area(58, 63, 25, 15), area(17, 63, 22, 17), area(10, 26, 23, 16),
  ], [
    ["bio_dome", "生物穹顶", "beauty", "照料异植", "记录异植状态、补充养液并清洁穹顶", "mint"],
    ["translator_hall", "译码大厅", "writing", "校译信号", "比对符号、修正译文并归档记录", "lavender"],
    ["crystal_forge", "晶核锻造台", "device", "稳定晶核", "检查晶核能量、归置工具并登记批次", "blue"],
    ["orbital_garden", "轨道花园", "care", "维护重力苗床", "校正苗床、清理管线并记录重力值", "coral"],
    ["signal_spire", "讯号尖塔", "survey", "收集星讯", "校准接收器、分类讯号并提交观测", "gold"],
  ]),
  online_game: theme("online_game", "网游", "网游主城", "map-online-game.png", [
    area(13, 14, 24, 16), area(64, 14, 23, 16), area(13, 45, 24, 15), area(64, 45, 23, 15), area(39, 73, 24, 16),
  ], [
    ["quest_guild", "任务公会", "assistant", "刷新委托板", "整理委托、核对等级并更新奖励", "blue"],
    ["player_market", "玩家集市", "shop", "上架道具", "分类道具、核验价格并整理摊位", "gold"],
    ["raid_gate", "副本入口", "night", "维护入口", "检查传送阵、引导队伍并记录开放", "lavender"],
    ["crafting_station", "制造工坊", "device", "清点材料", "分类材料、归置配方并登记产出", "coral"],
    ["ranking_tower", "排行塔", "review", "校验排行", "核对战绩、更新名次并整理公告", "mint"],
  ]),
  cthulhu: theme("cthulhu", "克苏鲁", "雾港旧城", "map-cthulhu.png", [
    area(44, 14, 22, 17), area(73, 34, 21, 15), area(60, 70, 24, 16), area(18, 67, 23, 16), area(10, 31, 22, 17),
  ], [
    ["fog_lighthouse", "雾港灯塔", "night", "灯塔守望", "擦拭透镜、记录雾讯并维持灯火", "lavender"],
    ["forbidden_archive", "禁书档案室", "writing", "封存档案", "核对封签、归档记录并登记借阅", "blue"],
    ["old_docks", "旧码头", "delivery", "核验货单", "核对货单、整理缆绳并记录船讯", "coral"],
    ["sunken_chapel", "沉没礼拜堂", "care", "清理祭坛", "清理积水、归置器物并记录异象", "mint"],
    ["hill_observatory", "山丘观测所", "survey", "记录星位", "校正仪器、抄录星位并密封底稿", "gold"],
  ]),
};

const MAP_PLACE_LAYOUTS = [
  [[18, 17], [48, 13], [79, 19], [32, 36], [70, 39]],
  [[15, 27], [36, 14], [67, 13], [84, 31], [54, 41]],
  [[23, 13], [53, 20], [82, 14], [72, 39], [34, 40]],
  [[14, 17], [41, 31], [55, 12], [84, 22], [74, 43]],
  [[18, 38], [27, 17], [52, 12], [77, 18], [82, 39]],
];

// Generated maps reserve their upper half for six structures: five workplaces and one home.
Object.values(WORK_MAP_THEMES).forEach((workTheme, themeIndex) => {
  if (getWorkRouteTheme(workTheme.id)) return;
  const sourceLayout = MAP_PLACE_LAYOUTS[themeIndex % MAP_PLACE_LAYOUTS.length];
  const xNudge = (themeIndex % 5) - 2;
  const yNudge = Math.floor(themeIndex / 5) - 2;
  workTheme.home = {
    x: 10 + ((themeIndex * 7) % 16),
    y: 44 - (themeIndex % 3),
  };
  workTheme.places.forEach((placeMeta, placeIndex) => {
    const [baseX, baseY] = sourceLayout[(placeIndex + themeIndex) % sourceLayout.length];
    const pin = {
      x: Math.max(10, Math.min(90, baseX + xNudge)),
      y: Math.max(10, Math.min(47, baseY + yNudge)),
    };
    const bendY = Math.min(47, Math.max(workTheme.home.y, pin.y) + 3);
    const hubX = 43 + ((themeIndex * 5 + placeIndex * 3) % 15);
    placeMeta.hitArea = { x: pin.x, y: pin.y, width: 18, height: 12 };
    placeMeta.pin = pin;
    placeMeta.route = [
      { ...workTheme.home },
      { x: workTheme.home.x + 5, y: bendY },
      { x: hubX, y: bendY - 2 },
      { x: pin.x, y: Math.min(47, pin.y + 4) },
      { ...pin },
    ];
  });
});

const GENERATED_MAP_COORDINATES = Object.freeze({
  prehistoric: { home: [50, 31], pins: [[31, 11], [18, 25], [76, 22], [23, 43], [78, 42]] },
  ancient: { home: [51, 43], pins: [[24, 12], [70, 12], [72, 29], [24, 34], [51, 28]] },
  western_regions: { home: [50, 47], pins: [[20, 28], [49, 31], [82, 34], [20, 46], [75, 10]] },
  xianxia: { home: [50, 40], pins: [[15, 13], [50, 13], [84, 14], [18, 41], [83, 42]] },
  xuanhuan: { home: [50, 39], pins: [[15, 14], [50, 11], [85, 15], [15, 42], [84, 42]] },
  mystic_realm: { home: [50, 36], pins: [[15, 15], [50, 12], [82, 15], [17, 43], [84, 43]] },
  underworld: { home: [18, 21], pins: [[49, 8], [78, 22], [15, 47], [52, 39], [84, 47]] },
  medieval: { home: [55, 39], pins: [[18, 21], [55, 14], [79, 25], [17, 47], [83, 46]] },
  western_fantasy: { home: [50, 39], pins: [[50, 7], [15, 21], [84, 22], [18, 44], [82, 44]] },
  fantasy: { home: [70, 34], pins: [[22, 11], [55, 14], [81, 10], [30, 31], [50, 47]] },
  magic_world: { home: [50, 43], pins: [[15, 16], [50, 14], [85, 17], [14, 46], [86, 46]] },
  magic_academy: { home: [50, 40], pins: [[14, 22], [50, 14], [84, 22], [16, 46], [84, 46]] },
  island: { home: [15, 36], pins: [[27, 18], [74, 14], [48, 32], [75, 42], [26, 47]] },
  ocean: { home: [84, 19], pins: [[16, 16], [50, 15], [14, 46], [52, 42], [85, 46]] },
  republican: { home: [80, 35], pins: [[18, 12], [47, 11], [77, 13], [20, 34], [49, 34]] },
  hong_kong: { home: [80, 39], pins: [[27, 16], [54, 16], [77, 17], [25, 36], [54, 35]] },
  campus: { home: [86, 9], pins: [[50, 9], [24, 19], [74, 20], [25, 38], [74, 37]] },
  ice_age: { home: [50, 22], pins: [[22, 19], [79, 13], [25, 43], [70, 42], [50, 47]] },
  wasteland: { home: [20, 39], pins: [[20, 15], [50, 12], [80, 18], [50, 36], [82, 42]] },
  cyberpunk: { home: [82, 39], pins: [[20, 12], [50, 9], [82, 14], [20, 34], [52, 31]] },
  scifi: { home: [50, 32], pins: [[20, 18], [50, 11], [80, 17], [18, 44], [82, 44]] },
  alien_civilization: { home: [50, 41], pins: [[15, 22], [50, 20], [83, 22], [15, 42], [81, 43]] },
  online_game: { home: [50, 47], pins: [[16, 16], [50, 11], [84, 16], [16, 39], [84, 40]] },
  cthulhu: { home: [22, 35], pins: [[15, 15], [70, 18], [78, 41], [58, 47], [28, 47]] },
});

const buildGeneratedRoadRoute = (home, pin, placeIndex) => {
  const hub = { x: 50 + (placeIndex % 2 ? 3 : -3), y: 29 + (placeIndex % 3) * 3 };
  return [
    { ...home },
    { x: home.x, y: Math.min(47, home.y + (home.y < hub.y ? 4 : -4)) },
    hub,
    { x: pin.x, y: Math.min(47, pin.y + (pin.y < hub.y ? 5 : -5)) },
    { ...pin },
  ];
};

for (const [themeId, coordinates] of Object.entries(GENERATED_MAP_COORDINATES)) {
  const workTheme = WORK_MAP_THEMES[themeId];
  if (!workTheme || getWorkRouteTheme(themeId)) continue;
  workTheme.home = { x: coordinates.home[0], y: coordinates.home[1] };
  workTheme.places.forEach((placeMeta, placeIndex) => {
    const [x, y] = coordinates.pins[placeIndex];
    placeMeta.pin = { x, y };
    placeMeta.hitArea = { x, y, width: 14, height: 10 };
    placeMeta.route = coordinates.routes?.[placeIndex]?.map(([routeX, routeY]) => ({ x: routeX, y: routeY }))
      || buildGeneratedRoadRoute(workTheme.home, placeMeta.pin, placeIndex);
  });
}

const clonePoint = ({ x, y }) => ({ x, y });

const applyCalibratedRouteTheme = (workTheme, routeTheme) => {
  if (!workTheme || !routeTheme) return;
  workTheme.home = clonePoint(routeTheme.home);
  workTheme.places.forEach((placeMeta) => {
    const routeRecord = routeTheme.routes[placeMeta.type];
    if (!routeRecord) return;
    placeMeta.pin = clonePoint(routeRecord.pin);
    placeMeta.distanceMeters = routeRecord.distanceMeters;
    placeMeta.routeSamples = routeRecord.samples.map(clonePoint);
    placeMeta.routeSegments = [...routeRecord.visibleSegments];
    placeMeta.route = placeMeta.routeSamples;
  });
};

for (const workTheme of Object.values(WORK_MAP_THEMES)) {
  const routeTheme = getWorkRouteTheme(workTheme.id);
  if (!routeTheme) continue;
  applyCalibratedRouteTheme(workTheme, routeTheme);
}

export const createWorkSession = (job, startAt = Date.now(), travelMs = 60_000) => {
  const safeTravelMs = Math.max(1_000, Number(travelMs) || 60_000);
  const workMs = Math.max(60_000, Number(job?.durationMinutes || 60) * 60_000);
  return {
    jobKey: job?.key,
    job,
    startAt,
    arriveAt: startAt + safeTravelMs,
    workStartAt: startAt + safeTravelMs,
    endAt: startAt + safeTravelMs + workMs,
  };
};

export const resolveWorkSessionState = (session, now = Date.now()) => {
  if (!session) return { phase: "idle", progress: 0, remainingMs: 0 };
  const arriveAt = Number(session.arriveAt || session.startAt);
  if (now < arriveAt) {
    const total = Math.max(1, arriveAt - session.startAt);
    return {
      phase: "travel",
      progress: Math.min(1, Math.max(0, (now - session.startAt) / total)),
      remainingMs: Math.max(0, arriveAt - now),
    };
  }
  if (now < session.endAt) {
    const workStartAt = Number(session.workStartAt || arriveAt);
    const total = Math.max(1, session.endAt - workStartAt);
    return {
      phase: "work",
      progress: Math.min(1, Math.max(0, (now - workStartAt) / total)),
      remainingMs: Math.max(0, session.endAt - now),
    };
  }
  return { phase: "complete", progress: 1, remainingMs: 0 };
};

export const getThemeIdForTag = (tag) => TAG_WORK_THEME_IDS[String(tag || "").trim()] || "";

const normalizeThemeId = (themeId) => {
  const id = String(themeId || "").trim();
  return LEGACY_THEME_ID_MIGRATIONS[id] || (WORK_MAP_THEMES[id] ? id : "");
};

export const getWorkTheme = (themeId) => WORK_MAP_THEMES[normalizeThemeId(themeId)] || WORK_MAP_THEMES.modern;

const inferTagTheme = (world) => {
  return (Array.isArray(world.tags) ? world.tags : [])
    .map(getThemeIdForTag)
    .find(Boolean) || "";
};

export const inferWorkMapTheme = (world = {}, selectedTag = "") => {
  const explicitTagTheme = getThemeIdForTag(selectedTag);
  if (explicitTagTheme) return explicitTagTheme;
  if (world.workMapThemeMode === "manual") {
    const manualTheme = normalizeThemeId(world.workMapTheme);
    if (manualTheme) return manualTheme;
  }
  const tagTheme = inferTagTheme(world);
  if (tagTheme) return tagTheme;
  const source = `${world.genre || ""} ${world.tone || ""}`;
  if (/上古|史前|洪荒/.test(source)) return "prehistoric";
  if (/西域|丝路|大漠/.test(source)) return "western_regions";
  if (/仙侠|修仙|御剑/.test(source)) return "xianxia";
  if (/玄幻|修真|高魔东方|高魔史诗/.test(source)) return "xuanhuan";
  if (/秘境|遗迹|迷谷/.test(source)) return "mystic_realm";
  if (/地府|幽冥|忘川/.test(source)) return "underworld";
  if (/西幻|魔法学院/.test(source)) return /学院/.test(source) ? "magic_academy" : "western_fantasy";
  if (/魔法世界|巫师/.test(source)) return "magic_world";
  if (/中世纪|骑士|教会/.test(source)) return "medieval";
  if (/奇幻|龙语|浮空/.test(source)) return "fantasy";
  if (/海岛|渔村|椰林/.test(source)) return "island";
  if (/海洋|深海|珊瑚/.test(source)) return "ocean";
  if (/民国|报馆|旧上海/.test(source)) return "republican";
  if (/港风|香港|维港/.test(source)) return "hong_kong";
  if (/校园|学校|大学/.test(source)) return "campus";
  if (/冰河|冰川|极寒/.test(source)) return "ice_age";
  if (/末世|废土|灾变/.test(source)) return "wasteland";
  if (/赛博|霓虹|义体/.test(source)) return "cyberpunk";
  if (/科幻|星际|未来|殖民/.test(source)) return "scifi";
  if (/外星|异星|文明/.test(source)) return "alien_civilization";
  if (/网游|游戏|副本/.test(source)) return "online_game";
  if (/克苏鲁|旧日|雾港/.test(source)) return "cthulhu";
  if (/古代|宫廷|武侠|江湖/.test(source)) return "ancient";
  return "modern";
};

export const withWorkMapTheme = (world = {}) => ({
  ...world,
  workMapThemeMode: world.workMapThemeMode === "manual" ? "manual" : "auto",
  workMapTheme: inferWorkMapTheme(world),
});

export const resolveWorkMapView = (worlds = [], selectedWorldId = "", source = "reality", selectedTag = "") => {
  const selectedWorld = worlds.find((world) => world.id === selectedWorldId) || worlds[0] || null;
  const themeId = source === "worldbook" && selectedWorld ? inferWorkMapTheme(selectedWorld, selectedTag) : "modern";
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

const normalizeJob = (item, workTheme, index) => {
  const placeMeta = workTheme.places.find((entry) => entry.type === item?.placeType);
  if (!placeMeta) return null;
  const durationMinutes = Math.round(normalizeNumber(item.durationMinutes, 60, 30, 600));
  const level = Math.round(normalizeNumber(item.level, 1, 1, 5));
  const hourlyRate = Math.round(normalizeNumber(item.hourlyRate, 40 + level * 5, 5, 999));
  const reward = Math.round(normalizeNumber(item.reward, hourlyRate * (durationMinutes / 60), 5, 9999));
  return {
    ...item,
    themeId: workTheme.id,
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
    distance: item.distance || (
      placeMeta.distanceMeters
        ? `${(placeMeta.distanceMeters / 1000).toFixed(1)} km`
        : `${(0.4 + index * 0.5).toFixed(1)} km`
    ),
    distanceMeters: placeMeta.distanceMeters,
    pin: placeMeta.pin,
    hitArea: placeMeta.hitArea,
    routeSamples: placeMeta.routeSamples,
    routeSegments: placeMeta.routeSegments,
    route: placeMeta.route,
    color: placeMeta.color,
  };
};

export const normalizeThemeJobs = (items, themeId, fallbackFactory = () => null) => {
  const workTheme = getWorkTheme(themeId);
  return (Array.isArray(items) ? items : []).map((item, index) => {
    const normalized = normalizeJob(item, workTheme, index);
    if (normalized) return normalized;
    const fallback = fallbackFactory(index, workTheme.places[index % workTheme.places.length], workTheme);
    return normalizeJob(fallback, workTheme, index) || fallback;
  }).filter(Boolean);
};

export const buildLocalThemeJobs = (themeId) => {
  const workTheme = getWorkTheme(themeId);
  return workTheme.places.map((placeMeta, index) => normalizeJob({
    placeType: placeMeta.type,
    title: placeMeta.title,
    content: placeMeta.content,
    durationMinutes: 60 + index * 35,
    hourlyRate: 35 + index * 8,
    level: Math.min(5, index + 1),
  }, workTheme, index));
};

export const resolveDisplayedWorkJob = (jobs = [], selectedId = "", activeWork = null, hasCompletedWork = false) => (
  jobs.find((job) => job.key === selectedId)
  || (hasCompletedWork ? activeWork?.job || null : null)
);

export const buildWorkGenerationPrompt = ({ world = null, themeId = "modern" } = {}) => {
  const workTheme = getWorkTheme(themeId);
  const worldLine = world
    ? `世界书：${world.name || "未命名世界"}；类型：${world.genre || "自定义"}；氛围：${world.tone || "未填写"}。`
    : "来源：现实世界。";
  const places = workTheme.places.map((entry) => `${entry.type}=${entry.name}（${entry.title}、${entry.content}）`).join("；");
  return `你是 Ccat OS 的工作派单生成器。${worldLine}
当前工作地图主题：${workTheme.name}。
只能从以下地点生成工作：${places}。
返回 5 个工作，每个地点恰好使用一次。建筑、placeType、placeName、title 和 content 必须相符。
只返回 JSON，不要 Markdown。格式：
{"jobs":[{"placeType":"${workTheme.places[0].type}","placeName":"${workTheme.places[0].name}","title":"${workTheme.places[0].title}","content":"${workTheme.places[0].content}","durationMinutes":90,"hourlyRate":45,"reward":70,"level":2}]}
规则：durationMinutes 30 到 600；reward 约等于 hourlyRate * durationMinutes / 60；level 1 到 5；不要生成白名单之外的现代、古代或幻想地点。`;
};
