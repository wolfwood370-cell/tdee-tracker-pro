import { useMemo, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface MacroRingsProps {
  protein: { current: number; target: number };
  carbs: { current: number; target: number };
  fats: { current: number; target: number };
  calories: { current: number; target: number };
  className?: string;
  onPerfect?: () => void;
}

function Ring({
  radius,
  strokeWidth,
  progress,
  color,
  glowColor,
  label,
}: {
  radius: number;
  strokeWidth: number;
  progress: number; // 0-1+
  color: string;
  glowColor: string;
  label: string;
}) {
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.min(progress, 1.15); // Allow slight overshoot visual
  const dashOffset = circumference * (1 - clampedProgress);
  const isOver = progress > 1;

  return (
    <g>
      {/* Background track */}
      <circle
        cx="50%"
        cy="50%"
        r={radius}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth={strokeWidth}
        opacity={0.3}
      />
      {/* Progress arc */}
      <circle
        cx="50%"
        cy="50%"
        r={radius}
        fill="none"
        stroke={isOver ? glowColor : color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        transform="rotate(-90 100 100)"
        className="transition-all duration-1000 ease-out"
        style={{
          filter: isOver ? `drop-shadow(0 0 6px ${glowColor})` : undefined,
        }}
      />
    </g>
  );
}

export function MacroRings({ protein, carbs, fats, calories, className, onPerfect }: MacroRingsProps) {
  const proteinPct = protein.target > 0 ? protein.current / protein.target : 0;
  const carbsPct = carbs.target > 0 ? carbs.current / carbs.target : 0;
  const fatsPct = fats.target > 0 ? fats.current / fats.target : 0;

  const remaining = calories.target - calories.current;

  // Check if all macros are within range (90-110%)
  const isPerfect = useMemo(() => {
    const allInRange =
      proteinPct >= 0.9 && proteinPct <= 1.1 &&
      carbsPct >= 0.9 && carbsPct <= 1.1 &&
      fatsPct >= 0.9 && fatsPct <= 1.1;
    return allInRange && calories.current > 0;
  }, [proteinPct, carbsPct, fatsPct, calories.current]);

  // Fire onPerfect only on transitions from false → true to avoid repeated triggers.
  const wasPerfectRef = useRef(false);
  useEffect(() => {
    if (isPerfect && !wasPerfectRef.current) {
      wasPerfectRef.current = true;
      onPerfect?.();
    } else if (!isPerfect && wasPerfectRef.current) {
      wasPerfectRef.current = false;
    }
  }, [isPerfect, onPerfect]);

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative w-48 h-48 md:w-56 md:h-56">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          {/* Outer: Protein (Red-Orange) */}
          <Ring
            radius={90}
            strokeWidth={10}
            progress={proteinPct}
            color="hsl(12, 82%, 52%)"
            glowColor="hsl(16, 95%, 62%)"
            label="Proteine"
          />
          {/* Middle: Carbs (Green) */}
          <Ring
            radius={75}
            strokeWidth={10}
            progress={carbsPct}
            color="hsl(142, 71%, 45%)"
            glowColor="hsl(142, 80%, 55%)"
            label="Carboidrati"
          />
          {/* Inner: Fats (Amber) */}
          <Ring
            radius={60}
            strokeWidth={10}
            progress={fatsPct}
            color="hsl(38, 92%, 50%)"
            glowColor="hsl(38, 100%, 60%)"
            label="Grassi"
          />
          {/* Center text */}
          <text
            x="100"
            y="92"
            textAnchor="middle"
            className="fill-foreground font-display"
            fontSize="28"
            fontWeight="700"
          >
            {remaining >= 0 ? remaining.toLocaleString("it-IT") : `+${Math.abs(remaining).toLocaleString("it-IT")}`}
          </text>
          <text
            x="100"
            y="112"
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize="11"
          >
            kcal {remaining >= 0 ? "rimaste" : "in eccesso"}
          </text>
        </svg>

        {/* Sparkle on perfect */}
        {isPerfect && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-2xl animate-scale-in">✨</span>
          </div>
        )}
      </div>

      {/* Detailed legend: consumed / target per macro */}
      <div className="grid grid-cols-3 gap-2 mt-4 w-full max-w-sm">
        {[
          { label: "Proteine", color: "hsl(12, 82%, 52%)", current: protein.current, target: protein.target, pct: proteinPct },
          { label: "Carb", color: "hsl(142, 71%, 45%)", current: carbs.current, target: carbs.target, pct: carbsPct },
          { label: "Grassi", color: "hsl(38, 92%, 50%)", current: fats.current, target: fats.target, pct: fatsPct },
        ].map((m) => (
          <div key={m.label} className="rounded-lg bg-secondary/40 border border-border p-2 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{m.label}</span>
            </div>
            <p className="text-sm font-bold text-foreground tabular-nums">
              {Math.round(m.current)}<span className="text-muted-foreground font-normal">/{Math.round(m.target)}g</span>
            </p>
            <p className="text-[10px] text-muted-foreground">{Math.round(m.pct * 100)}%</p>
          </div>
        ))}
      </div>
    </div>
  );
}
