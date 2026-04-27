import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, TrendingUp, TrendingDown, PiggyBank } from "lucide-react";

const kpis = [
  { label: "Nettovermögen", value: "–", icon: Wallet, hint: "Alle Konten zusammen" },
  { label: "Einnahmen (MTD)", value: "–", icon: TrendingUp, hint: "Monat bis heute" },
  { label: "Ausgaben (MTD)", value: "–", icon: TrendingDown, hint: "Monat bis heute" },
  { label: "Sparquote", value: "–", icon: PiggyBank, hint: "Aktueller Monat" },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Übersicht deiner Finanzen</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, hint }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <Icon size={16} className="text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Letzte Buchungen</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Noch keine Buchungen. Konten anlegen oder CSV importieren.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ausgaben nach Kategorie</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Daten erscheinen nach dem ersten Import.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
