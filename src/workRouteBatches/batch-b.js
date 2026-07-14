const point = (x, y) => ({ x, y });

const pathFromSamples = (samples) => samples
  .map(({ x, y }, index) => `${index === 0 ? "M" : "L"} ${x} ${y}`)
  .join(" ");

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
  return ({
  pin,
  distanceMeters,
  samples,
  visibleSegments: [pathFromSamples(samples)],
  });
};

const theme = (home, routes) => Object.freeze({
  home,
  routes: Object.freeze(routes),
});

export const WORK_ROUTE_BATCH_B = Object.freeze({
  mystic_realm: theme(point(50, 42), {
    realm_gate: route(point(16, 19), 610, [
      point(50, 42),
      point(48, 40),
      point(46, 38),
      point(44, 35),
      point(41, 33),
      point(38, 31),
      point(34, 29),
      point(30, 27),
      point(26, 25),
      point(22, 23),
      point(19, 21),
      point(16, 19),
    ]),
    crystal_grotto: route(point(50, 18), 430, [
      point(50, 42),
      point(50, 40),
      point(49, 38),
      point(48, 36),
      point(47, 34),
      point(47, 31),
      point(47, 28),
      point(48, 25),
      point(49, 23),
      point(50, 21),
      point(50, 19),
      point(50, 18),
    ]),
    floating_bridge: route(point(77, 29), 520, [
      point(50, 42),
      point(52, 41),
      point(54, 40),
      point(57, 39),
      point(60, 37),
      point(63, 35),
      point(66, 33),
      point(69, 32),
      point(72, 31),
      point(74, 30),
      point(76, 29.5),
      point(77, 29),
    ]),
    relic_vault: route(point(15, 48), 470, [
      point(50, 42),
      point(49, 44),
      point(48, 46),
      point(46, 49),
      point(43, 51),
      point(39, 53),
      point(35, 54),
      point(31, 54),
      point(27, 53),
      point(23, 51),
      point(19, 50),
      point(15, 48),
    ]),
    mist_pond: route(point(80, 54), 500, [
      point(50, 42),
      point(51, 44),
      point(52, 47),
      point(55, 50),
      point(58, 52),
      point(62, 53),
      point(66, 54),
      point(70, 55),
      point(74, 55),
      point(77, 54.5),
      point(79, 54.2),
      point(80, 54),
    ]),
  }),

  underworld: theme(point(18, 19), {
    ghost_gate: route(point(50, 12), 540, [
      point(18, 19),
      point(21, 21), point(24, 23), point(27, 25), point(30, 27), point(34, 29),
      point(38, 30), point(40, 29), point(41, 26), point(42, 23), point(43, 20),
      point(45, 17), point(47, 14),
      point(50, 12),
    ]),
    judgment_hall: route(point(78, 35), 700, [
      point(18, 19),
      point(21, 21), point(24, 23), point(27, 25), point(30, 27), point(34, 29),
      point(38, 30), point(40, 29), point(42, 31), point(45, 34), point(48, 36),
      point(52, 38), point(56, 40), point(60, 42), point(64, 43), point(68, 42),
      point(71, 40), point(74, 38),
      point(78, 35),
    ]),
    forgotten_river: route(point(15, 57), 520, [
      point(18, 19),
      point(21, 21), point(24, 23), point(27, 25), point(30, 27), point(34, 29),
      point(38, 30), point(40, 29), point(37, 31), point(34, 33), point(31, 35),
      point(28, 38), point(25, 41), point(24, 45), point(23, 48), point(20, 51),
      point(18, 54), point(16, 56),
      point(15, 57),
    ]),
    spirit_registry: route(point(52, 45), 610, [
      point(18, 19),
      point(21, 21), point(24, 23), point(27, 25), point(30, 27), point(34, 29),
      point(38, 30), point(40, 29), point(42, 32), point(45, 35), point(48, 38),
      point(50, 40), point(51, 42), point(52, 44),
      point(52, 45),
    ]),
    mengpo_pavilion: route(point(84, 58), 790, [
      point(18, 19),
      point(21, 21), point(24, 23), point(27, 25), point(30, 27), point(34, 29),
      point(38, 30), point(40, 29), point(42, 32), point(45, 35), point(48, 38),
      point(52, 40), point(56, 42), point(60, 43), point(64, 43), point(67, 45),
      point(68, 49), point(70, 52), point(73, 54), point(77, 56), point(81, 57),
      point(84, 58),
    ]),
  }),

  medieval: theme(point(24, 32), {
    market_square: route(point(74, 22), 560, [
      point(24, 32),
      point(28, 33),
      point(33, 32.5),
      point(35, 31.5),
      point(41, 30.5),
      point(47, 30),
      point(53, 29.5),
      point(59, 28.5),
      point(64, 27),
      point(68, 25),
      point(71, 23.5),
      point(74, 22),
    ]),
    monastery: route(point(50, 22), 360, [
      point(24, 32),
      point(28, 33),
      point(32, 33),
      point(33, 32.5),
      point(37, 31),
      point(41, 30),
      point(45, 29),
      point(48, 28),
      point(49, 26),
      point(50, 24),
      point(50, 23),
      point(50, 22),
    ]),
    town_armory: route(point(78, 37), 520, [
      point(24, 32),
      point(28, 33),
      point(32, 33.5),
      point(37, 34),
      point(43, 32),
      point(49, 31),
      point(55, 31),
      point(61, 32),
      point(67, 34),
      point(72, 35.5),
      point(75, 36.5),
      point(78, 37),
    ]),
    horse_stable: route(point(60, 46), 430, [
      point(24, 32),
      point(28, 33),
      point(33, 32.5),
      point(36, 31.5),
      point(42, 30.5),
      point(48, 31),
      point(51, 34),
      point(51, 37),
      point(50, 40),
      point(53, 43),
      point(56, 45),
      point(60, 46),
    ], [
      "M 24 32 L 28 33 L 33 32.5 L 36 31.5 L 42 30.5 L 48 31",
      "M 51 34 L 51 37 L 50 40 L 53 43 L 56 45 L 60 46",
    ]),
    watchtower: route(point(31, 19), 330, [
      point(24, 32),
      point(28, 33),
      point(33, 32.5),
      point(38, 31.5),
      point(43, 30.5),
      point(46, 29),
      point(44, 27),
      point(41, 25),
      point(38, 23),
      point(35, 21.5),
      point(33, 20),
      point(31, 19),
    ]),
  }),

  western_fantasy: theme(point(78, 42), {
    guild: route(point(28, 22), 650, [
      point(78, 42),
      point(75, 43),
      point(71, 43.5),
      point(67, 42),
      point(64, 39),
      point(63, 35),
      point(61, 31),
      point(57, 28),
      point(52, 26),
      point(46, 25),
      point(40, 24),
      point(34, 23),
      point(30, 22.5),
      point(28, 22),
    ]),
    magic_academy: route(point(79, 22), 360, [
      point(78, 42),
      point(75, 43),
      point(71, 43.5),
      point(68, 42),
      point(66, 39),
      point(65, 35),
      point(66, 32),
      point(68, 29),
      point(71, 27),
      point(74, 25),
      point(77, 23.5),
      point(79, 22),
    ]),
    potion_shop: route(point(29, 39), 600, [
      point(78, 42),
      point(75, 43),
      point(71, 44),
      point(67, 44.5),
      point(63, 45),
      point(58, 45),
      point(53, 45),
      point(48, 45),
      point(43, 44),
      point(39, 42),
      point(35, 40),
      point(32, 39.5),
      point(29, 39),
    ]),
    smithy: route(point(50, 43), 330, [
      point(78, 42),
      point(75, 43),
      point(71, 44),
      point(67, 44.5),
      point(64, 45),
      point(61, 44.5),
      point(58, 44),
      point(55, 43.5),
      point(53, 43.2),
      point(51.5, 43.1),
      point(50.5, 43),
      point(50, 43),
    ]),
    castle: route(point(50, 11), 710, [
      point(78, 42),
      point(74, 43),
      point(68, 42),
      point(64, 39),
      point(60, 35),
      point(56, 31),
      point(53, 27),
      point(51, 23),
      point(50.5, 19),
      point(50, 16),
      point(50, 13),
      point(50, 11),
    ], [
      "M 78 42 L 74 43 L 68 42 L 64 39 L 60 35 L 56 31",
      "M 53 27 L 51 23 L 50.5 19 L 50 16 L 50 13 L 50 11",
    ]),
  }),

  fantasy: theme(point(71, 64), {
    dragon_library: route(point(22, 18), 880, [
      point(71, 64),
      point(72, 65),
      point(67, 62),
      point(61, 59),
      point(56, 55),
      point(52, 50),
      point(50, 45),
      point(47, 41),
      point(44, 37),
      point(40, 33),
      point(36, 29),
      point(32, 25),
      point(28, 22),
      point(24, 20),
      point(22, 18),
    ]),
    sky_harbor: route(point(55, 22), 680, [
      point(71, 64),
      point(72, 65),
      point(67, 62),
      point(62, 59),
      point(57, 55),
      point(53, 51),
      point(50, 47),
      point(50, 43),
      point(51, 39),
      point(52, 35),
      point(53, 31),
      point(54, 26),
      point(55, 22),
    ]),
    enchantment_market: route(point(82, 30), 620, [
      point(71, 64),
      point(74, 62),
      point(73, 59),
      point(69, 56),
      point(65, 53),
      point(61, 50),
      point(58, 47),
      point(55, 44),
      point(58, 41),
      point(63, 39),
      point(68, 37),
      point(73, 35),
      point(78, 32),
      point(82, 30),
    ]),
    ranger_lodge: route(point(30, 45), 540, [
      point(71, 64),
      point(72, 65),
      point(67, 62),
      point(62, 60),
      point(57, 58),
      point(52, 56),
      point(47, 55),
      point(42, 53),
      point(38, 50),
      point(34, 47),
      point(31, 45.5),
      point(30, 45),
    ]),
    moonwell: route(point(50, 42), 410, [
      point(71, 64),
      point(72, 65),
      point(69, 62),
      point(65, 61),
      point(61, 59),
      point(57, 57),
      point(54, 54),
      point(52, 51),
      point(50, 48),
      point(49.5, 45),
      point(50, 43),
      point(50, 42),
    ], [
      "M 71 64 L 72 65 L 69 62 L 65 61 L 61 59 L 57 57 L 54 54",
      "M 52 51 L 50 48 L 49.5 45 L 50 43 L 50 42",
    ]),
  }),
});
