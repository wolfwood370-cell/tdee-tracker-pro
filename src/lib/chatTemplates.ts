/**
 * Quick Reply Templates (Phase 68)
 * --------------------------------------------------
 * Contextual one-click reply suggestions for the Coach, based on the
 * client's current compliance status. Reduces response time and cognitive
 * load — the coach can review/edit before sending.
 */

import type { ComplianceStatus } from "@/lib/compliance";

/**
 * Returns a list of suggested reply strings tailored to the client's status.
 * @param status     - compliance status of the receiver
 * @param clientName - first name of the client (for personalization)
 */
export function getQuickReplies(
  status: ComplianceStatus,
  clientName: string,
): string[] {
  const name = clientName?.trim() || "tu";

  switch (status) {
    case "critical":
      // Win-Back: re-engage a disengaged or stressed client
      return [
        `Ehi ${name}, ho visto che non stai tracciando da qualche giorno. Tutto ok? Sono qui per aiutarti.`,
        `Ciao ${name}, se i macro ti stressano in questi giorni, ignora i numeri e traccia solo il peso. Fammi sapere come va!`,
      ];
    case "warning":
      // Adjustment: small course-correction nudges
      return [
        `Ehi ${name}, ho notato dal dashboard che c'è qualche deviazione. Hai bisogno che aggiusti i target o sblocchi l'AI?`,
        `Ciao ${name}, vedo che i parametri sono un po' altalenanti. Ricorda che la costanza batte la perfezione!`,
      ];
    case "healthy":
      // Positive Reinforcement: keep the momentum going
      return [
        `Ottimo lavoro in questi giorni, ${name}! Continua così, i dati sono perfetti.`,
        `Stai spaccando, ${name}! L'algoritmo sta lavorando in modo ottimale grazie alla tua costanza.`,
      ];
    default:
      return [];
  }
}
