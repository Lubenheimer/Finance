"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getBudget, createBudgetItem, updateBudgetItem, deleteBudgetItem,
  copyBudget, applyGlobalToMonth,
  getCategories,
  type BudgetItem, type BudgetResponse, type Category,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ── helpers ───────────────────────────────────────────────────────────────────

function toMonth(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmt(n: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
}

function num(s: string | undefined) {
  return parseFloat(s ?? "0") || 0;
}

function fmtMonthLabel(m: string) {
  return new Date(m + "-01").toLocaleDateString("de-DE", { month: "short", year: "numeric" });
}

// ── inline-editable amount cell ───────────────────────────────────────────────

function AmountCell({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");

  function start() { setRaw(String(value)); setEditing(true); }

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
    <button onClick={start} className="w-28 text-right text-sm hover:underline cursor-text" title="Klicken zum Bearbeiten">
      {fmt(value)}
    </button>
  );
}

// ── progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ spent, budget }: { spent: number; budget: number }) {
  const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const over = budget > 0 && spent > budget;
  return (
    <div className="w-full bg-muted rounded-full h-1.5 mt-1">
      <div className={`h-1.5 rounded-full transition-all ${over ? "bg-red-500" : "bg-primary"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── diff badge (monthly view only) ────────────────────────────────────────────

function DiffBadge({ monthAmount, globalAmount }: { monthAmount: number; globalAmount: number | undefined }) {
  if (globalAmount === undefined) return null;
  if (Math.abs(monthAmount - globalAmount) < 0.005) return null;
  return (
    <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/30" title={`Jahresplan: ${fmt(globalAmount)}`}>
      ≠ {fmt(globalAmount)}
    </span>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function BudgetsPage() {
  const [view, setView] = useState<"month" | "global">("month");
  const [month, setMonth] = useState(toMonth(new Date()));
  const [budget, setBudget] = useState<BudgetResponse | null>(null);
  const [globalBudget, setGlobalBudget] = useState<BudgetResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyStartMonth, setCopyStartMonth] = useState(toMonth(new Date()));
  const [copyResult, setCopyResult] = useState<string | null>(null);
  const [applyingGlobal, setApplyingGlobal] = useState(false);

  const activeMonth = view === "global" ? "global" : month;

  // ── load ───────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [b, cats] = await Promise.all([getBudget(activeMonth), getCategories()]);
      setBudget(b);
      setCategories(cats);
      // Always load global for diff comparison (only when on monthly view)
      if (view === "month") {
        getBudget("global").then(setGlobalBudget).catch(() => setGlobalBudget(null));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, [activeMonth, view]);

  useEffect(() => { load(); }, [load]);

  // ── mutations ──────────────────────────────────────────────────────────────

  async function addIncomeItem(label: string) {
    await createBudgetItem(activeMonth, { label, kind: "income", amount: 0, position: incomeItems.length });
    load();
  }

  async function addExpenseItem(catId: string, label: string) {
    await createBudgetItem(activeMonth, { label, kind: "expense", amount: 0, category_id: catId, position: expenseItems.length });
    load();
  }

  async function saveAmount(item: BudgetItem, amount: number) {
    await updateBudgetItem(activeMonth, item.id, { amount });
    load();
  }

  async function removeItem(item: BudgetItem) {
    await deleteBudgetItem(activeMonth, item.id);
    load();
  }

  async function handleCopy(months: number) {
    setCopyOpen(false);
    setCopyResult(null);
    try {
      const res = await copyBudget(
        activeMonth,
        months,
        view === "global" ? copyStartMonth : undefined,
      );
      const parts: string[] = [];
      if (res.copied_to.length > 0) parts.push(`✓ Kopiert nach: ${res.copied_to.map(fmtMonthLabel).join(", ")}`);
      if (res.skipped.length > 0) parts.push(`↷ Übersprungen: ${res.skipped.map(fmtMonthLabel).join(", ")}`);
      setCopyResult(parts.join("  ·  ") || "Nichts zu kopieren.");
    } catch (e: unknown) {
      setCopyResult("⚠ " + (e instanceof Error ? e.message : "Fehler beim Kopieren"));
    }
  }

  async function handleApplyGlobal() {
    if (!confirm(`Monatsbudget mit dem Jahresplan überschreiben? Bestehende Einträge gehen verloren.`)) return;
    setApplyingGlobal(true);
    try {
      const updated = await applyGlobalToMonth(month);
      setBudget(updated);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Fehler beim Übernehmen");
    } finally {
      setApplyingGlobal(false);
    }
  }

  // ── derived ────────────────────────────────────────────────────────────────

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

  // Global diff lookup: label → amount (for monthly view comparison)
  const globalAmountByLabel = Object.fromEntries(
    (globalBudget?.items ?? []).map((i) => [i.label, num(i.amount)])
  );

  // ── month nav ──────────────────────────────────────────────────────────────

  function shiftMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(toMonth(d));
  }

  // ── render ─────────────────────────────────────────────────────────────────

  if (loading) return <p className="text-muted-foreground p-4">Lade Budget…</p>;
  if (error) return <p className="text-red-500 p-4">{error}</p>;

  const isGlobal = view === "global";

  return (
    <div className="space-y-6 max-w-3xl">

      {/* ── Tab-Umschalter ── */}
      <div className="flex items-center gap-2">
        <div className="flex rounded-lg border border-border p-0.5 bg-muted/40">
          <button
            onClick={() => { setView("month"); setCopyResult(null); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "month" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Monatsplan
          </button>
          <button
            onClick={() => { setView("global"); setCopyResult(null); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "global" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            🌍 Jahresplan
          </button>
        </div>

        {isGlobal && (
          <p className="text-xs text-muted-foreground">Dein Standard-Budget · dient als Vorlage für Monate</p>
        )}
      </div>

      {/* ── Header ── */}
      <div className="flex items-center gap-3 flex-wrap">
        {!isGlobal && (
          <>
            <Button variant="outline" size="sm" onClick={() => shiftMonth(-1)}>‹</Button>
            <h1 className="text-2xl font-semibold tabular-nums">
              {new Date(month + "-01").toLocaleDateString("de-DE", { month: "long", year: "numeric" })}
            </h1>
            <Button variant="outline" size="sm" onClick={() => shiftMonth(1)}>›</Button>
          </>
        )}
        {isGlobal && (
          <h1 className="text-2xl font-semibold">🌍 Jahresplan</h1>
        )}

        {/* Copy-Button */}
        <div className="relative ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setCopyOpen((o) => !o); setCopyResult(null); }}
            title="Budget auf Monate kopieren"
          >
            📋 Kopieren
          </Button>
          {copyOpen && (
            <div className="absolute right-0 top-9 z-10 bg-popover border border-border rounded-lg shadow-lg p-3 w-56">
              {isGlobal && (
                <div className="mb-2">
                  <p className="text-xs text-muted-foreground mb-1 font-medium">Ab Monat:</p>
                  <input
                    type="month"
                    className="w-full text-sm border border-border rounded px-2 py-1 bg-background"
                    value={copyStartMonth}
                    onChange={(e) => setCopyStartMonth(e.target.value)}
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground mb-2 font-medium">
                {isGlobal ? "Anzahl Monate:" : "In die nächsten … kopieren:"}
              </p>
              <div className="flex flex-col gap-1">
                {[1, 3, 6, 12].map((n) => (
                  <button
                    key={n}
                    onClick={() => handleCopy(n)}
                    className="text-left text-sm px-2 py-1.5 rounded hover:bg-muted transition-colors"
                  >
                    {n === 1 ? "1 Monat" : `${n} Monate`}
                  </button>
                ))}
              </div>
              <button onClick={() => setCopyOpen(false)} className="mt-2 text-xs text-muted-foreground hover:text-foreground w-full text-center">
                Abbrechen
              </button>
            </div>
          )}
        </div>

        {/* Aus Jahresplan übernehmen (nur Monatsansicht) */}
        {!isGlobal && globalBudget && globalBudget.items.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleApplyGlobal}
            disabled={applyingGlobal}
            title="Monatsbudget mit Jahresplan überschreiben"
          >
            {applyingGlobal ? "…" : "↩ Aus Jahresplan"}
          </Button>
        )}
      </div>

      {/* ── Kopier-Ergebnis ── */}
      {copyResult && (
        <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">{copyResult}</p>
      )}

      {/* ── Übersichtskarten (nur Monatsansicht) ── */}
      {!isGlobal && (
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
              <p className={`text-xl font-semibold ${remaining >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmt(remaining)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">nach Abzug der Budgets</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Globale Zusammenfassung ── */}
      {isGlobal && (totalIncomeBudget > 0 || totalExpenseBudget > 0) && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs text-muted-foreground font-normal">Monatliches Einkommen</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-xl font-semibold text-green-600">{fmt(totalIncomeBudget)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs text-muted-foreground font-normal">Monatliche Ausgaben</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-xl font-semibold text-red-500">{fmt(totalExpenseBudget)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs text-muted-foreground font-normal">Monatlich verfügbar</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className={`text-xl font-semibold ${remaining >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmt(remaining)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">jährlich: {fmt(remaining * 12)}</p>
            </CardContent>
          </Card>
        </div>
      )}

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
              <span className="text-sm flex-1 flex items-center flex-wrap gap-1">
                {item.label}
                {!isGlobal && <DiffBadge monthAmount={num(item.amount)} globalAmount={globalAmountByLabel[item.label]} />}
              </span>
              <AmountCell value={num(item.amount)} onSave={(v) => saveAmount(item, v)} />
              <button onClick={() => removeItem(item)} className="text-muted-foreground hover:text-red-500 text-sm px-1" title="Entfernen">✕</button>
            </div>
          ))}
          <div className="flex gap-2 pt-2 flex-wrap">
            <AddIncomeButton label="+ Gehalt" defaultLabel="Gehalt" onAdd={addIncomeItem} existing={incomeItems} />
            <AddIncomeButton label="+ Weiteres Einkommen" defaultLabel="" onAdd={addIncomeItem} existing={incomeItems} askLabel />
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
                  <span className="text-sm flex-1 flex items-center flex-wrap gap-1">
                    {cat?.icon && <span>{cat.icon}</span>}
                    {item.label}
                    {!isGlobal && <DiffBadge monthAmount={budget_amt} globalAmount={globalAmountByLabel[item.label]} />}
                  </span>
                  {!isGlobal && (
                    <span className={`text-sm tabular-nums ${over ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                      {fmt(actual)}
                    </span>
                  )}
                  {!isGlobal && <span className="text-muted-foreground text-xs">/</span>}
                  <AmountCell value={budget_amt} onSave={(v) => saveAmount(item, v)} />
                  <button onClick={() => removeItem(item)} className="text-muted-foreground hover:text-red-500 text-sm px-1" title="Entfernen">✕</button>
                </div>
                {!isGlobal && <ProgressBar spent={actual} budget={budget_amt} />}
              </div>
            );
          })}
          <AddExpenseButton categories={expenseCategories} existing={expenseItems} onAdd={addExpenseItem} />
        </CardContent>
      </Card>
    </div>
  );
}

// ── sub-components ─────────────────────────────────────────────────────────────

function AddIncomeButton({ label, defaultLabel, onAdd, existing, askLabel = false }: {
  label: string; defaultLabel: string; onAdd: (label: string) => void; existing: BudgetItem[]; askLabel?: boolean;
}) {
  const [active, setActive] = useState(false);
  const [value, setValue] = useState(defaultLabel);

  if (!askLabel) {
    const already = existing.some((i) => i.label.toLowerCase() === defaultLabel.toLowerCase());
    if (already) return null;
    return <Button variant="outline" size="sm" onClick={() => onAdd(defaultLabel)}>{label}</Button>;
  }

  if (active) {
    return (
      <div className="flex items-center gap-1">
        <Input autoFocus placeholder="Bezeichnung" className="h-7 text-sm w-40" value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) { onAdd(value.trim()); setActive(false); setValue(""); }
            if (e.key === "Escape") { setActive(false); setValue(""); }
          }}
        />
        <Button size="sm" className="h-7" disabled={!value.trim()}
          onClick={() => { if (value.trim()) { onAdd(value.trim()); setActive(false); setValue(""); } }}>
          OK
        </Button>
      </div>
    );
  }
  return <Button variant="outline" size="sm" onClick={() => setActive(true)}>{label}</Button>;
}

function AddExpenseButton({ categories, existing, onAdd }: {
  categories: Category[]; existing: BudgetItem[]; onAdd: (catId: string, label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const availableCats = categories.filter((c) => !existing.some((e) => e.category_id === c.id));
  if (availableCats.length === 0) return null;
  if (!open) return <Button variant="outline" size="sm" className="mt-1" onClick={() => setOpen(true)}>+ Kategorie hinzufügen</Button>;
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {availableCats.map((cat) => (
        <Button key={cat.id} variant="outline" size="sm"
          onClick={() => { onAdd(cat.id, `${cat.icon ? cat.icon + " " : ""}${cat.name}`); setOpen(false); }}>
          {cat.icon} {cat.name}
        </Button>
      ))}
      <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Abbrechen</Button>
    </div>
  );
}
