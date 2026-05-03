"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Upload, CheckCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Account, PreviewResponse, ImportBatch,
  getAccounts, previewImport, confirmImport,
  getImportHistory, deleteImportBatch,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const PROFILES = [
  { value: "ing", label: "ING DiBa" },
  { value: "sparkasse", label: "Sparkasse" },
  { value: "c24", label: "C24 Bank" },
];

type Step = "upload" | "preview" | "done";

export default function ImportPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [profile, setProfile] = useState("ing");
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>("upload");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState<ImportBatch[]>([]);
  const [deletingBatch, setDeletingBatch] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try { setHistory(await getImportHistory()); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    getAccounts().then(a => { setAccounts(a); if (a.length) setAccountId(a[0].id); });
    loadHistory();
  }, [loadHistory]);

  async function handlePreview(f: File) {
    setError(null);
    setImporting(true);
    try {
      const result = await previewImport(f, accountId, profile);
      setPreview(result);
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Einlesen");
    } finally {
      setImporting(false);
    }
  }

  async function handleConfirm() {
    if (!preview) return;
    setImporting(true);
    setError(null);
    try {
      const result = await confirmImport(accountId, profile, preview.rows);
      setImportedCount(result.imported);
      setStep("done");
      loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Import");
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setStep("upload");
    setError(null);
  }

  async function handleDeleteBatch(batch_id: string, count: number) {
    if (!confirm(`Import mit ${count} Buchungen löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) return;
    setDeletingBatch(batch_id);
    try {
      await deleteImportBatch(batch_id);
      await loadHistory();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Fehler beim Löschen");
    } finally {
      setDeletingBatch(null);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) { setFile(f); handlePreview(f); }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-semibold">CSV Import</h1>

      {step === "upload" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Konto</Label>
              <Select value={accountId} onChange={e => setAccountId(e.target.value)} disabled={accounts.length === 0}>
                {accounts.length === 0
                  ? <option>Erst Konto anlegen</option>
                  : accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Bank-Format</Label>
              <Select value={profile} onChange={e => setProfile(e.target.value)}>
                {PROFILES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </Select>
            </div>
          </div>

          <div
            className={cn(
              "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors",
              dragging ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"
            )}
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <Upload size={36} className="mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">CSV-Datei hierher ziehen</p>
            <p className="text-sm text-muted-foreground mt-1">oder klicken zum Auswählen</p>
            <input ref={inputRef} type="file" accept=".csv,.txt" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); handlePreview(f); } }} />
          </div>

          {importing && <p className="text-sm text-muted-foreground text-center">Datei wird eingelesen…</p>}
          {error && <p className="text-sm text-red-400 text-center">{error}</p>}
          {accounts.length === 0 && (
            <p className="text-sm text-amber-400 text-center">Bitte zuerst unter "Konten" ein Konto anlegen.</p>
          )}
        </div>
      )}

      {step === "preview" && preview && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card><CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold">{preview.total}</p>
              <p className="text-xs text-muted-foreground mt-1">Gesamt</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-green-400">{preview.new}</p>
              <p className="text-xs text-muted-foreground mt-1">Neu</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-muted-foreground">{preview.duplicates}</p>
              <p className="text-xs text-muted-foreground mt-1">Duplikate (werden übersprungen)</p>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Vorschau (erste 50 Zeilen)</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs">
                    <th className="text-left px-4 py-2 font-medium">Datum</th>
                    <th className="text-left px-4 py-2 font-medium">Empfänger</th>
                    <th className="text-left px-4 py-2 font-medium hidden md:table-cell">Verwendungszweck</th>
                    <th className="text-right px-4 py-2 font-medium">Betrag</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 50).map((row, i) => {
                    const amount = parseFloat(row.amount);
                    return (
                      <tr key={i} className={cn("border-b border-border last:border-0", row.is_duplicate && "opacity-40")}>
                        <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{row.booking_date}</td>
                        <td className="px-4 py-2 max-w-[180px] truncate">{row.counterparty || "–"}</td>
                        <td className="px-4 py-2 max-w-[200px] truncate hidden md:table-cell text-muted-foreground">{row.purpose || "–"}</td>
                        <td className={cn("px-4 py-2 text-right font-medium whitespace-nowrap", amount >= 0 ? "text-green-400" : "text-red-400")}>
                          {amount.toLocaleString("de-DE", { style: "currency", currency: row.currency })}
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">
                          {row.is_duplicate ? "Duplikat" : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3">
            <Button onClick={handleConfirm} disabled={importing || preview.new === 0}>
              {importing ? "Importiere…" : `${preview.new} Buchungen importieren`}
            </Button>
            <Button variant="outline" onClick={reset}>Abbrechen</Button>
          </div>
        </div>
      )}

      {step === "done" && (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <CheckCircle size={48} className="mx-auto text-green-400" />
            <p className="text-xl font-semibold">{importedCount} Buchungen importiert</p>
            <p className="text-sm text-muted-foreground">Die Buchungen sind jetzt unter "Buchungen" sichtbar.</p>
            <div className="flex gap-3 justify-center pt-2">
              <Button onClick={reset}>Weiteren Import starten</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Import-History ── */}
      {history.length > 0 && (
        <div className="space-y-3 pt-2">
          <h2 className="text-base font-semibold text-muted-foreground">Import-Verlauf</h2>
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs">
                    <th className="text-left px-4 py-3 font-medium">Datum</th>
                    <th className="text-left px-4 py-3 font-medium">Bank</th>
                    <th className="text-left px-4 py-3 font-medium">Konto</th>
                    <th className="text-right px-4 py-3 font-medium">Buchungen</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {history.map((b) => (
                    <tr key={b.batch_id} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {new Date(b.imported_at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3 font-medium capitalize">{b.profile}</td>
                      <td className="px-4 py-3 text-muted-foreground">{b.account_name}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{b.count}</td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-400 hover:text-red-500 hover:border-red-400 h-7 px-2"
                          disabled={deletingBatch === b.batch_id}
                          onClick={() => handleDeleteBatch(b.batch_id, b.count)}
                        >
                          <Trash2 size={13} className="mr-1" />
                          {deletingBatch === b.batch_id ? "Lösche…" : "Import löschen"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
