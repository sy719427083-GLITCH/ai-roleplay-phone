import { WORK_MAP_THEMES, getWorkTheme } from "../src/workThemes.js";
import { getWorkRouteSampleMetrics, getWorkRouteTheme } from "../src/workRouteData.js";

const POINT_PRECISION = 2;
const HOME_ROUTE_KEY = "home";
const MIN_ROUTE_SAMPLES = 12;

const roundNumber = (value, precision = POINT_PRECISION) => {
  const factor = 10 ** precision;
  return Math.round(Number(value) * factor) / factor;
};

const normalizeNumber = (value, precision = POINT_PRECISION) => roundNumber(Number(value), precision);

const formatNumber = (value) => {
  const normalized = normalizeNumber(value);
  if (!Number.isFinite(normalized)) return "0";
  return Number.isInteger(normalized)
    ? String(normalized)
    : normalized.toFixed(POINT_PRECISION).replace(/\.?0+$/, "");
};

const isBoundedCoordinate = (value) => Number.isFinite(value) && value >= 0 && value <= 100;

const samePoint = (left, right) => left?.x === right?.x && left?.y === right?.y;

const clampCoordinate = (value) => Math.min(100, Math.max(0, normalizeNumber(value)));

const normalizeBreakIndices = (breakIndices = []) => breakIndices.map((value) => Number(value));

export const normalizePoint = (point) => ({
  x: clampCoordinate(point?.x),
  y: clampCoordinate(point?.y),
});

const formatPoint = (point) => `${formatNumber(point.x)} ${formatNumber(point.y)}`;

const buildPathFromSamples = (samples) => (
  `M ${formatPoint(samples[0])}${samples.slice(1).map((point) => ` L ${formatPoint(point)}`).join("")}`
);

const validateBreakIndicesInternal = (samples = [], breakIndices = []) => {
  if (!Array.isArray(breakIndices)) return false;
  const normalized = normalizeBreakIndices(breakIndices);
  if (!normalized.every(Number.isInteger)) return false;
  if (!normalized.every((value, index) => value > 0 && value < samples.length - 1 && (index === 0 || normalized[index - 1] < value))) {
    return false;
  }
  return true;
};

export const validateCalibrationRoute = ({
  authored = true,
  home,
  pin,
  distanceMeters,
  samples = [],
  breakIndices = [],
}) => {
  const issues = [];

  if (!authored) {
    issues.push("route is unauthored; add road-center samples before export");
  }

  if (!isBoundedCoordinate(home?.x) || !isBoundedCoordinate(home?.y)) {
    issues.push("home must stay within normalized 0..100 bounds");
  }

  if (!isBoundedCoordinate(pin?.x) || !isBoundedCoordinate(pin?.y)) {
    issues.push("pin must stay within normalized 0..100 bounds");
  }

  if (!Number.isFinite(Number(distanceMeters)) || Number(distanceMeters) <= 0) {
    issues.push("distanceMeters must be a positive number");
  }

  if (!Array.isArray(samples) || samples.length < MIN_ROUTE_SAMPLES) {
    const sampleCount = Array.isArray(samples) ? samples.length : 0;
    issues.push(`samples must contain at least ${MIN_ROUTE_SAMPLES} points; currently ${sampleCount}; add ${MIN_ROUTE_SAMPLES - sampleCount} more`);
  } else {
    samples.forEach((point, index) => {
      if (!isBoundedCoordinate(point?.x) || !isBoundedCoordinate(point?.y)) {
        issues.push(`samples[${index}] must stay within normalized 0..100 bounds`);
      }
    });
    if (issues.length === 0 && !samePoint(normalizePoint(samples[0]), normalizePoint(home))) {
      issues.push("samples[0] must equal home");
    }
    if (issues.length === 0 && !samePoint(normalizePoint(samples.at(-1)), normalizePoint(pin))) {
      issues.push("samples[samples.length - 1] must equal pin");
    }
    if (issues.length === 0) {
      const { maxSegmentLength } = getWorkRouteSampleMetrics(samples);
      if (maxSegmentLength > 8) {
        issues.push(`maximum sample jump ${maxSegmentLength} exceeds 8; add road-center points`);
      }
    }
  }

  if (!validateBreakIndicesInternal(samples, breakIndices)) {
    issues.push("breakIndices must be unique ascending sample indices between 1 and samples.length - 2");
  }

  return issues;
};

