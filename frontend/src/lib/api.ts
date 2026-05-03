const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "API error");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Accounts ─────────────────────────────────────────────────────────────────
export interface Account {
  id: string;
  name: string;
  type: string;
  bank_name: string | null;
  iban: string | null;
  currency: string;
  color: string | null;
  balance_cached: string;
  sync_method: string;
  created_at: string;
  archived_at: string | null;
}

export const getAccounts = () => req<Account[]>("/api/v1/accounts");
export const createAccount = (body: Partial<Account>) => req<Account>("/api/v1/accounts", { method: "POST", body: JSON.stringify(body) });
export const updateAccount = (id: string, body: Partial<Account>) => req<Account>(`/api/v1/accounts/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const deleteAccount = (id: string) => req<void>(`/api/v1/accounts/${id}`, { method: "DELETE" });

// ── Categories ────────────────────────────────────────────────────────────────
export interface Category {
  id: string;
  parent_id: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  kind: string;
  position: number;
}

export const getCategories = () => req<Category[]>("/api/v1/categories");

// ── Transactions ──────────────────────────────────────────────────────────────
export interface Transaction {
  id: string;
  account_id: string;
  booking_date: string;
  value_date: string | null;
  amount: string;
  currency: string;
  counterparty: string | null;
  purpose: string | null;
  category_id: string | null;
  category: Category | null;
  notes: string | null;
  is_transfer: boolean;
  source: string;
  imported_at: string;
}

export interface TransactionFilter { account_id?: string; search?: string; limit?: number; offset?: number; }
export const getTransactions = (f: TransactionFilter = {}) => {
  const p = new URLSearchParams();
  if (f.account_id) p.set("account_id", f.account_id);
  if (f.search) p.set("search", f.search);
  if (f.limit) p.set("limit", String(f.limit));
  if (f.offset) p.set("offset", String(f.offset));
  return req<Transaction[]>(`/api/v1/transactions?${p}`);
};
export const createTransaction = (body: Partial<Transaction>) => req<Transaction>("/api/v1/transactions", { method: "POST", body: JSON.stringify(body) });
export const updateTransaction = (id: string, body: Partial<Transaction>) => req<Transaction>(`/api/v1/transactions/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const deleteTransaction = (id: string) => req<void>(`/api/v1/transactions/${id}`, { method: "DELETE" });

// ── Budgets ───────────────────────────────────────────────────────────────────
export interface BudgetItem {
  id: string;
  label: string;
  kind: "income" | "expense";
  amount: string;
  category_id: string | null;
  position: number;
}

export interface BudgetResponse {
  month: string;
  items: BudgetItem[];
  actuals: Record<string, string>; // category_id → amount, "income" → total income
}

export const getBudget = (month: string) =>
  req<BudgetResponse>(`/api/v1/budgets/${month}`);

export const createBudgetItem = (
  month: string,
  body: { label: string; kind: string; amount: number; category_id?: string | null; position?: number }
) => req<BudgetItem>(`/api/v1/budgets/${month}/items`, { method: "POST", body: JSON.stringify(body) });

export const updateBudgetItem = (
  month: string,
  itemId: string,
  body: Partial<{ label: string; amount: number; category_id: string | null; position: number }>
) => req<BudgetItem>(`/api/v1/budgets/${month}/items/${itemId}`, { method: "PATCH", body: JSON.stringify(body) });

export const deleteBudgetItem = (month: string, itemId: string) =>
  req<void>(`/api/v1/budgets/${month}/items/${itemId}`, { method: "DELETE" });

export interface CopyBudgetResponse {
  copied_to: string[];
  skipped: string[];
}
export const copyBudget = (month: string, months: number) =>
  req<CopyBudgetResponse>(`/api/v1/budgets/${month}/copy`, {
    method: "POST",
    body: JSON.stringify({ months }),
  });

// ── Import ─────────────────────────────────────────────────────────────────────
export interface PreviewRow {
  booking_date: string;
  value_date: string | null;
  amount: string;
  currency: string;
  counterparty: string;
  purpose: string;
  hash: string;
  is_duplicate: boolean;
}
export interface PreviewResponse { rows: PreviewRow[]; total: number; duplicates: number; new: number; }

export async function previewImport(file: File, account_id: string, profile: string): Promise<PreviewResponse> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("account_id", account_id);
  fd.append("profile", profile);
  const res = await fetch(`${BASE}/api/v1/import/preview`, { method: "POST", credentials: "include", body: fd });
  if (!res.ok) { const e = await res.json().catch(() => ({ detail: res.statusText })); throw new Error(e.detail); }
  return res.json();
}

export async function confirmImport(account_id: string, profile: string, rows: PreviewRow[]): Promise<{ imported: number; batch_id: string | null }> {
  return req("/api/v1/import/confirm", { method: "POST", body: JSON.stringify({ account_id, profile, rows }) });
}

export interface ImportBatch {
  batch_id: string;
  imported_at: string;
  profile: string;
  account_id: string;
  account_name: string;
  count: number;
}

export const getImportHistory = () => req<ImportBatch[]>("/api/v1/import/history");
export const deleteImportBatch = (batch_id: string) =>
  req<{ deleted: number }>(`/api/v1/import/batch/${batch_id}`, { method: "DELETE" });
