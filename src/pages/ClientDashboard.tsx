import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Flame, Scale, Target, Utensils, TrendingUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const ClientDashboard = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Panoramica giornaliera di nutrizione e progressi</p>
      </div>

      {/* Widget Hero - Contesto Giornaliero */}
      <Card className="glass-card glow-primary border-border overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-primary" />
            <h2 className="font-display font-semibold text-foreground">Obiettivi di Oggi</h2>
            <span className="ml-auto text-xs text-muted-foreground">
              {new Date().toLocaleDateString("it-IT", { weekday: "long", month: "short", day: "numeric" })}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Calorie", value: "—", target: "2.450", icon: Flame, color: "text-orange-400" },
              { label: "Proteine", value: "—", target: "185g", icon: Target, color: "text-primary" },
              { label: "Carboidrati", value: "—", target: "280g", icon: Utensils, color: "text-blue-400" },
              { label: "Grassi", value: "—", target: "78g", icon: TrendingUp, color: "text-yellow-400" },
            ].map((metric) => (
              <div key={metric.label} className="bg-secondary/50 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <metric.icon className={`h-4 w-4 ${metric.color}`} />
                  <span className="text-xs text-muted-foreground">{metric.label}</span>
                </div>
                <div>
                  <p className="text-2xl font-display font-bold text-foreground">{metric.value}</p>
                  <p className="text-xs text-muted-foreground">di {metric.target}</p>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full w-0 bg-primary rounded-full transition-all" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Inserimento Rapido */}
        <Card className="glass-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                Registrazione Rapida
              </CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">Registra il peso e la nutrizione giornaliera</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-20 flex-col gap-2 border-border hover:border-primary/50 hover:bg-primary/5">
                <Scale className="h-5 w-5 text-primary" />
                <span className="text-xs text-muted-foreground">Registra Peso</span>
              </Button>
              <Button variant="outline" className="h-20 flex-col gap-2 border-border hover:border-primary/50 hover:bg-primary/5">
                <Utensils className="h-5 w-5 text-primary" />
                <span className="text-xs text-muted-foreground">Registra Pasti</span>
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Nessuna voce registrata oggi
            </p>
          </CardContent>
        </Card>

        {/* Obiettivi Settimanali */}
        <Card className="glass-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Obiettivi Settimanali
            </CardTitle>
            <p className="text-xs text-muted-foreground">Obiettivi algoritmici per questa settimana</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Variazione Peso Target", value: "−0,25 kg", sub: "Deficit moderato" },
              { label: "Calorie Giornaliere Target", value: "2.450 kcal", sub: "Adattate dal TDEE" },
              { label: "Media Calorie Settimanale", value: "— kcal", sub: "Registra per calcolare" },
              { label: "Aderenza", value: "— %", sub: "Giorni registrati questa settimana" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.sub}</p>
                </div>
                <p className="text-sm font-display font-semibold text-foreground">{item.value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ClientDashboard;