export const buildVisibleSegments = (samples = [], breakIndices = []) => {
  if (!Array.isArray(samples) || samples.length < 2) return [];
  const normalizedSamples = samples.map(normalizePoint);
  const normalizedBreaks = [...normalizeBreakIndices(breakIndices)].sort((left, right) => left - right);
  const segments = [];
  let startIndex = 0;

  for (const breakIndex of normalizedBreaks) {
    const segmentSamples = normalizedSamples.slice(startIndex, breakIndex + 1);
    if (segmentSamples.length >= 2) segments.push(buildPathFromSamples(segmentSamples));
    startIndex = breakIndex;
  }

  const trailingSamples = normalizedSamples.slice(startIndex);
  if (trailingSamples.length >= 2) segments.push(buildPathFromSamples(trailingSamples));

  return segments;
};

export const serializeRouteRecord = ({
  authored = true,
  home,
  pin,
  distanceMeters,
  samples = [],
  breakIndices = [],
}) => {
  const rawIssues = validateCalibrationRoute({
    authored,
    home,
    pin,
    distanceMeters,
    samples,
    breakIndices,
  });
  if (rawIssues.length > 0) {
    throw new Error(rawIssues.join("; "));
  }

  const normalizedHome = normalizePoint(home);
  const normalizedPin = normalizePoint(pin);
  const normalizedSamples = samples.map(normalizePoint);
  const normalizedBreaks = [...normalizeBreakIndices(breakIndices)].sort((left, right) => left - right);
  const issues = validateCalibrationRoute({
    authored,
    home: normalizedHome,
    pin: normalizedPin,
    distanceMeters,
    samples: normalizedSamples,
    breakIndices: normalizedBreaks,
  });

  if (issues.length > 0) {
    throw new Error(issues.join("; "));
  }

  return {
    pin: normalizedPin,
    distanceMeters: normalizeNumber(distanceMeters, 0),
    samples: normalizedSamples,
    visibleSegments: buildVisibleSegments(normalizedSamples, normalizedBreaks),
  };
};

const readPathPoints = (segment) => {
  const values = Array.from(String(segment || "").matchAll(/[-+]?(?:\d+(?:\.\d*)?|\.\d+)/g), (match) => Number(match[0]));
  const points = [];
  for (let index = 0; index < values.length; index += 2) {
    points.push({ x: normalizeNumber(values[index]), y: normalizeNumber(values[index + 1]) });
  }
  return points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
};

const inferBreakIndices = (samples = [], visibleSegments = []) => {
  const normalizedSamples = samples.map(normalizePoint);
  const breaks = [];
  for (const segment of visibleSegments.slice(0, -1)) {
    const points = readPathPoints(segment);
    const endPoint = points.at(-1);
    const sampleIndex = normalizedSamples.findIndex((sample) => samePoint(sample, endPoint));
    if (sampleIndex > 0 && sampleIndex < normalizedSamples.length - 1 && !breaks.includes(sampleIndex)) {
      breaks.push(sampleIndex);
    }
  }
  return breaks.sort((left, right) => left - right);
};

const buildDefaultSamples = (home, pin, samples = []) => {
  const interior = (Array.isArray(samples) ? samples : []).slice(1, -1).map(normalizePoint);
  return [normalizePoint(home), ...interior, normalizePoint(pin)];
};

export const buildRouteDraft = (themeHome, placeMeta, routeRecord) => {
  const pin = normalizePoint(routeRecord?.pin || placeMeta.pin);
  const authored = Boolean(routeRecord);
  const samples = authored ? buildDefaultSamples(themeHome, pin, routeRecord.samples) : [];
  return {
    authored,
    pin,
    distanceMeters: Number(routeRecord?.distanceMeters || placeMeta.distanceMeters || 400),
    samples,
    breakIndices: inferBreakIndices(samples, routeRecord?.visibleSegments || []),
  };
};

