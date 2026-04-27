"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Search, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import {
  Account, Category, Transaction,
  getAccounts, getCategories, getTransactions,
  createTransaction, updateTransaction, deleteTransaction,
} from "@/lib/api";
import { cn } from "@/lib/utils";

function fmtAmount(amount: string, currency = "EUR") {
  const n = parseFloat(amount);
  return n.toLocaleString("de-DE", { style: "currency", currency });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function TransactionsPage() {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filterAccount, setFilterAccount] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [form, setForm] = useState({
    account_id: "", booking_date: new Date().toISOString().slice(0, 10),
    amount: "", counterparty: "", purpose: "", category_id: "", notes: "",
  });

  const load = useCallback(async () => {
    setTxs(await getTransactions({ account_id: filterAccount || undefined, search: search || undefined, limit: 200 }));
  }, [filterAccount, search]);

  useEffect(() => {
    getAccounts().then(setAccounts);
    getCategories().then(setCategories);
  }, []);
  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditTx(null);
    setForm({ account_id: accounts[0]?.id ?? "", booking_date: new Date().toISOString().slice(0, 10), amount: "", counterparty: "", purpose: "", category_id: "", notes: "" });
    setOpen(true);
  }
  function openEdit(tx: Transaction) {
    setEditTx(tx);
    setForm({ account_id: tx.account_id, booking_date: tx.booking_date, amount: tx.amount, counterparty: tx.counterparty ?? "", purpose: tx.purpose ?? "", category_id: tx.category_id ?? "", notes: tx.notes ?? "" });
    setOpen(true);
  }

  async function save() {
    if (editTx) {
      await updateTransaction(editTx.id, { category_id: form.category_id || null, notes: form.notes || null });
    } else {
      await createTransaction({
        account_id: form.account_id,
        booking_date: form.booking_date,
        amount: form.amount,
        counterparty: form.counterparty || null,
        purpose: form.purpose || null,
        category_id: form.category_id || null,
        notes: form.notes || null,
      });
    }
    setOpen(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Buchung löschen?")) return;
    await deleteTransaction(id);
    load();
  }

  const accountMap = Object.fromEntries(accounts.map(a => [a.id, a]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Buchungen</h1>
        <Button onClick={openCreate} disabled={accounts.length === 0}><Plus size={16} />Buchung anlegen</Button>
      </div>

      {/* Filter bar */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Suchen…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterAccount} onChange={e => setFilterAccount(e.target.value)} className="w-48">
          <option value="">Alle Konten</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {txs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              Keine Buchungen gefunden. CSV importieren oder manuell anlegen.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs">
                  <th className="text-left px-4 py-3 font-medium">Datum</th>
                  <th className="text-left px-4 py-3 font-medium">Empfänger</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Verwendungszweck</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Konto</th>
                  <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Kategorie</th>
                  <th className="text-right px-4 py-3 font-medium">Betrag</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {txs.map(tx => {
                  const amount = parseFloat(tx.amount);
                  const acc = accountMap[tx.account_id];
                  return (
                    <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(tx.booking_date)}</td>
                      <td className="px-4 py-3 font-medium max-w-[180px] truncate">{tx.counterparty || "–"}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[220px] truncate hidden md:table-cell">{tx.purpose || "–"}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{acc?.name ?? "–"}</td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {tx.category ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted">
                            {tx.category.icon} {tx.category.name}
                          </span>
                        ) : (
                          <button onClick={() => openEdit(tx)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                            <Tag size={12} /> Zuordnen
                          </button>
                        )}
                      </td>
                      <td className={cn("px-4 py-3 text-right font-semibold whitespace-nowrap", amount >= 0 ? "text-green-400" : "text-red-400")}>
                        {fmtAmount(tx.amount, tx.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => remove(tx.id)} className="text-muted-foreground hover:text-red-400 transition-colors text-xs">✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} title={editTx ? "Buchung bearbeiten" : "Neue Buchung"} className="max-w-lg">
        <div className="space-y-3">
          {!editTx && (
            <>
              <div className="space-y-1">
                <Label>Konto *</Label>
                <Select value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Datum *</Label>
                  <Input type="date" value={form.booking_date} onChange={e => setForm(f => ({ ...f, booking_date: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Betrag * (negativ = Ausgabe)</Label>
                  <Input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="-42.50" />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Empfänger</Label>
                <Input value={form.counterparty} onChange={e => setForm(f => ({ ...f, counterparty: e.target.value }))} placeholder="z.B. REWE" />
              </div>
              <div className="space-y-1">
                <Label>Verwendungszweck</Label>
                <Input value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} />
              </div>
            </>
          )}
          <div className="space-y-1">
            <Label>Kategorie</Label>
            <Select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
              <option value="">– keine –</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Notiz</Label>
            <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={save} disabled={!editTx && (!form.account_id || !form.amount)}>Speichern</Button>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
