"use client";

import { useEffect, useState } from "react";
import { Plus, Building2, Pencil, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Account, getAccounts, createAccount, updateAccount, deleteAccount } from "@/lib/api";
import { cn } from "@/lib/utils";

const TYPES = ["giro", "kreditkarte", "depot", "bargeld", "sparbuch"] as const;
const TYPE_LABELS: Record<string, string> = {
  giro: "Girokonto", kreditkarte: "Kreditkarte", depot: "Depot",
  bargeld: "Bargeld", sparbuch: "Sparkonto",
};
const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#64748b"];

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState({ name: "", type: "giro", bank_name: "", iban: "", color: COLORS[0] });

  async function load() { setAccounts(await getAccounts()); }
  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", type: "giro", bank_name: "", iban: "", color: COLORS[0] });
    setOpen(true);
  }
  function openEdit(a: Account) {
    setEditing(a);
    setForm({ name: a.name, type: a.type, bank_name: a.bank_name ?? "", iban: a.iban ?? "", color: a.color ?? COLORS[0] });
    setOpen(true);
  }

  async function save() {
    if (editing) {
      await updateAccount(editing.id, { name: form.name, bank_name: form.bank_name || null, iban: form.iban || null, color: form.color });
    } else {
      await createAccount({ name: form.name, type: form.type, bank_name: form.bank_name || null, iban: form.iban || null, color: form.color });
    }
    setOpen(false);
    load();
  }

  async function archive(id: string) {
    if (!confirm("Konto archivieren?")) return;
    await deleteAccount(id);
    load();
  }

  const total = accounts.reduce((s, a) => s + parseFloat(a.balance_cached), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Konten</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Nettovermögen:{" "}
            <span className={cn("font-semibold", total >= 0 ? "text-green-400" : "text-red-400")}>
              {total.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
            </span>
          </p>
        </div>
        <Button onClick={openCreate}><Plus size={16} />Konto anlegen</Button>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 size={40} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Noch keine Konten. Leg dein erstes Konto an.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {accounts.map((a) => {
            const bal = parseFloat(a.balance_cached);
            return (
              <Card key={a.id} className="relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ background: a.color ?? "#3b82f6" }} />
                <CardHeader className="pb-2 pl-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{a.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {TYPE_LABELS[a.type] ?? a.type}{a.bank_name ? ` · ${a.bank_name}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(a)} className="p-1 text-muted-foreground hover:text-foreground transition-colors"><Pencil size={14} /></button>
                      <button onClick={() => archive(a.id)} className="p-1 text-muted-foreground hover:text-red-400 transition-colors"><Archive size={14} /></button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pl-5">
                  <p className={cn("text-2xl font-bold", bal >= 0 ? "text-green-400" : "text-red-400")}>
                    {bal.toLocaleString("de-DE", { style: "currency", currency: a.currency })}
                  </p>
                  {a.iban && <p className="text-xs text-muted-foreground mt-1 font-mono">{a.iban}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title={editing ? "Konto bearbeiten" : "Neues Konto"}>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Name *</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. Girokonto ING" />
          </div>
          {!editing && (
            <div className="space-y-1">
              <Label>Typ *</Label>
              <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label>Bank</Label>
            <Input value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} placeholder="z.B. ING DiBa" />
          </div>
          <div className="space-y-1">
            <Label>IBAN</Label>
            <Input value={form.iban} onChange={e => setForm(f => ({ ...f, iban: e.target.value }))} placeholder="DE89 3704 0044 …" className="font-mono" />
          </div>
          <div className="space-y-1">
            <Label>Farbe</Label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={cn("w-7 h-7 rounded-full border-2 transition-all", form.color === c ? "border-white scale-110" : "border-transparent")}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={save} disabled={!form.name}>Speichern</Button>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