const buildThemeDraft = (themeId) => {
  const theme = getWorkTheme(themeId);
  const routeTheme = getWorkRouteTheme(themeId);
  const home = normalizePoint(routeTheme?.home || theme.home);

  const routes = Object.fromEntries(theme.places.map((placeMeta) => (
    [placeMeta.type, buildRouteDraft(home, placeMeta, routeTheme?.routes?.[placeMeta.type])]
  )));

  for (const route of Object.values(routes)) {
    if (route.samples.length > 0) route.samples[0] = normalizePoint(home);
  }

  return {
    home,
    routes,
  };
};

const createDraftRegistry = () => Object.fromEntries(
  Object.keys(WORK_MAP_THEMES).map((themeId) => [themeId, buildThemeDraft(themeId)]),
);

const getPlaceMetaByType = (theme, placeType) => theme.places.find((placeMeta) => placeMeta.type === placeType) || null;

const toggleBreakIndex = (route, breakIndex) => {
  route.breakIndices = route.breakIndices.includes(breakIndex)
    ? route.breakIndices.filter((value) => value !== breakIndex)
    : [...route.breakIndices, breakIndex].sort((left, right) => left - right);
};

const removeSampleAtIndex = (route, sampleIndex) => {
  route.samples.splice(sampleIndex, 1);
  route.breakIndices = route.breakIndices
    .filter((value) => value !== sampleIndex)
    .map((value) => (value > sampleIndex ? value - 1 : value));
};

export const clearRouteDraft = (route) => {
  route.authored = false;
  route.samples = [];
  route.breakIndices = [];
};

const updateSharedHome = (themeDraft, home) => {
  themeDraft.home = normalizePoint(home);
  Object.values(themeDraft.routes).forEach((route) => {
    if (route.samples.length > 0) route.samples[0] = normalizePoint(home);
  });
};

const setRoutePin = (route, pin) => {
  route.pin = normalizePoint(pin);
  if (route.samples.length > 0) route.samples[route.samples.length - 1] = normalizePoint(pin);
};

const getRouteDraftIssues = (home, route) => validateCalibrationRoute({
  authored: route.authored,
  home,
  pin: route.pin,
  distanceMeters: route.distanceMeters,
  samples: route.samples,
  breakIndices: route.breakIndices,
});

export const getThemeDraftIssues = (themeId, themeDraft) => {
  const theme = getWorkTheme(themeId);
  return theme.places.flatMap((placeMeta) => (
    getRouteDraftIssues(themeDraft.home, themeDraft.routes[placeMeta.type])
      .map((issue) => `${themeId}:${placeMeta.type} ${issue}`)
  ));
};

export const createThemeExport = (themeId, themeDraft) => {
  const theme = getWorkTheme(themeId);
  const issues = getThemeDraftIssues(themeId, themeDraft);

  if (issues.length > 0) {
    throw new Error(`Theme export blocked:\n${issues.join("\n")}`);
  }

  const routes = Object.fromEntries(theme.places.map((placeMeta) => [
    placeMeta.type,
    serializeRouteRecord({
      home: themeDraft.home,
      authored: themeDraft.routes[placeMeta.type].authored,
      pin: themeDraft.routes[placeMeta.type].pin,
      distanceMeters: themeDraft.routes[placeMeta.type].distanceMeters,
      samples: themeDraft.routes[placeMeta.type].samples,
      breakIndices: themeDraft.routes[placeMeta.type].breakIndices,
    }),
  ]));

  return {
    home: normalizePoint(themeDraft.home),
    routes,
  };
};

export const isEditableTarget = (target) => {
  const tagName = String(target?.tagName || "").toLowerCase();
  if (["input", "textarea", "select"].includes(tagName) || target?.isContentEditable) return true;
  return Boolean(target?.closest?.("input, textarea, select, [contenteditable]:not([contenteditable='false'])"));
};

