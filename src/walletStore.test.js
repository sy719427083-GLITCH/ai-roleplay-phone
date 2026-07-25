import assert from "node:assert/strict";
import test from "node:test";
import {
  WALLET_STORAGE_KEY,
  addWalletIncomeOnce,
  applyWalletTransaction,
  readWalletData,
  writeWalletData,
} from "./walletStore.js";

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

test("normalizes stored wallet data and safely recovers malformed display data", () => {
  const storage = createMemoryStorage({ [WALLET_STORAGE_KEY]: JSON.stringify({ balance: "12.5", transactions: "bad" }) });
  assert.deepEqual(readWalletData(storage), { balance: 12.5, transactions: [] });
  assert.deepEqual(readWalletData(createMemoryStorage({ [WALLET_STORAGE_KEY]: "bad json" })), { balance: 0, transactions: [] });
});

test("writes wallet data through the shared storage key", () => {
  const storage = createMemoryStorage();
  writeWalletData({ balance: 20, transactions: [] }, storage);
  assert.deepEqual(readWalletData(storage), { balance: 20, transactions: [] });
});

test("preserves generic wallet add and guarded subtract transactions", () => {
  const storage = createMemoryStorage({ [WALLET_STORAGE_KEY]: JSON.stringify({ balance: 100, transactions: [] }) });
  assert.equal(applyWalletTransaction({ type: "sub", amount: 120, desc: "too much" }, storage), false);
  assert.equal(applyWalletTransaction({ type: "add", amount: 30, desc: "income" }, storage), true);
  assert.equal(applyWalletTransaction({ type: "sub", amount: 25, desc: "expense" }, storage), true);
  const wallet = readWalletData(storage);
  assert.equal(wallet.balance, 105);
  assert.deepEqual(wallet.transactions.map((item) => item.type), ["sub", "add"]);
});

test("credits a project reward exactly once", () => {
  const storage = createMemoryStorage({ [WALLET_STORAGE_KEY]: JSON.stringify({ balance: 100, transactions: [] }) });
  const input = { id: "work:p1:start", amount: 2100, desc: "项目报酬 · 真实项目" };
  const first = addWalletIncomeOnce(input, storage);
  const second = addWalletIncomeOnce(input, storage);
  assert.equal(first.wallet.balance, 2200);
  assert.equal(first.credited, true);
  assert.equal(second.wallet.balance, 2200);
  assert.equal(second.duplicate, true);
  assert.equal(second.wallet.transactions.length, 1);
});

test("rejects invalid rewards", () => {
  const storage = createMemoryStorage();
  assert.throws(() => addWalletIncomeOnce({ id: "", amount: 10, desc: "bad" }, storage), /报酬/);
  assert.throws(() => addWalletIncomeOnce({ id: "id", amount: 0, desc: "bad" }, storage), /报酬/);
});

test("throws without inventing success when wallet persistence fails", () => {
  const storage = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
  assert.throws(() => addWalletIncomeOnce({ id: "work:p1:start", amount: 10, desc: "项目报酬" }, storage), /钱包写入失败/);
});

test("does not overwrite a wallet that cannot be read", () => {
  let writes = 0;
  const storage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { writes += 1; } };
  assert.throws(() => addWalletIncomeOnce({ id: "work:p1:start", amount: 10, desc: "项目报酬" }, storage), /钱包读取失败/);
  assert.equal(writes, 0);
});
