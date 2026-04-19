import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Privacy() {
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

        <h1 className="text-4xl font-bold mb-2 font-display">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">
          Ultimo aggiornamento: [Data da inserire]
        </p>

        <div className="space-y-8 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">1. Titolare del Trattamento</h2>
            <p className="text-muted-foreground">
              [Placeholder] Indicare nome, ragione sociale, indirizzo ed email
              di contatto del Titolare del trattamento dei dati personali.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">2. Dati Trattati</h2>
            <p className="text-muted-foreground">
              [Placeholder] Descrivere le categorie di dati raccolti: dati
              anagrafici, dati biometrici (peso, composizione corporea),
              parametri di biofeedback, foto progressi, dati nutrizionali.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">3. Finalità del Trattamento</h2>
            <p className="text-muted-foreground">
              [Placeholder] Specificare le finalità: erogazione del servizio di
              coaching nutrizionale, calcolo dei target calorici, monitoraggio
              dei progressi, comunicazioni con il coach.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">4. Base Giuridica</h2>
            <p className="text-muted-foreground">
              [Placeholder] Indicare le basi giuridiche del trattamento ai
              sensi dell'art. 6 e 9 del GDPR (consenso esplicito per dati
              sanitari).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">5. Conservazione dei Dati</h2>
            <p className="text-muted-foreground">
              [Placeholder] Tempi di conservazione e criteri di cancellazione.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">6. Diritti dell'Interessato</h2>
            <p className="text-muted-foreground">
              [Placeholder] Diritto di accesso, rettifica, cancellazione,
              limitazione, portabilità e opposizione ai sensi degli artt. 15-22
              GDPR.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">7. Sicurezza</h2>
            <p className="text-muted-foreground">
              [Placeholder] Misure tecniche e organizzative adottate per
              proteggere i dati (crittografia, RLS, accesso ristretto).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">8. Contatti</h2>
            <p className="text-muted-foreground">
              [Placeholder] Email e modalità di contatto per esercitare i
              propri diritti o richiedere informazioni.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