const copyText = async (text) => {
  if (!navigator.clipboard?.writeText) return false;
  await navigator.clipboard.writeText(text);
  return true;
};

const readCoordinateFromEvent = (event, bounds) => {
  const clientX = event.clientX ?? event.touches?.[0]?.clientX ?? 0;
  const clientY = event.clientY ?? event.touches?.[0]?.clientY ?? 0;
  return {
    x: clampCoordinate(((clientX - bounds.left) / bounds.width) * 100),
    y: clampCoordinate(((clientY - bounds.top) / bounds.height) * 100),
  };
};

const createCalibratorState = () => {
  const url = new URL(window.location.href);
  const themeId = WORK_MAP_THEMES[url.searchParams.get("theme")] ? url.searchParams.get("theme") : "modern";
  const theme = getWorkTheme(themeId);
  const routeKey = [HOME_ROUTE_KEY, ...theme.places.map((placeMeta) => placeMeta.type)].includes(url.searchParams.get("route"))
    ? url.searchParams.get("route")
    : theme.places[0].type;

  return {
    drafts: createDraftRegistry(),
    themeId,
    routeKey,
    selectedSampleIndex: null,
    pointer: null,
    dragTarget: null,
    dragMoved: false,
    interactionMode: "samples",
    copyStatus: "",
  };
};

