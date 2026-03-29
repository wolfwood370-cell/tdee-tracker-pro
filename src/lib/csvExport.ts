import type { SmoothedLog } from "@/lib/algorithms";

export function exportClientCSV(logs: SmoothedLog[], clientName: string) {
  const header = "Date,Scale Weight (kg),Trend Weight (kg),Calories In (kcal)";
  const rows = logs.map((l) =>
    [
      l.log_date,
      l.weight ?? "",
      l.trendWeight != null ? l.trendWeight.toFixed(2) : "",
      l.calories ?? "",
    ].join(",")
  );

  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${clientName.replace(/\s+/g, "_")}_metrics.csv`;
  a.click();

  URL.revokeObjectURL(url);
}
