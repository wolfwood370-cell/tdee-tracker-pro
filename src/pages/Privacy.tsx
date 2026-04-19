import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Privacy() {
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
          Informativa sulla Privacy di NC Nutrition
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          Ultimo aggiornamento: {today}
        </p>

        <div className="space-y-8 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">1. Titolare del Trattamento</h2>
            <p className="text-muted-foreground">
              Il titolare del trattamento dei dati è{" "}
              <strong className="text-foreground">Nicolò Castello</strong>, con
              sede legale in{" "}
              <strong className="text-foreground">
                Via Fratelli Cervi, 8 — Bagnoli di Sopra (PD)
              </strong>
              , contattabile all'indirizzo email{" "}
              <a
                href="mailto:nctrainingsystems@gmail.com"
                className="text-primary hover:underline"
              >
                nctrainingsystems@gmail.com
              </a>
              .
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">
              2. Quali dati raccogliamo e perché
            </h2>
            <p className="text-muted-foreground">
              NC Nutrition raccoglie le seguenti categorie di dati per erogare
              il servizio:
            </p>
            <ul className="space-y-3 text-muted-foreground list-none">
              <li>
                <strong className="text-foreground">
                  Dati identificativi e di contatto:
                </strong>{" "}
                Email e nome forniti in fase di registrazione.
              </li>
              <li>
                <strong className="text-foreground">
                  Dati Biometrici e Sanitari:
                </strong>{" "}
                Peso, altezza, sesso, età, composizione corporea, log dei pasti
                e parametri di biofeedback (sonno, stress, fame). Questi dati
                sono essenziali per il funzionamento del nostro algoritmo
                metabolico.
              </li>
              <li>
                <strong className="text-foreground">Dati Visivi (Foto):</strong>{" "}
                Le fotografie dei progressi caricate volontariamente
                dall'utente.
              </li>
              <li>
                <strong className="text-foreground">Dati di Pagamento:</strong>{" "}
                Gestiti interamente ed esclusivamente dal nostro partner sicuro
                Stripe. Noi non conserviamo alcun numero di carta di credito.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">
              3. Condivisione dei dati con Terze Parti (Importante)
            </h2>
            <p className="text-muted-foreground">
              I tuoi dati sono conservati su server sicuri crittografati
              (Supabase). Per l'elaborazione dei piani alimentari e dei report,
              NC Nutrition utilizza servizi di Intelligenza Artificiale (come
              OpenAI/Anthropic).
            </p>
            <p className="text-muted-foreground">
              <strong className="text-foreground">Nota bene:</strong> Solo i
              dati testuali e numerici resi anonimi (es. peso e macro) vengono
              processati dall'IA. Le tue fotografie e immagini personali{" "}
              <strong className="text-foreground">
                NON vengono MAI inviate o analizzate
              </strong>{" "}
              da sistemi di intelligenza artificiale di terze parti, rimanendo
              un'esclusiva privata tra te e il tuo coach.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">4. Base Giuridica</h2>
            <p className="text-muted-foreground">
              Trattiamo i tuoi dati biometrici e le tue foto esclusivamente
              previo tuo consenso esplicito (Art. 9 GDPR), che puoi revocare in
              qualsiasi momento cancellando il tuo account.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">5. I tuoi Diritti</h2>
            <p className="text-muted-foreground">
              Hai il diritto di accedere ai tuoi dati, richiederne la modifica,
              la portabilità o la cancellazione totale e irreversibile dai
              nostri server in qualsiasi momento, inviando una mail al Titolare
              o tramite l'apposita funzione nell'app.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
