const point = (x, y) => ({ x, y });

const pathFromPairs = (pairs) => pairs
  .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x} ${y}`)
  .join(" ");

const pointsFromPairs = (pairs) => pairs.map(([x, y]) => point(x, y));

const densifyPairs = (sourcePairs, minimumCount = 16, maximumJump = 4) => {
  const pairs = sourcePairs.map(([x, y]) => [x, y]);
  const segmentLength = (left, right) => Math.hypot(right[0] - left[0], right[1] - left[1]);

  for (let index = pairs.length - 2; index >= 0; index -= 1) {
    const left = pairs[index];
    const right = pairs[index + 1];
    const parts = Math.ceil(segmentLength(left, right) / maximumJump);
    for (let part = parts - 1; part >= 1; part -= 1) {
      const ratio = part / parts;
      pairs.splice(index + 1, 0, [
        Number((left[0] + ((right[0] - left[0]) * ratio)).toFixed(2)),
        Number((left[1] + ((right[1] - left[1]) * ratio)).toFixed(2)),
      ]);
    }
  }

  while (pairs.length < minimumCount) {
    let longestIndex = 0;
    let longestLength = -1;
    for (let index = 0; index < pairs.length - 1; index += 1) {
      const length = segmentLength(pairs[index], pairs[index + 1]);
      if (length > longestLength) {
        longestLength = length;
        longestIndex = index;
      }
    }
    const left = pairs[longestIndex];
    const right = pairs[longestIndex + 1];
    pairs.splice(longestIndex + 1, 0, [
      Number(((left[0] + right[0]) / 2).toFixed(2)),
      Number(((left[1] + right[1]) / 2).toFixed(2)),
    ]);
  }

  return pairs;
};

const route = (distanceMeters, samplePairs) => {
  const calibratedPairs = densifyPairs(samplePairs);
  const samples = pointsFromPairs(calibratedPairs);
  return {
    pin: { ...samples.at(-1) },
    distanceMeters,
    samples,
    visibleSegments: [pathFromPairs(calibratedPairs)],
  };
};

const HONG_KONG_HOME = [54, 58];
const MODERN_HOME = [70, 58];
const CAMPUS_HOME = [73, 61];
const ICE_AGE_HOME = [64, 62];
const WASTELAND_HOME = [73, 60];

export const WORK_ROUTE_BATCH_D = {
  hong_kong: {
    home: point(...HONG_KONG_HOME),
    routes: {
      cha_chaan_teng: route(760, [
        HONG_KONG_HOME,
        [55, 60], [57, 62], [59, 64], [56, 64], [52, 63], [49, 61],
        [47, 62], [45, 59], [43, 56], [42, 53], [43, 50], [45, 47],
        [47, 44], [48, 40], [48, 37], [46, 35], [43, 33], [39, 32],
        [36, 31.65], [32, 31], [28, 30], [25, 29.6],
        [22.5, 28.4],
      ]),
      victoria_pier: route(540, [
        HONG_KONG_HOME,
        [55, 60], [57, 62], [59, 64], [56, 64], [52, 63], [49, 61],
        [47, 62], [45, 59], [43, 56], [42, 53], [40, 52], [37, 52],
        [34, 52], [31, 51], [28, 50], [26, 49], [24.6, 48.2],
      ]),
      record_shop: route(760, [
        HONG_KONG_HOME,
        [55, 60], [57, 62], [59, 64], [56, 64], [52, 63], [49, 61],
        [47, 62], [45, 59], [42, 56], [40, 54], [39, 52], [40, 48],
        [43, 45], [46, 42], [48, 40], [52, 38], [58, 37], [64, 37], [70, 38],
        [75.5, 37.5],
      ]),
      neon_arcade: route(720, [
        HONG_KONG_HOME,
        [55, 60], [57, 62], [59, 64], [56, 64], [52, 63], [49, 61],
        [47, 62], [45, 59], [42, 56], [40, 54], [39, 52], [40, 48],
        [43, 45], [46, 42], [48, 40], [49, 37], [51.5, 34.8], [53.5, 32],
        [54.5, 30.5],
      ]),
      rooftop_laundry: route(260, [
        HONG_KONG_HOME,
        [55, 59], [56, 60], [57, 62], [59, 64], [61, 65], [63, 65],
        [65, 64], [67, 63], [69, 62], [71, 61], [72.8, 60.4], [73.8, 60.1],
        [74.2, 60],
        [74.8, 60],
      ]),
    },
  },
  modern: {
    home: point(...MODERN_HOME),
    routes: {
      bookstore: route(620, [
        MODERN_HOME,
        [70, 59], [69, 60], [68, 61], [66, 62], [62, 63], [56, 63],
        [50, 63], [48, 59], [47, 55], [46, 51], [45, 48], [45, 45],
        [43, 41], [40, 37], [40, 34], [42, 31], [46, 29], [50, 29],
        [50, 27], [46, 25], [42, 24], [37, 23], [32, 23], [28, 22.5],
        [24, 22],
      ]),
      flower_shop: route(470, [
        MODERN_HOME,
        [70, 59], [69, 60], [68, 61], [66, 62], [62, 63], [56, 63],
        [50, 63], [48, 59], [47, 55], [46, 51], [45, 48], [45, 45],
        [43, 41], [40, 37], [40, 34], [42, 31], [46, 29], [50, 29],
        [50, 27], [51, 25], [52, 24],
        [52, 22],
      ]),
      clinic: route(610, [
        MODERN_HOME,
        [70, 59], [69, 60], [68, 61], [66, 62], [62, 63], [56, 63],
        [50, 63], [48, 59], [47, 55], [46, 51], [45, 48], [45, 45],
        [41, 45], [37, 44], [33, 43], [29, 42], [25, 41], [21, 40],
        [18.5, 38.8],
      ]),
      parcel_station: route(310, [
        MODERN_HOME,
        [70, 59], [69, 60], [68, 61], [66, 62], [62, 63], [56, 63],
        [50, 63], [48, 59], [47, 55], [46, 51], [45, 48], [45, 45],
        [50, 43], [56, 43], [60, 44], [64, 44], [68, 44], [72, 44],
        [76, 43], [79, 42.5],
        [80.7, 42],
      ]),
      cafe: route(520, [
        MODERN_HOME,
        [70, 59], [69, 60], [68, 61], [66, 62], [62, 63], [56, 63],
        [50, 63], [46, 63], [42, 62], [38, 61], [34, 60], [31, 59.5],
        [29, 59], [27, 58.5], [25, 58], [24.5, 57.4],
        [24.5, 57.4],
        [23.2, 57.3],
      ]),
    },
  },
  campus: {
    home: point(...CAMPUS_HOME),
    routes: {
      campus_library: route(730, [
        CAMPUS_HOME,
        [72, 62],
        [69, 63.5],
        [65, 64],
        [61, 62],
        [58, 58],
        [56, 53],
        [59, 50],
        [60, 46],
        [59, 42],
        [56, 39],
        [52, 37.5],
        [48, 37],
        [44, 34],
        [41, 29],
        [38, 24],
        [34, 22],
        [31.5, 18.8],
      ]),
      campus_cafeteria: route(540, [
        CAMPUS_HOME,
        [71, 58],
        [68, 55],
        [64, 52],
        [60, 49],
        [58, 45],
        [61, 41],
        [65, 37],
        [68, 34],
        [70.5, 32],
        [72.5, 31],
        [72, 30.5],
      ]),
      campus_lab: route(650, [
        CAMPUS_HOME,
        [72, 62],
        [69, 63.5],
        [65, 64],
        [61, 62],
        [58, 58],
        [56, 53],
        [52, 53],
        [47, 52],
        [43, 49],
        [40, 45],
        [39, 41],
        [36, 38],
        [32, 37.5],
        [29.5, 36.3],
      ]),
      campus_gym: route(480, [
        CAMPUS_HOME,
        [72, 62],
        [69, 63.5],
        [65, 64],
        [61, 62],
        [58, 58],
        [56, 53],
        [57, 50],
        [60, 48.5],
        [63, 48],
        [66, 47.5],
        [69, 46.5],
        [71, 45.8],
        [72, 45.2],
      ]),
      campus_mailroom: route(590, [
        CAMPUS_HOME,
        [72, 62],
        [69, 63.5],
        [65, 64],
        [61, 62],
        [57, 58],
        [53, 54],
        [49, 52],
        [44, 52],
        [39, 52.5],
        [34, 53],
        [29, 53],
        [25, 52.5],
        [21, 51],
        [18, 49.8],
      ]),
    },
  },
  ice_age: {
    home: point(...ICE_AGE_HOME),
    routes: {
      glacier_camp: route(720, [
        ICE_AGE_HOME,
        [61, 60.5],
        [58, 58],
        [55, 54],
        [52, 50],
        [50.5, 46],
        [50, 42],
        [49, 38],
        [47, 34],
        [44, 30],
        [40, 27],
        [36, 24.5],
        [32, 22.5],
        [29.5, 20.8],
      ]),
      mammoth_corral: route(560, [
        ICE_AGE_HOME,
        [61, 60.5],
        [58, 58],
        [55, 54],
        [52, 50],
        [50.5, 46],
        [50, 42],
        [49.5, 38],
        [50, 34],
        [53, 31],
        [56, 28.5],
        [59, 26.5],
        [61, 25],
        [61.5, 24.5],
      ]),
      ice_cave: route(610, [
        ICE_AGE_HOME,
        [61, 60.5],
        [56.5, 58],
        [52.5, 54.5],
        [49.8, 50],
        [47, 46.5],
        [42, 43.5],
        [36, 41.5],
        [30, 40.5],
        [25, 40.1],
        [23.5, 40.1],
        [22, 40.2],
      ]),
      hot_spring: route(430, [
        ICE_AGE_HOME,
        [61, 60.5],
        [58, 58],
        [55, 54],
        [52, 50],
        [54, 48],
        [56, 47],
        [59, 46],
        [62, 45],
        [66, 45.5],
        [70, 45],
        [73, 44],
        [75.5, 43],
      ]),
      signal_ridge: route(480, [
        ICE_AGE_HOME,
        [60, 60.5],
        [55, 57.5],
        [50, 53],
        [45, 51],
        [39, 52],
        [33, 54],
        [27, 56],
        [22, 57.3],
        [20, 57.7],
        [18.8, 57.9],
        [17.5, 58],
      ]),
    },
  },
  wasteland: {
    home: point(...WASTELAND_HOME),
    routes: {
      shelter: route(780, [
        WASTELAND_HOME,
        [70, 62],
        [65, 63],
        [60, 61],
        [55, 57],
        [51, 52],
        [49, 47],
        [46, 41],
        [42, 35],
        [39, 32],
        [36, 29],
        [33, 26],
        [30, 23],
        [24.5, 19.2],
      ]),
      supply_station: route(610, [
        WASTELAND_HOME,
        [70, 62],
        [65, 62.5],
        [60, 59.5],
        [55, 55],
        [52, 50],
        [52, 45],
        [54, 39],
        [56, 33],
        [58, 28],
        [58.3, 26.4],
        [58.5, 25],
      ]),
      medical_camp: route(640, [
        WASTELAND_HOME,
        [72, 61],
        [70, 62.5],
        [66, 63],
        [62, 62],
        [58, 59.5],
        [54, 56],
        [51, 52],
        [49, 49],
        [46, 46],
        [42, 43.5],
        [38, 41.5],
        [34, 40],
        [31, 39],
        [29.5, 38.5],
      ]),
      watch_post: route(360, [
        WASTELAND_HOME,
        [71, 62],
        [67, 63],
        [62, 61],
        [57, 57],
        [53, 53],
        [51, 51],
        [56, 49],
        [62, 47],
        [68, 45],
        [72.5, 43.5],
        [75, 42.2],
      ]),
      repair_station: route(500, [
        WASTELAND_HOME,
        [70, 62],
        [65, 63],
        [59, 61],
        [53, 58.5],
        [47, 56.7],
        [40, 55.8],
        [33, 55.5],
        [28.5, 55.4],
        [26, 55.4],
        [24.8, 55.5],
        [23.5, 55.5],
      ]),
    },
  },
};
