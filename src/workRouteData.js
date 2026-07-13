const point = (x, y) => ({ x, y });

const route = (pin, distanceMeters, samples, visibleSegments) => ({
  pin,
  distanceMeters,
  samples,
  visibleSegments,
});

const MODERN_HOME = point(50, 10);

export const WORK_ROUTE_DATA = Object.freeze({
  modern: Object.freeze({
    home: MODERN_HOME,
    routes: Object.freeze({
      bookstore: route(
        point(18, 19),
        420,
        [
          point(50, 10),
          point(50, 12),
          point(50, 14),
          point(50, 16),
          point(48, 17),
          point(44, 17),
          point(40, 17),
          point(36, 17),
          point(32, 18),
          point(28, 19),
          point(24, 19),
          point(21, 19),
          point(18, 19),
        ],
        ["M 50 10 L 50 17 L 38 17 L 28 19 L 18 19"],
      ),
      flower_shop: route(
        point(80, 19),
        420,
        [
          point(50, 10),
          point(50, 12),
          point(50, 14),
          point(50, 16),
          point(52, 17),
          point(56, 17),
          point(60, 17),
          point(64, 17),
          point(68, 18),
          point(72, 19),
          point(76, 19),
          point(78, 19),
          point(80, 19),
        ],
        ["M 50 10 L 50 17 L 62 17 L 72 19 L 80 19"],
      ),
      clinic: route(
        point(16, 41),
        470,
        [
          point(50, 10),
          point(50, 12),
          point(50, 14),
          point(50, 16),
          point(50, 18),
          point(46, 20),
          point(42, 22),
          point(38, 24),
          point(34, 27),
          point(30, 30),
          point(26, 33),
          point(22, 36),
          point(19, 38.5),
          point(16, 41),
        ],
        ["M 50 10 L 50 18 L 36 26 L 24 34 L 16 41"],
      ),
      parcel_station: route(
        point(84, 41),
        470,
        [
          point(50, 10),
          point(50, 12),
          point(50, 14),
          point(50, 16),
          point(50, 18),
          point(54, 20),
          point(58, 22),
          point(62, 24),
          point(66, 27),
          point(70, 30),
          point(74, 33),
          point(78, 36),
          point(81, 38.5),
          point(84, 41),
        ],
        ["M 50 10 L 50 18 L 64 26 L 76 34 L 84 41"],
      ),
      cafe: route(
        point(50, 47),
        370,
        [
          point(50, 10),
          point(50, 13),
          point(50, 16),
          point(50, 19),
          point(50, 22),
          point(50, 25),
          point(50, 28),
          point(50, 31),
          point(50, 34),
          point(50, 37),
          point(50, 40),
          point(50, 43),
          point(50, 47),
        ],
        ["M 50 10 L 50 19 L 50 29 L 50 39 L 50 47"],
      ),
    }),
  }),
});

const LEGACY_THEME_ID_MIGRATIONS = Object.freeze({
  ancient_cn: "ancient",
  western_fantasy: "western_fantasy",
  xuanhuan: "xuanhuan",
  scifi: "scifi",
  wasteland: "wasteland",
  modern: "modern",
});

const normalizeThemeId = (themeId) => {
  const id = String(themeId || "").trim();
  return LEGACY_THEME_ID_MIGRATIONS[id] || id;
};

const isFiniteCoordinate = (value) => Number.isFinite(value) && value >= 0 && value <= 100;

const isPoint = (value) => Boolean(
  value
  && isFiniteCoordinate(value.x)
  && isFiniteCoordinate(value.y),
);

const samePoint = (left, right) => left?.x === right?.x && left?.y === right?.y;

const SVG_COMMAND_PATTERN = /^[MLCQAZ0-9,.\-\s]+$/i;

export const getWorkRouteTheme = (themeId) => WORK_ROUTE_DATA[normalizeThemeId(themeId)] || null;

export const validateWorkRouteTheme = (themeId, theme, routeTheme) => {
  const issues = [];
  if (!routeTheme) {
    issues.push(`${themeId}: missing route theme`);
    return issues;
  }

  const expectedPlaceTypes = (Array.isArray(theme?.places) ? theme.places : []).map((place) => place.type);
  const actualPlaceTypes = Object.keys(routeTheme.routes || {});
  for (const placeType of expectedPlaceTypes) {
    if (!actualPlaceTypes.includes(placeType)) {
      issues.push(`${themeId}:${placeType} missing route`);
    }
  }
  for (const placeType of actualPlaceTypes) {
    if (!expectedPlaceTypes.includes(placeType)) {
      issues.push(`${themeId}:${placeType} unexpected route`);
    }
  }

  if (!isPoint(routeTheme.home)) {
    issues.push(`${themeId}: invalid home`);
  }

  for (const place of Array.isArray(theme?.places) ? theme.places : []) {
    const routeRecord = routeTheme.routes?.[place.type];
    if (!routeRecord) continue;

    if (!isPoint(routeRecord.pin)) {
      issues.push(`${themeId}:${place.type} invalid pin`);
    }
    if (!samePoint(routeRecord.pin, place.pin)) {
      issues.push(`${themeId}:${place.type} pin mismatch`);
    }
    if (!Number.isFinite(routeRecord.distanceMeters) || routeRecord.distanceMeters <= 0) {
      issues.push(`${themeId}:${place.type} invalid distance`);
    }
    if (!Array.isArray(routeRecord.samples) || routeRecord.samples.length < 12) {
      issues.push(`${themeId}:${place.type} needs at least 12 samples`);
    } else {
      if (!routeRecord.samples.every(isPoint)) {
        issues.push(`${themeId}:${place.type} has invalid sample coordinates`);
      }
      if (!samePoint(routeRecord.samples[0], routeTheme.home)) {
        issues.push(`${themeId}:${place.type} must start at home`);
      }
      if (!samePoint(routeRecord.samples.at(-1), routeRecord.pin)) {
        issues.push(`${themeId}:${place.type} must end at pin`);
      }
    }
    if (!Array.isArray(routeRecord.visibleSegments) || routeRecord.visibleSegments.length < 1) {
      issues.push(`${themeId}:${place.type} needs visible segments`);
    } else if (!routeRecord.visibleSegments.every((segment) => (
      typeof segment === "string"
      && segment.startsWith("M ")
      && SVG_COMMAND_PATTERN.test(segment)
    ))) {
      issues.push(`${themeId}:${place.type} has invalid SVG segments`);
    }
  }

  return issues;
};

export const interpolateWorkRoute = (samples = [], progress = 0) => {
  if (!samples.length) return { x: 0, y: 0 };
  if (samples.length === 1) return { ...samples[0] };

  const segments = samples.slice(1).map((pointValue, index) => {
    const previous = samples[index];
    return {
      previous,
      point: pointValue,
      length: Math.hypot(pointValue.x - previous.x, pointValue.y - previous.y),
    };
  });
  const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0) || 1;
  let targetLength = Math.min(1, Math.max(0, progress)) * totalLength;

  for (const segment of segments) {
    if (targetLength <= segment.length) {
      const ratio = segment.length ? targetLength / segment.length : 0;
      return {
        x: Math.round((segment.previous.x + (segment.point.x - segment.previous.x) * ratio) * 100) / 100,
        y: Math.round((segment.previous.y + (segment.point.y - segment.previous.y) * ratio) * 100) / 100,
      };
    }
    targetLength -= segment.length;
  }

  return { ...samples.at(-1) };
};
