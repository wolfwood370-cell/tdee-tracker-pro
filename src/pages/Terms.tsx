import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Terms() {
  const navigate = useNavigate();

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
          Termini e Condizioni
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          Ultimo aggiornamento: [Data da inserire]
        </p>

        <div className="space-y-8 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">1. Oggetto del Servizio</h2>
            <p className="text-muted-foreground">
              [Placeholder] Descrivere l'oggetto del servizio offerto da NC
              Nutrition: piattaforma digitale di coaching nutrizionale e
              monitoraggio dei progressi.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">2. Accettazione dei Termini</h2>
            <p className="text-muted-foreground">
              [Placeholder] L'utilizzo della piattaforma comporta l'accettazione
              integrale dei presenti Termini e Condizioni.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">3. Registrazione Account</h2>
            <p className="text-muted-foreground">
              [Placeholder] Requisiti per la registrazione, veridicità dei dati
              forniti, responsabilità sulle credenziali di accesso.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">
              4. Disclaimer Medico e Professionale
            </h2>
            <p className="text-muted-foreground">
              [Placeholder] Il servizio non sostituisce in alcun modo il parere
              di un medico o di un professionista sanitario abilitato. Le
              indicazioni nutrizionali sono di natura educativa e sportiva.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">5. Limitazione di Responsabilità</h2>
            <p className="text-muted-foreground">
              [Placeholder] Esclusione di responsabilità per uso improprio della
              piattaforma o per decisioni assunte in autonomia dall'utente.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">6. Abbonamento e Pagamenti</h2>
            <p className="text-muted-foreground">
              [Placeholder] Modalità di abbonamento, periodo di prova,
              rinnovo, cancellazione e politica di rimborso.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">7. Proprietà Intellettuale</h2>
            <p className="text-muted-foreground">
              [Placeholder] Tutti i contenuti, gli algoritmi e il software sono
              di proprietà esclusiva del Titolare.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">8. Cessazione del Servizio</h2>
            <p className="text-muted-foreground">
              [Placeholder] Condizioni di sospensione o chiusura dell'account
              da parte dell'utente o del Titolare.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">9. Legge Applicabile e Foro</h2>
            <p className="text-muted-foreground">
              [Placeholder] La legge applicabile è quella italiana. Il foro
              competente è [Foro da indicare].
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">10. Modifiche ai Termini</h2>
            <p className="text-muted-foreground">
              [Placeholder] Il Titolare si riserva di aggiornare i presenti
              Termini, dandone comunicazione agli utenti.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
