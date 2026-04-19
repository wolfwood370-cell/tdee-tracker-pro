import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Terms() {
  const navigate = useNavigate();
  const today = new Date().toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto py-12 px-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-8"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Torna indietro
        </Button>

        <h1 className="text-4xl font-bold mb-2 font-display">
          Termini e Condizioni di Servizio di NC Nutrition
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          Ultimo aggiornamento: {today}
        </p>

        <div className="space-y-8 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">
              1. Natura del Servizio e Disclaimer Medico (LEGGERE ATTENTAMENTE)
            </h2>
            <p className="text-muted-foreground">
              NC Nutrition è un software di tracciamento nutrizionale e una
              piattaforma di comunicazione tra l'utente e il proprio coach. I
              consigli forniti dall'app, dal motore metabolico o dal coach{" "}
              <strong className="text-foreground">
                NON sostituiscono in alcun modo il parere di un medico o di un
                dietologo clinico
              </strong>
              . L'utente dichiara di essere in buona salute e di utilizzare il
              servizio sotto la propria esclusiva responsabilità. Se soffri di
              disturbi del comportamento alimentare o patologie metaboliche, ti
              invitiamo a consultare un medico specialista prima di utilizzare
              l'app.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">2. Abbonamenti e Pagamenti</h2>
            <p className="text-muted-foreground">
              L'accesso alle funzioni Premium è subordinato al pagamento di un
              abbonamento periodico.
            </p>
            <ul className="space-y-2 text-muted-foreground list-disc pl-6">
              <li>I pagamenti sono processati in modo sicuro tramite Stripe.</li>
              <li>
                L'abbonamento si rinnova automaticamente. È possibile annullare
                il rinnovo in qualsiasi momento dalla propria area riservata o
                dal portale Stripe.
              </li>
              <li>
                Non sono previsti rimborsi per periodi di abbonamento
                parzialmente utilizzati.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">
              3. Condotta dell'Utente e Contenuti (Foto)
            </h2>
            <p className="text-muted-foreground">
              L'utente accetta di fornire dati accurati (es. peso, cibo
              consumato) per garantire il corretto funzionamento dell'algoritmo.
              Nell'utilizzo della "Galleria Progressi", l'utente si impegna a
              caricare esclusivamente fotografie pertinenti al proprio percorso
              fisico.{" "}
              <strong className="text-foreground">
                È severamente vietato il caricamento di contenuti illegali,
                espliciti o non pertinenti.
              </strong>{" "}
              Il Titolare si riserva il diritto di sospendere immediatamente e
              senza rimborso gli account che violano questa regola.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">4. Interruzione del Servizio</h2>
            <p className="text-muted-foreground">
              Il Titolare si riserva il diritto di sospendere l'accesso al
              servizio in caso di mancato pagamento, violazione dei presenti
              Termini o per comportamenti ritenuti abusivi nei confronti dello
              staff di NC Nutrition.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">5. Modifiche ai Termini</h2>
            <p className="text-muted-foreground">
              Ci riserviamo il diritto di modificare questi termini in qualsiasi
              momento, notificando gli utenti tramite l'app o via email. L'uso
              continuato dell'app costituisce accettazione dei nuovi termini.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">6. Titolare e Contatti</h2>
            <p className="text-muted-foreground">
              Titolare del servizio:{" "}
              <strong className="text-foreground">Nicolò Castello</strong> —
              Sede legale: Via Fratelli Cervi, 8, Bagnoli di Sopra (PD). Per
              qualsiasi comunicazione relativa ai presenti Termini scrivere a{" "}
              <a
                href="mailto:nctrainingsystems@gmail.com"
                className="text-primary hover:underline"
              >
                nctrainingsystems@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
