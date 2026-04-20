import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Spatial skeleton for ClientDashboard.
 * Mimics the real layout (hero rings + 3 stat cards + trend chart)
 * to prevent layout shifts during initial Supabase fetch.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in" aria-busy="true" aria-label="Caricamento dashboard">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-24 ml-auto rounded-full" />
      </div>

      {/* Hero — Macro Rings */}
      <Card className="glass-card glow-primary border-border overflow-hidden">
        <CardContent className="p-6 flex flex-col items-center gap-5">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-48 w-48 rounded-full" />
          <div className="grid grid-cols-3 gap-4 w-full max-w-md">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2 text-center">
                <Skeleton className="h-3 w-16 mx-auto" />
                <Skeleton className="h-6 w-20 mx-auto" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stat cards row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="glass-card border-border">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Weight trend chart */}
      <Card className="glass-card border-border">
        <CardContent className="p-5 space-y-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </CardContent>
      </Card>
    </div>
  );
}
