"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getBudget, createBudgetItem, updateBudgetItem, deleteBudgetItem,
  getCategories,
  type BudgetItem, type BudgetResponse, type Category,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ── helpers ──────────────────────────────────────────────────────────────────

function toMonth(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmt(n: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
}

function num(s: string | undefined) {
  return parseFloat(s ?? "0") || 0;
}

// ── inline-editable amount cell ──────────────────────────────────────────────

function AmountCell({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");

  function start() {
    setRaw(String(value));
    setEditing(true);
  }

  function commit() {
    const n = parseFloat(raw.replace(",", "."));
    if (!isNaN(n) && n >= 0) onSave(n);
    setEditing(false);
  }

  if (editing) {
    return (
      <Input
        autoFocus
        className="w-28 text-right h-7 text-sm"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
      />
    );
  }
  return (
    <button
      onClick={start}
      className="w-28 text-right text-sm hover:underline cursor-text"
      title="Klicken zum Bearbeiten"
    >
      {fmt(value)}
    </button>
  );
}

// ── progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ spent, budget }: { spent: number; budget: number }) {
  const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const over = budget > 0 && spent > budget;
  return (
    <div className="w-full bg-muted rounded-full h-1.5 mt-1">
      <div
        className={`h-1.5 rounded-full transition-all ${over ? "bg-red-500" : "bg-primary"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function BudgetsPage() {
  const [month, setMonth] = useState(toMonth(new Date()));
  const [budget, setBudget] = useState<BudgetResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [b, cats] = await Promise.all([getBudget(month), getCategories()]);
      setBudget(b);
      setCategories(cats);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  // ── mutations ─────────────────────────────────────────────────────────────

  async function addIncomeItem(label: string) {
    await createBudgetItem(month, { label, kind: "income", amount: 0, position: incomeItems.length });
    load();
  }

  async function addExpenseItem(catId: string, label: string) {
    await createBudgetItem(month, { label, kind: "expense", amount: 0, category_id: catId, position: expenseItems.length });
    load();
  }

  async function saveAmount(item: BudgetItem, amount: number) {
    await updateBudgetItem(month, item.id, { amount });
    load();
  }

  async function removeItem(item: BudgetItem) {
    await deleteBudgetItem(month, item.id);
    load();
  }

  // ── derived ───────────────────────────────────────────────────────────────

  const incomeItems = budget?.items.filter((i) => i.kind === "income") ?? [];
  const expenseItems = budget?.items.filter((i) => i.kind === "expense") ?? [];
  const expenseCategories = categories.filter((c) => c.kind === "expense");

  const totalIncomeBudget = incomeItems.reduce((s, i) => s + num(i.amount), 0);
  const totalExpenseBudget = expenseItems.reduce((s, i) => s + num(i.amount), 0);
  const actualIncome = num(budget?.actuals["income"]);
  const actualExpense = Object.entries(budget?.actuals ?? {})
    .filter(([k]) => k !== "income")
    .reduce((s, [, v]) => s + Math.abs(num(v)), 0);
  const remaining = totalIncomeBudget - totalExpenseBudget;

  // ── month nav ─────────────────────────────────────────────────────────────

  function shiftMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(toMonth(d));
  }

  // ── render ────────────────────────────────────────────────────────────────

  if (loading) return <p className="text-muted-foreground p-4">Lade Budget…</p>;
  if (error) return <p className="text-red-500 p-4">{error}</p>;

  return (
    <div className="space-y-6 max-w-3xl">

      {/* ── Header + Monatsnavigation ── */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => shiftMonth(-1)}>‹</Button>
        <h1 className="text-2xl font-semibold tabular-nums">
          {new Date(month + "-01").toLocaleDateString("de-DE", { month: "long", year: "numeric" })}
        </h1>
        <Button variant="outline" size="sm" onClick={() => shiftMonth(1)}>›</Button>
      </div>

      {/* ── Übersichtskarten ── */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-normal">Geplantes Einkommen</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-xl font-semibold text-green-600">{fmt(totalIncomeBudget)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Ist: {fmt(actualIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-normal">Geplante Ausgaben</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-xl font-semibold text-red-500">{fmt(totalExpenseBudget)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Ist: {fmt(actualExpense)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-normal">Verfügbar</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className={`text-xl font-semibold ${remaining >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {fmt(remaining)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">nach Abzug der Budgets</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Einnahmen ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
          <CardTitle className="text-base">💰 Einnahmen</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-1">
          {incomeItems.length === 0 && (
            <p className="text-sm text-muted-foreground">Noch keine Einnahmen definiert.</p>
          )}
          {incomeItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2 py-1">
              <span className="text-sm flex-1">{item.label}</span>
              <AmountCell value={num(item.amount)} onSave={(v) => saveAmount(item, v)} />
              <button
                onClick={() => removeItem(item)}
                className="text-muted-foreground hover:text-red-500 text-sm px-1"
                title="Entfernen"
              >
                ✕
              </button>
            </div>
          ))}

          {/* Add buttons */}
          <div className="flex gap-2 pt-2 flex-wrap">
            <AddIncomeButton
              label="+ Gehalt"
              defaultLabel="Gehalt"
              onAdd={addIncomeItem}
              existing={incomeItems}
            />
            <AddIncomeButton
              label="+ Weiteres Einkommen"
              defaultLabel=""
              onAdd={addIncomeItem}
              existing={incomeItems}
              askLabel
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Ausgaben ── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-base">📊 Ausgaben-Budget</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          {expenseItems.length === 0 && (
            <p className="text-sm text-muted-foreground">Noch keine Ausgaben-Budgets definiert.</p>
          )}
          {expenseItems.map((item) => {
            const cat = categories.find((c) => c.id === item.category_id);
            const actual = Math.abs(num(budget?.actuals[item.category_id ?? ""]));
            const budget_amt = num(item.amount);
            const over = budget_amt > 0 && actual > budget_amt;
            return (
              <div key={item.id}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm flex-1 flex items-center gap-1.5">
                    {cat?.icon && <span>{cat.icon}</span>}
                    {item.label}
                  </span>
                  <span className={`text-sm tabular-nums ${over ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                    {fmt(actual)}
                  </span>
                  <span className="text-muted-foreground text-xs">/</span>
                  <AmountCell value={budget_amt} onSave={(v) => saveAmount(item, v)} />
                  <button
                    onClick={() => removeItem(item)}
                    className="text-muted-foreground hover:text-red-500 text-sm px-1"
                    title="Entfernen"
                  >
                    ✕
                  </button>
                </div>
                <ProgressBar spent={actual} budget={budget_amt} />
              </div>
            );
          })}

          {/* Add expense category */}
          <AddExpenseButton
            categories={expenseCategories}
            existing={expenseItems}
            onAdd={addExpenseItem}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ── sub-components ────────────────────────────────────────────────────────────

function AddIncomeButton({
  label, defaultLabel, onAdd, existing, askLabel = false,
}: {
  label: string;
  defaultLabel: string;
  onAdd: (label: string) => void;
  existing: BudgetItem[];
  askLabel?: boolean;
}) {
  const [active, setActive] = useState(false);
  const [value, setValue] = useState(defaultLabel);

  if (!askLabel) {
    // Simple button — only show if not already added
    const already = existing.some((i) => i.label.toLowerCase() === defaultLabel.toLowerCase());
    if (already) return null;
    return (
      <Button variant="outline" size="sm" onClick={() => onAdd(defaultLabel)}>
        {label}
      </Button>
    );
  }

  if (active) {
    return (
      <div className="flex items-center gap-1">
        <Input
          autoFocus
          placeholder="Bezeichnung"
          className="h-7 text-sm w-40"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) { onAdd(value.trim()); setActive(false); setValue(""); }
            if (e.key === "Escape") { setActive(false); setValue(""); }
          }}
        />
        <Button
          size="sm"
          className="h-7"
          disabled={!value.trim()}
          onClick={() => { if (value.trim()) { onAdd(value.trim()); setActive(false); setValue(""); } }}
        >
          OK
        </Button>
      </div>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={() => setActive(true)}>
      {label}
    </Button>
  );
}

function AddExpenseButton({
  categories, existing, onAdd,
}: {
  categories: Category[];
  existing: BudgetItem[];
  onAdd: (catId: string, label: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const availableCats = categories.filter(
    (c) => !existing.some((e) => e.category_id === c.id)
  );

  if (availableCats.length === 0) return null;

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="mt-1" onClick={() => setOpen(true)}>
        + Kategorie hinzufügen
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {availableCats.map((cat) => (
        <Button
          key={cat.id}
          variant="outline"
          size="sm"
          onClick={() => { onAdd(cat.id, `${cat.icon ? cat.icon + " " : ""}${cat.name}`); setOpen(false); }}
        >
          {cat.icon} {cat.name}
        </Button>
      ))}
      <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Abbrechen</Button>
    </div>
  );
}
