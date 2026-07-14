const point = (x, y) => Object.freeze({ x, y });

const formatNumber = (value) => (
  Number.isInteger(value) ? String(value) : String(value).replace(/0+$/, "").replace(/\.$/, "")
);

const buildPath = (samples) => (
  `M ${formatNumber(samples[0].x)} ${formatNumber(samples[0].y)}${
    samples.slice(1).map((sample) => ` L ${formatNumber(sample.x)} ${formatNumber(sample.y)}`).join("")
  }`
);

const buildVisibleSegments = (samples, breakIndices = []) => {
  const segments = [];
  let startIndex = 0;

  for (const breakIndex of breakIndices) {
    const segmentSamples = samples.slice(startIndex, breakIndex + 1);
    if (segmentSamples.length >= 2) segments.push(buildPath(segmentSamples));
    startIndex = breakIndex;
  }

  const finalSamples = samples.slice(startIndex);
  if (finalSamples.length >= 2) segments.push(buildPath(finalSamples));
  return Object.freeze(segments);
};

const densifySamples = (sourceSamples, minimumCount = 16, maximumJump = 4) => {
  const samples = sourceSamples.map(({ x, y }) => point(x, y));
  const length = (left, right) => Math.hypot(right.x - left.x, right.y - left.y);
  for (let index = samples.length - 2; index >= 0; index -= 1) {
    const left = samples[index];
    const right = samples[index + 1];
    const parts = Math.ceil(length(left, right) / maximumJump);
    for (let part = parts - 1; part >= 1; part -= 1) {
      const ratio = part / parts;
      samples.splice(index + 1, 0, point(
        Number((left.x + ((right.x - left.x) * ratio)).toFixed(2)),
        Number((left.y + ((right.y - left.y) * ratio)).toFixed(2)),
      ));
    }
  }
  while (samples.length < minimumCount) {
    let longestIndex = 0;
    for (let index = 1; index < samples.length - 1; index += 1) {
      if (length(samples[index], samples[index + 1]) > length(samples[longestIndex], samples[longestIndex + 1])) {
        longestIndex = index;
      }
    }
    const left = samples[longestIndex];
    const right = samples[longestIndex + 1];
    samples.splice(longestIndex + 1, 0, point(
      Number(((left.x + right.x) / 2).toFixed(2)),
      Number(((left.y + right.y) / 2).toFixed(2)),
    ));
  }
  return samples;
};

const route = (pin, distanceMeters, sourceSamples) => {
  const samples = densifySamples(sourceSamples);
  return Object.freeze({
  pin,
  distanceMeters,
  samples: Object.freeze(samples),
  visibleSegments: buildVisibleSegments(samples),
  });
};

const theme = (home, routes) => Object.freeze({
  home,
  routes: Object.freeze(routes),
});

const MAGIC_WORLD_HOME = point(24, 55.5);
const MAGIC_ACADEMY_HOME = point(18.5, 66.5);
const ISLAND_HOME = point(50, 33.3);
const OCEAN_HOME = point(50, 44.5);
const REPUBLICAN_HOME = point(49.5, 21.5);

