import { Flame } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface StreakIndicatorProps {
  streak: number;
  className?: string;
}

export function StreakIndicator({ streak, className }: StreakIndicatorProps) {
  if (streak <= 0) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "inline-flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/30 text-orange-600 rounded-full px-3 py-1 text-sm font-semibold cursor-help transition-all hover:bg-orange-500/15",
            className
          )}>
            <Flame className="h-4 w-4 animate-pulse" />
            <span>{streak} {streak === 1 ? "Giorno" : "Giorni"} di Fuoco</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs max-w-[200px]">
            Mantieni i tuoi macro e logga il peso ogni giorno per aumentare la tua scia! 🔥
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
