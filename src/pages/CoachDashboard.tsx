import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, Activity, BarChart3 } from "lucide-react";

const CoachDashboard = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Coach Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage and monitor your clients</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Clients", value: "0", icon: Users, change: "" },
          { label: "Avg. Compliance", value: "—%", icon: TrendingUp, change: "" },
          { label: "Check-ins Today", value: "0", icon: Activity, change: "" },
          { label: "Avg. TDEE Accuracy", value: "—%", icon: BarChart3, change: "" },
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
          <CardTitle className="text-lg font-display">Client List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No clients yet</p>
            <p className="text-xs text-muted-foreground mt-1">Clients will appear here once they sign up</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CoachDashboard;
