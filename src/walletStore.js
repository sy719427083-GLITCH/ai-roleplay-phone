export const WALLET_STORAGE_KEY = "roleplayWallet";

const getDefaultStorage = () => window.localStorage;

export function readWalletData(storage = getDefaultStorage(), { strict = false } = {}) {
  try {
    const raw = storage.getItem(WALLET_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      ...(Array.isArray(parsed.expenseReceiptIds) ? { expenseReceiptIds: parsed.expenseReceiptIds.filter(id => typeof id === "string") } : {}),
      ...(Array.isArray(parsed.incomeReceiptIds) ? { incomeReceiptIds: parsed.incomeReceiptIds.filter(id => typeof id === "string") } : {}),
      balance: Number(parsed.balance) || 0,
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
    };
  } catch {
    if (strict) throw new Error("钱包读取失败，请重试");
    return { balance: 0, transactions: [] };
  }
}

export function writeWalletData(walletData, storage = getDefaultStorage()) {
  try {
    storage.setItem(WALLET_STORAGE_KEY, JSON.stringify(walletData));
  } catch {
    throw new Error("钱包写入失败，请重试");
  }
}

function formatWalletDate() {
  const now = new Date();
  return `${now.getMonth() + 1}-${now.getDate()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function applyWalletTransaction({ type, amount, desc, id }, storage = getDefaultStorage()) {
  const value = Number(amount) || 0;
  if (value <= 0 || !["add", "sub"].includes(type)) return false;
  const current = readWalletData(storage, { strict: true });
  if (type === "sub" && current.balance < value) return false;
  writeWalletData({
    ...current,
    balance: current.balance + (type === "add" ? value : -value),
    transactions: [{ id: id || Date.now(), type, amount: value, desc, date: formatWalletDate() }, ...current.transactions],
  }, storage);
  return true;
}

export function addWalletIncomeOnce({ id, amount, desc }, storage = getDefaultStorage()) {
  const value = Number(amount);
  if (typeof id !== "string" || !id || !Number.isFinite(value) || value <= 0) throw new Error("报酬金额无效");
  const wallet = readWalletData(storage, { strict: true });
  if (wallet.incomeReceiptIds?.includes(id) || wallet.transactions.some((item) => item.id === id)) return { wallet, credited: false, duplicate: true };
  const next = {
    ...wallet,
    incomeReceiptIds: [...(wallet.incomeReceiptIds || []), id],
    balance: wallet.balance + value,
    transactions: [{ id, type: "add", amount: value, desc, date: formatWalletDate() }, ...wallet.transactions],
  };
  writeWalletData(next, storage);
  return { wallet: next, credited: true, duplicate: false };
}

// Receipts survive clearing visible history, so interrupted project refreshes are recoverable.
export function subtractWalletOnce({ id, amount, desc }, storage = getDefaultStorage()) {
  if (typeof id !== "string" || !id || !Number.isFinite(amount) || amount <= 0) throw new Error("扣款金额无效");
  const wallet = readWalletData(storage, { strict: true });
  if (wallet.expenseReceiptIds?.includes(id)) return wallet;
  if (!Number.isFinite(wallet.balance) || wallet.balance < amount) throw new Error("钱包余额不足，需要 200 才能刷新");
  const next = { ...wallet, balance: wallet.balance - amount,
    expenseReceiptIds: [...(wallet.expenseReceiptIds || []), id],
    transactions: [{ id, type: "sub", amount, desc, date: formatWalletDate() }, ...wallet.transactions] };
  writeWalletData(next, storage);
  return next;
}