export const WORK_ROUTE_BATCH_C = Object.freeze({
  magic_world: theme(MAGIC_WORLD_HOME, {
    spell_bureau: route(point(21, 21.4), 820, [
      MAGIC_WORLD_HOME,
      point(26, 55.8),
      point(31, 55.4),
      point(36, 54.2),
      point(41, 51.7),
      point(46, 48.6),
      point(50, 46.6),
      point(47.5, 43.5),
      point(42.6, 40.7),
      point(36.5, 38.4),
      point(30, 36.5),
      point(25.5, 32.2),
      point(23.2, 26.5),
      point(21, 21.4),
    ], [10]),
    broom_station: route(point(64, 25.5), 640, [
      MAGIC_WORLD_HOME,
      point(27.2, 56.1),
      point(32.8, 55.6),
      point(38.4, 53.5),
      point(44, 50),
      point(50, 46.6),
      point(52.5, 42),
      point(54.3, 37.5),
      point(56.8, 33.4),
      point(60.5, 29.2),
      point(63, 26.5),
      point(64, 25.5),
    ]),
    charm_workshop: route(point(65.5, 41.4), 500, [
      MAGIC_WORLD_HOME,
      point(27.6, 56),
      point(33, 55.4),
      point(39, 53.2),
      point(45.6, 49.6),
      point(50, 46.6),
      point(53.3, 45),
      point(56.7, 43.8),
      point(60, 42.8),
      point(62.8, 42),
      point(64.5, 41.6),
      point(65.5, 41.4),
    ]),
    potion_greenhouse: route(point(22.8, 37.8), 520, [
      MAGIC_WORLD_HOME,
      point(26.4, 55.8),
      point(31.2, 55),
      point(36.8, 53),
      point(42.2, 50),
      point(46, 47),
      point(45, 44.2),
      point(41, 41.9),
      point(35.5, 40),
      point(30.2, 38.8),
      point(25.8, 38),
      point(22.8, 37.8),
    ]),
    portal_plaza: route(point(70.5, 56.3), 470, [
      MAGIC_WORLD_HOME,
      point(27.2, 56),
      point(31.5, 56.8),
      point(36, 57.8),
      point(40.5, 58.6),
      point(45.5, 58.8),
      point(50.5, 58),
      point(55.5, 56.7),
      point(60.5, 55.5),
      point(65.5, 55.1),
      point(68.8, 55.5),
      point(70.5, 56.3),
    ]),
  }),
  magic_academy: theme(MAGIC_ACADEMY_HOME, {
    academy_dorm: route(point(18.5, 27), 760, [
      MAGIC_ACADEMY_HOME,
      point(21.5, 65.2),
      point(24.8, 62.8),
      point(28.8, 59.8),
      point(34.5, 56.5),
      point(41, 54),
      point(47.5, 52),
      point(48.2, 48),
      point(44.6, 44),
      point(38.8, 40.5),
      point(35.15, 38.65),
      point(31.5, 36.8),
      point(28, 34.65),
      point(24.5, 32.5),
      point(20.5, 29),
      point(18.5, 27),
    ], [8]),
    alchemy_classroom: route(point(46, 29.5), 620, [
      MAGIC_ACADEMY_HOME,
      point(22, 65),
      point(25.8, 62),
      point(31.8, 59),
      point(38.5, 56.8),
      point(45, 55.2),
      point(50, 52.5),
      point(51.5, 47.5),
      point(50.5, 42.2),
      point(48.6, 37.2),
      point(47.2, 33),
      point(46, 29.5),
    ]),
    dueling_arena: route(point(75.2, 56.6), 470, [
      MAGIC_ACADEMY_HOME,
      point(22, 65.3),
      point(26.5, 62.8),
      point(32.5, 60.3),
      point(39, 58.4),
      point(45.2, 57.3),
      point(50.5, 57),
      point(56.2, 57),
      point(62.3, 56.4),
      point(66.2, 56.8),
      point(69.5, 57.3),
      point(72.4, 57.3),
      point(74.2, 57),
      point(75.2, 56.6),
    ]),
    academy_observatory: route(point(74.5, 33), 720, [
      MAGIC_ACADEMY_HOME,
      point(22.2, 65.2),
      point(27.5, 61.7),
      point(34, 59),
      point(41.8, 57.3),
      point(49.2, 56.5),
      point(55.5, 53.8),
      point(60.5, 49.3),
      point(64.8, 44.3),
      point(68.5, 39.5),
      point(72, 35.5),
      point(74.5, 33),
    ]),
    academy_library: route(point(25.5, 47), 320, [
      MAGIC_ACADEMY_HOME,
      point(20.8, 64.8),
      point(23.2, 62.3),
      point(26.2, 59.2),
      point(29.5, 56),
      point(32.2, 53.3),
      point(32.8, 51.4),
      point(31, 49.8),
      point(29, 48.6),
      point(27.2, 47.8),
      point(26, 47.2),
      point(25.5, 47),
    ]),
  }),
  island: theme(ISLAND_HOME, {
    island_dock: route(point(48.8, 42.5), 300, [
      ISLAND_HOME,
      point(50.5, 34.4),
      point(51, 35.6),
      point(51, 37),
      point(50.5, 38.5),
      point(50, 39.7),
      point(49.6, 40.6),
      point(49.2, 41.3),
      point(49, 41.8),
      point(48.9, 42.1),
      point(48.8, 42.3),
      point(48.8, 42.5),
    ]),
    coconut_grove: route(point(38.5, 22.5), 430, [
      ISLAND_HOME,
      point(49.2, 32.2),
      point(47.7, 30.9),
      point(45.6, 29.3),
      point(43.2, 27.6),
      point(41, 26),
      point(39.5, 24.5),
      point(38.8, 23.6),
      point(38.5, 22.9),
      point(38.4, 22.6),
      point(38.45, 22.55),
      point(38.5, 22.5),
    ]),
    diving_shop: route(point(19, 30.8), 510, [
      ISLAND_HOME,
      point(47.5, 33.3),
      point(44.2, 33.3),
      point(40.5, 33),
      point(36.6, 32.5),
      point(32.7, 31.8),
      point(29, 31.1),
      point(25.5, 30.7),
      point(22.5, 30.6),
      point(20.5, 30.7),
      point(19.5, 30.8),
      point(19, 30.8),
    ]),
    island_lighthouse: route(point(66.5, 13.3), 690, [
      ISLAND_HOME,
      point(47.2, 33.4),
      point(44.2, 32.6),
      point(41.8, 31),
      point(40.2, 28.8),
      point(40.3, 26.4),
      point(42.2, 24.2),
      point(45.2, 22.7),
      point(49, 21.6),
      point(52.5, 20.4),
      point(55.2, 18.7),
      point(57.6, 17.1),
      point(59.4, 15.9),
      point(61.4, 15.5),
      point(63.2, 14.5),
      point(65, 13.8),
      point(66.5, 13.3),
    ]),
    beach_cafe: route(point(75.5, 35.5), 470, [
      ISLAND_HOME,
      point(52.3, 33.7),
      point(55.4, 34.1),
      point(58.8, 34.3),
      point(62.5, 34.5),
      point(66.3, 34.7),
      point(69.6, 35),
      point(72.2, 35.2),
      point(74, 35.4),
      point(75, 35.5),
      point(75.4, 35.5),
      point(75.5, 35.5),
    ]),
  }),
  ocean: theme(OCEAN_HOME, {
    coral_station: route(point(16.5, 21), 980, [
      OCEAN_HOME,
      point(50, 43),
      point(50.8, 41.5),
      point(51.8, 39),
      point(52.2, 36),
      point(51.7, 33.5),
      point(50.5, 31.2),
      point(46, 30.2),
      point(40.5, 29.5),
      point(34.5, 28.8),
      point(28.5, 27.5),
      point(23.5, 25.8),
      point(20, 23.5),
      point(17.8, 22),
      point(16.5, 21),
    ], [6]),
    submarine_bay: route(point(17, 39.5), 690, [
      OCEAN_HOME,
      point(49.5, 44.4),
      point(47, 43.8),
      point(43.5, 43),
      point(39.5, 41.8),
      point(35.5, 40.5),
      point(31.5, 39.3),
      point(27.5, 38.6),
      point(24, 38.4),
      point(21, 38.8),
      point(18.5, 39.2),
      point(17, 39.5),
    ]),
    floating_market: route(point(52.2, 23), 860, [
      OCEAN_HOME,
      point(50.4, 42.8),
      point(51.1, 40.5),
      point(52, 38),
      point(52.5, 35.5),
      point(52.4, 33),
      point(51.6, 30.5),
      point(50.8, 28.2),
      point(50.8, 26.5),
      point(51.4, 25),
      point(52, 23.8),
      point(52.2, 23),
    ]),
    tide_lab: route(point(79, 43.4), 760, [
      OCEAN_HOME,
      point(51.5, 44.8),
      point(53.5, 45.8),
      point(56.5, 47),
      point(60, 48),
      point(64, 48.3),
      point(68, 47.3),
      point(72, 45.5),
      point(75.5, 44),
      point(78, 43.4),
      point(78.7, 43.4),
      point(79, 43.4),
    ]),
    abyss_outpost: route(point(80, 24.6), 940, [
      OCEAN_HOME,
      point(50.5, 43),
      point(51.5, 41),
      point(52.2, 38.5),
      point(52.2, 35.8),
      point(51.6, 33),
      point(51.2, 31),
      point(55, 30.3),
      point(60, 30),
      point(65, 29.5),
      point(70, 28.4),
      point(75, 26.5),
      point(78.5, 25.1),
      point(80, 24.6),
    ], [6]),
  }),
  republican: theme(REPUBLICAN_HOME, {
    newspaper_office: route(point(20.5, 22.5), 430, [
      REPUBLICAN_HOME,
      point(48, 23), point(46, 24), point(43, 25), point(40, 26), point(37, 27),
      point(34, 28), point(31, 29), point(28, 29), point(25, 28), point(23, 26),
      point(21.5, 24),
      point(20.5, 22.5),
    ]),
    tea_house: route(point(28, 40.4), 480, [
      REPUBLICAN_HOME,
      point(49, 23), point(48, 25), point(47, 27), point(45, 29), point(43, 31),
      point(41, 33), point(38, 35), point(35, 37), point(32, 38.5), point(30, 39.5),
      point(29, 40),
      point(28, 40.4),
    ]),
    tram_depot: route(point(72, 57), 780, [
      REPUBLICAN_HOME,
      point(51, 23), point(53, 25), point(55, 27), point(57, 30), point(59, 33),
      point(61, 36), point(63, 39), point(65, 42), point(67, 45), point(69, 48),
      point(70, 51), point(71, 54), point(72, 56),
      point(72, 57),
    ]),
    film_studio: route(point(81.5, 39), 620, [
      REPUBLICAN_HOME,
      point(51, 23), point(53, 25), point(56, 27), point(59, 29), point(62, 31),
      point(65, 33), point(68, 34), point(71, 35), point(74, 36), point(77, 37),
      point(79, 38), point(80.5, 38.7),
      point(81.5, 39),
    ]),
    tailor_shop: route(point(50, 42), 320, [
      REPUBLICAN_HOME,
      point(49, 23), point(50, 25), point(51, 27), point(52, 29), point(53, 31),
      point(54, 33), point(55, 35), point(56, 37), point(56, 39), point(54, 40),
      point(52, 41),
      point(50, 42),
    ]),
  }),
});
