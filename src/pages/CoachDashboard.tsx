import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, Activity, BarChart3 } from "lucide-react";

const CoachDashboard = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Dashboard Coach</h1>
        <p className="text-muted-foreground text-sm mt-1">Gestisci e monitora i tuoi clienti</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Clienti Attivi", value: "0", icon: Users, change: "" },
          { label: "Aderenza Media", value: "—%", icon: TrendingUp, change: "" },
          { label: "Check-in Oggi", value: "0", icon: Activity, change: "" },
          { label: "Precisione TDEE Media", value: "—%", icon: BarChart3, change: "" },
        ].map((stat) => (
          <Card key={stat.label} className="glass-card border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
              <p className="text-2xl font-display font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass-card border-border">
        <CardHeader>
          <CardTitle className="text-lg font-display">Lista Clienti</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Nessun cliente ancora</p>
            <p className="text-xs text-muted-foreground mt-1">I clienti appariranno qui una volta registrati</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CoachDashboard;
