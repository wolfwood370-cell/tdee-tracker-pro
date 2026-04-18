/**
 * Parse a macros string like "400 kcal | 30g P | 40g C | 10g G" into raw numbers.
 * Falls back to 0 for any value not detected.
 */
export interface ParsedMacros {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export function parseMacrosString(macros: string): ParsedMacros {
  const safe = macros ?? "";
  const num = (re: RegExp) => {
    const m = safe.match(re);
    return m ? Math.round(parseFloat(m[1])) : 0;
  };
  return {
    calories: num(/(\d+(?:\.\d+)?)\s*kcal/i),
    protein: num(/(\d+(?:\.\d+)?)\s*g\s*P/i),
    carbs: num(/(\d+(?:\.\d+)?)\s*g\s*C/i),
    fats: num(/(\d+(?:\.\d+)?)\s*g\s*G/i),
  };
}