const installCalibrator = () => {
  const root = document.querySelector("[data-work-route-calibrator]");
  if (!root) return;

  const elements = {
    themeSelect: root.querySelector("[data-theme-select]"),
    routeSelect: root.querySelector("[data-route-select]"),
    distanceInput: root.querySelector("[data-distance-input]"),
    deleteButton: root.querySelector("[data-delete]"),
    undoButton: root.querySelector("[data-undo]"),
    clearButton: root.querySelector("[data-clear]"),
    copyRouteButton: root.querySelector("[data-copy-route]"),
    copyThemeButton: root.querySelector("[data-copy-theme]"),
    sampleModeButton: root.querySelector("[data-mode-samples]"),
    breakModeButton: root.querySelector("[data-mode-breaks]"),
    stage: root.querySelector("[data-stage]"),
    stageImage: root.querySelector("[data-stage-image]"),
    stageGrid: root.querySelector("[data-stage-grid]"),
    routeOverlay: root.querySelector("[data-route-overlay]"),
    markersLayer: root.querySelector("[data-markers-layer]"),
    pointerReadout: root.querySelector("[data-pointer]"),
    selectionReadout: root.querySelector("[data-selection]"),
    routeMetrics: root.querySelector("[data-route-metrics]"),
    sampleList: root.querySelector("[data-sample-list]"),
    breakList: root.querySelector("[data-break-list]"),
    visibleSegments: root.querySelector("[data-visible-segments]"),
    routeExport: root.querySelector("[data-route-export]"),
    themeExport: root.querySelector("[data-theme-export]"),
    issueList: root.querySelector("[data-issues]"),
    copyStatus: root.querySelector("[data-copy-status]"),
  };

  const state = createCalibratorState();

  const syncUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("theme", state.themeId);
    url.searchParams.set("route", state.routeKey);
    window.history.replaceState({}, "", url);
  };

  const getTheme = () => getWorkTheme(state.themeId);
  const getThemeDraft = () => state.drafts[state.themeId];
  const getActiveRoute = () => (
    state.routeKey === HOME_ROUTE_KEY ? null : getThemeDraft().routes[state.routeKey]
  );
  const getActivePlaceMeta = () => (
    state.routeKey === HOME_ROUTE_KEY ? null : getPlaceMetaByType(getTheme(), state.routeKey)
  );

  const updateSelectionsForTheme = () => {
    const theme = getTheme();
    const themeDraft = getThemeDraft();
    if (!theme.places.some((placeMeta) => placeMeta.type === state.routeKey) && state.routeKey !== HOME_ROUTE_KEY) {
      state.routeKey = theme.places[0].type;
    }
    elements.routeSelect.innerHTML = [
      `<option value="${HOME_ROUTE_KEY}">home</option>`,
      ...theme.places.map((placeMeta) => {
        const route = themeDraft.routes[placeMeta.type];
        const status = getRouteDraftIssues(themeDraft.home, route).length === 0
          ? "ready"
          : !route.authored
            ? "unauthored"
            : route.samples.length < MIN_ROUTE_SAMPLES
            ? `incomplete ${route.samples.length}/${MIN_ROUTE_SAMPLES}`
              : "invalid";
        return `<option value="${placeMeta.type}">${placeMeta.type} (${status})</option>`;
      }),
    ].join("");
    elements.routeSelect.value = state.routeKey;
    elements.themeSelect.value = state.themeId;
  };

  const render = () => {
    const theme = getTheme();
    const themeDraft = getThemeDraft();
    const activeRoute = getActiveRoute();
    const activePlaceMeta = getActivePlaceMeta();
    const stageAssetUrl = `/work-map-assets/${theme.asset}`;
    const issues = activeRoute ? getRouteDraftIssues(themeDraft.home, activeRoute) : [];
    const themeIssues = getThemeDraftIssues(state.themeId, themeDraft);
    const selectedSample = activeRoute && Number.isInteger(state.selectedSampleIndex)
      ? activeRoute.samples[state.selectedSampleIndex] || null
      : null;

    updateSelectionsForTheme();
    elements.stageImage.src = stageAssetUrl;
    elements.distanceInput.disabled = !activeRoute;
    elements.distanceInput.value = activeRoute ? String(Math.round(activeRoute.distanceMeters)) : "";
    elements.deleteButton.disabled = !activeRoute || !Number.isInteger(state.selectedSampleIndex) || state.selectedSampleIndex <= 0 || state.selectedSampleIndex >= activeRoute.samples.length - 1;
    elements.undoButton.disabled = !activeRoute || activeRoute.samples.length <= 2;
    elements.clearButton.disabled = !activeRoute;
    elements.breakModeButton.disabled = !activeRoute;
    elements.copyRouteButton.disabled = !activeRoute || issues.length > 0;
    elements.copyThemeButton.disabled = themeIssues.length > 0;
    elements.sampleModeButton.classList.toggle("active", state.interactionMode === "samples");
    elements.breakModeButton.classList.toggle("active", state.interactionMode === "breaks");

    elements.pointerReadout.textContent = state.pointer
      ? `${formatNumber(state.pointer.x)}, ${formatNumber(state.pointer.y)}`
      : "--, --";
    elements.selectionReadout.textContent = state.routeKey === HOME_ROUTE_KEY
      ? `home · ${formatNumber(themeDraft.home.x)}, ${formatNumber(themeDraft.home.y)}`
      : selectedSample
        ? `sample[${state.selectedSampleIndex}] · ${formatNumber(selectedSample.x)}, ${formatNumber(selectedSample.y)}`
        : activePlaceMeta
          ? `${activePlaceMeta.type} · ${activeRoute.authored ? `${activeRoute.samples.length}/${MIN_ROUTE_SAMPLES} samples` : "unauthored"} · pin ${formatNumber(activeRoute.pin.x)}, ${formatNumber(activeRoute.pin.y)}`
          : "none";
    const routeMetrics = getWorkRouteSampleMetrics(activeRoute?.samples || []);
    elements.routeMetrics.textContent = activeRoute
      ? `${routeMetrics.sampleCount} points · max jump ${formatNumber(routeMetrics.maxSegmentLength)}`
      : "--";
    elements.routeMetrics.classList.toggle("invalid", routeMetrics.maxSegmentLength > 8);
    elements.copyStatus.textContent = state.copyStatus;

    elements.issueList.innerHTML = issues.length > 0
      ? issues.map((issue) => `<li>${issue}</li>`).join("")
      : activeRoute
        ? "<li>Ready for deterministic export.</li>"
        : "<li>Select a place route to inspect calibration status.</li>";

    elements.sampleList.innerHTML = activeRoute
      ? activeRoute.samples.length > 0
        ? activeRoute.samples.map((sample, index) => `
          <button class="sample-chip${index === state.selectedSampleIndex ? " active" : ""}" data-sample-chip="${index}">
            <strong>${index === 0 ? "home" : index === activeRoute.samples.length - 1 ? "pin" : `p${index}`}</strong>
            <span>${formatNumber(sample.x)}, ${formatNumber(sample.y)}</span>
          </button>
        `).join("")
        : '<p class="empty-text">Unauthored route. Click the map to add the first road-center sample.</p>'
      : '<p class="empty-text">Select a place route to edit samples.</p>';

    elements.breakList.innerHTML = activeRoute
      ? activeRoute.breakIndices.length > 0
        ? activeRoute.breakIndices.map((breakIndex) => `<span class="break-chip">sample[${breakIndex}]</span>`).join("")
        : '<span class="empty-inline">No visible-segment breaks</span>'
      : '<span class="empty-inline">Home editing has no breaks</span>';

    const routeSegments = activeRoute ? buildVisibleSegments(activeRoute.samples, activeRoute.breakIndices) : [];
    elements.visibleSegments.textContent = routeSegments.join("\n");

    if (activeRoute) {
      try {
        elements.routeExport.textContent = JSON.stringify(serializeRouteRecord({
          authored: activeRoute.authored,
          home: themeDraft.home,
          pin: activeRoute.pin,
          distanceMeters: activeRoute.distanceMeters,
          samples: activeRoute.samples,
          breakIndices: activeRoute.breakIndices,
        }), null, 2);
      } catch (error) {
        elements.routeExport.textContent = `// ${error.message}`;
      }
    } else {
      elements.routeExport.textContent = "// Select an authored, valid place route to export.";
    }

    try {
      elements.themeExport.textContent = JSON.stringify({
        [state.themeId]: createThemeExport(state.themeId, themeDraft),
      }, null, 2);
    } catch (error) {
      elements.themeExport.textContent = `// ${error.message}`;
    }

    const routePaths = routeSegments.map((segment) => {
      const points = readPathPoints(segment);
      return `<path d="${buildPathFromSamples(points)}" />`;
    }).join("");

    elements.routeOverlay.innerHTML = `
      ${routePaths}
      ${activeRoute ? `<polyline class="route-guide" points="${activeRoute.samples.map((sample) => `${formatNumber(sample.x)},${formatNumber(sample.y)}`).join(" ")}" />` : ""}
    `;

    elements.markersLayer.innerHTML = `
      <button class="marker marker-home${state.routeKey === HOME_ROUTE_KEY ? " active" : ""}" data-marker-type="home" style="left:${formatNumber(themeDraft.home.x)}%;top:${formatNumber(themeDraft.home.y)}%">
        <span>H</span>
      </button>
      ${theme.places.map((placeMeta) => {
        const route = themeDraft.routes[placeMeta.type];
        return `
          <button class="marker marker-place${state.routeKey === placeMeta.type ? " active" : ""}" data-marker-type="place" data-place-type="${placeMeta.type}" style="left:${formatNumber(route.pin.x)}%;top:${formatNumber(route.pin.y)}%">
            <span>${placeMeta.name.slice(0, 1)}</span>
          </button>
        `;
      }).join("")}
      ${activeRoute ? activeRoute.samples.map((sample, index) => `
        <button
          class="sample-point${index === state.selectedSampleIndex ? " active" : ""}${index === 0 || index === activeRoute.samples.length - 1 ? " locked" : ""}"
          data-sample-index="${index}"
          style="left:${formatNumber(sample.x)}%;top:${formatNumber(sample.y)}%"
        >
          <span>${index}</span>
        </button>
      `).join("") : ""}
      ${activeRoute ? activeRoute.samples.slice(1, -1).map((sample, index) => {
        const sampleIndex = index + 1;
        return `
          <button
            class="break-toggle${activeRoute.breakIndices.includes(sampleIndex) ? " active" : ""}"
            data-break-index="${sampleIndex}"
            style="left:${formatNumber(sample.x)}%;top:${formatNumber(sample.y)}%"
          >
            //
          </button>
        `;
      }).join("") : ""}
    `;

    syncUrl();
  };

  const clearCopyStatus = () => {
    window.clearTimeout(clearCopyStatus.timeoutId);
    clearCopyStatus.timeoutId = window.setTimeout(() => {
      state.copyStatus = "";
      render();
    }, 1400);
  };

  const selectTheme = (themeId) => {
    state.themeId = themeId;
    state.routeKey = getWorkTheme(themeId).places[0].type;
    state.selectedSampleIndex = null;
    state.interactionMode = "samples";
    render();
  };

  const selectRouteKey = (routeKey) => {
    state.routeKey = routeKey;
    state.selectedSampleIndex = null;
    render();
  };

  const updateFromStageCoordinate = (coordinate) => {
    const themeDraft = getThemeDraft();
    const activeRoute = getActiveRoute();
    if (state.routeKey === HOME_ROUTE_KEY) {
      updateSharedHome(themeDraft, coordinate);
      render();
      return;
    }

    if (!activeRoute) return;

    if (state.dragTarget?.type === "sample") {
      const sampleIndex = state.dragTarget.sampleIndex;
      if (sampleIndex <= 0 || sampleIndex >= activeRoute.samples.length - 1) return;
      activeRoute.samples[sampleIndex] = normalizePoint(coordinate);
    } else if (state.dragTarget?.type === "pin") {
      setRoutePin(activeRoute, coordinate);
    } else if (!state.dragTarget && state.interactionMode === "samples") {
      if (!activeRoute.authored) {
        activeRoute.authored = true;
        activeRoute.samples = [normalizePoint(themeDraft.home), normalizePoint(activeRoute.pin)];
        activeRoute.breakIndices = [];
      }
      activeRoute.samples.splice(activeRoute.samples.length - 1, 0, normalizePoint(coordinate));
      state.selectedSampleIndex = activeRoute.samples.length - 2;
    }

    render();
  };

  const beginDrag = (dragTarget, event) => {
    state.dragTarget = dragTarget;
    state.dragMoved = false;
    event.preventDefault();
  };

  root.addEventListener("pointermove", (event) => {
    const bounds = elements.stage.getBoundingClientRect();
    state.pointer = readCoordinateFromEvent(event, bounds);
    if (state.dragTarget) {
      state.dragMoved = true;
      updateFromStageCoordinate(state.pointer);
    }
    render();
  });

  root.addEventListener("pointerup", () => {
    state.dragTarget = null;
  });

  root.addEventListener("pointercancel", () => {
    state.dragTarget = null;
  });

  elements.stage.addEventListener("click", (event) => {
    if (state.dragMoved) {
      state.dragMoved = false;
      return;
    }
    if (event.target.closest("[data-sample-index],[data-marker-type],[data-break-index]")) return;
    const coordinate = readCoordinateFromEvent(event, elements.stage.getBoundingClientRect());
    updateFromStageCoordinate(coordinate);
  });

  elements.markersLayer.addEventListener("pointerdown", (event) => {
    const marker = event.target.closest("[data-marker-type]");
    const samplePoint = event.target.closest("[data-sample-index]");
    if (marker?.dataset.markerType === "home") {
      selectRouteKey(HOME_ROUTE_KEY);
      beginDrag({ type: "home" }, event);
      return;
    }
    if (marker?.dataset.markerType === "place") {
      const placeType = marker.dataset.placeType;
      selectRouteKey(placeType);
      beginDrag({ type: "pin", placeType }, event);
      return;
    }
    if (samplePoint) {
      const sampleIndex = Number(samplePoint.dataset.sampleIndex);
      state.selectedSampleIndex = sampleIndex;
      render();
      if (sampleIndex > 0 && sampleIndex < getActiveRoute().samples.length - 1) {
        beginDrag({ type: "sample", sampleIndex }, event);
      }
    }
  });

  elements.markersLayer.addEventListener("click", (event) => {
    const breakToggle = event.target.closest("[data-break-index]");
    if (breakToggle) {
      const activeRoute = getActiveRoute();
      if (!activeRoute) return;
      toggleBreakIndex(activeRoute, Number(breakToggle.dataset.breakIndex));
      render();
    }

    const sampleChip = event.target.closest("[data-sample-index]");
    if (sampleChip) {
      state.selectedSampleIndex = Number(sampleChip.dataset.sampleIndex);
      render();
    }
  });

  elements.sampleList.addEventListener("click", (event) => {
    const sampleChip = event.target.closest("[data-sample-chip]");
    if (!sampleChip) return;
    state.selectedSampleIndex = Number(sampleChip.dataset.sampleChip);
    render();
  });

  elements.themeSelect.innerHTML = Object.values(WORK_MAP_THEMES)
    .map((theme) => `<option value="${theme.id}">${theme.id}</option>`)
    .join("");
  elements.themeSelect.addEventListener("change", (event) => selectTheme(event.target.value));
  elements.routeSelect.addEventListener("change", (event) => selectRouteKey(event.target.value));
  elements.distanceInput.addEventListener("input", (event) => {
    const activeRoute = getActiveRoute();
    if (!activeRoute) return;
    activeRoute.distanceMeters = Math.max(1, Math.round(Number(event.target.value) || activeRoute.distanceMeters || 1));
    render();
  });

  elements.deleteButton.addEventListener("click", () => {
    const activeRoute = getActiveRoute();
    if (!activeRoute) return;
    if (state.selectedSampleIndex <= 0 || state.selectedSampleIndex >= activeRoute.samples.length - 1) return;
    removeSampleAtIndex(activeRoute, state.selectedSampleIndex);
    state.selectedSampleIndex = null;
    render();
  });

  elements.undoButton.addEventListener("click", () => {
    const activeRoute = getActiveRoute();
    if (!activeRoute || activeRoute.samples.length <= 2) return;
    removeSampleAtIndex(activeRoute, activeRoute.samples.length - 2);
    state.selectedSampleIndex = null;
    render();
  });

  elements.clearButton.addEventListener("click", () => {
    const activeRoute = getActiveRoute();
    if (!activeRoute) return;
    clearRouteDraft(activeRoute);
    state.selectedSampleIndex = null;
    render();
  });

  elements.sampleModeButton.addEventListener("click", () => {
    state.interactionMode = "samples";
    render();
  });

  elements.breakModeButton.addEventListener("click", () => {
    if (!getActiveRoute()) return;
    state.interactionMode = "breaks";
    render();
  });

  elements.copyRouteButton.addEventListener("click", async () => {
    const ok = await copyText(elements.routeExport.textContent);
    state.copyStatus = ok ? "Route export copied" : "Clipboard unavailable";
    render();
    clearCopyStatus();
  });

  elements.copyThemeButton.addEventListener("click", async () => {
    const ok = await copyText(elements.themeExport.textContent);
    state.copyStatus = ok ? "Theme export copied" : "Clipboard unavailable";
    render();
    clearCopyStatus();
  });

  window.addEventListener("keydown", (event) => {
    if (isEditableTarget(event.target)) return;
    if ((event.key === "Delete" || event.key === "Backspace") && getActiveRoute()) {
      elements.deleteButton.click();
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && getActiveRoute()) {
      event.preventDefault();
      elements.undoButton.click();
    }
  });

  elements.stageImage.addEventListener("load", () => {
    if (elements.stageImage.naturalWidth > 0 && elements.stageImage.naturalHeight > 0) {
      elements.stage.style.aspectRatio = `${elements.stageImage.naturalWidth} / ${elements.stageImage.naturalHeight}`;
    }
  });

  render();
};

if (typeof window !== "undefined" && typeof document !== "undefined") {
  installCalibrator();
}
