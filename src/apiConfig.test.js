import assert from "node:assert/strict";
import test from "node:test";
import {
  createEmptyConfig,
  saveConfig,
  selectConfig,
  serializeConfigs,
  updateAiConfig,
} from "./apiConfig.js";

test("saves named API configurations and selects the latest one", () => {
  const state = { configs: [], selectedId: "" };
  const next = saveConfig(state, {
    ...createEmptyConfig(),
    name: "Daily Roleplay",
    main: { apiKey: "main-key", model: "gpt-main", temperature: 0.7 },
  });

  assert.equal(next.configs.length, 1);
  assert.equal(next.configs[0].name, "Daily Roleplay");
  assert.equal(next.selectedId, next.configs[0].id);
});

test("updates an existing configuration instead of duplicating it", () => {
  const first = saveConfig({ configs: [], selectedId: "" }, {
    ...createEmptyConfig(),
    id: "config-1",
    name: "Primary",
  });
  const second = saveConfig(first, {
    ...first.configs[0],
    name: "Primary Updated",
  });

  assert.equal(second.configs.length, 1);
  assert.equal(second.configs[0].name, "Primary Updated");
});

test("selects a saved configuration by id", () => {
  const state = {
    configs: [
      { ...createEmptyConfig(), id: "a", name: "A" },
      { ...createEmptyConfig(), id: "b", name: "B" },
    ],
    selectedId: "a",
  };

  assert.equal(selectConfig(state, "b").selectedId, "b");
  assert.equal(selectConfig(state, "missing").selectedId, "a");
});

test("normalizes retry count and temperatures", () => {
  const config = createEmptyConfig();
  const updated = updateAiConfig(
    { ...config, retryCount: 99, main: { ...config.main, temperature: 9 } },
    "secondary",
    { temperature: -2 },
  );

  assert.equal(updated.retryCount, 5);
  assert.equal(updated.main.temperature, 2);
  assert.equal(updated.secondary.temperature, 0);
});

test("serializes only safe configuration data", () => {
  const state = saveConfig({ configs: [], selectedId: "" }, {
    ...createEmptyConfig(),
    name: "Local",
    main: { apiKey: "secret", model: "model", temperature: 1 },
  });

  const parsed = JSON.parse(serializeConfigs(state));
  assert.equal(parsed.configs[0].main.apiKey, "secret");
  assert.equal(typeof parsed.configs[0].createdAt, "string");
});
