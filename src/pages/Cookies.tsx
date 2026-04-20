import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Cookies() {
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

        <article className="space-y-6">
          <header className="space-y-2 mb-8">
            <h1 className="text-4xl font-bold font-display">
              Informativa sui Cookie di NC Nutrition
            </h1>
            <p className="text-sm text-muted-foreground">
              Ultimo aggiornamento: {new Date().toLocaleDateString("it-IT", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </header>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold font-display">1. Definizione e Funzione dei Cookie</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              I cookie sono stringhe di testo di piccole dimensioni che le applicazioni, i siti web o i servizi di terze parti inviano al dispositivo dell'utente durante la navigazione. Vengono memorizzati sul dispositivo per essere poi ritrasmessi agli stessi servizi alla visita successiva. NC Nutrition utilizza queste tecnologie per garantire il corretto funzionamento dell'applicazione, ricordare le preferenze dell'utente e mantenere alti standard di sicurezza durante l'accesso ai dati personali e sanitari.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold font-display">2. Cookie Tecnici e Strettamente Necessari</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              La nostra applicazione fa uso di cookie tecnici strettamente necessari per l'erogazione del servizio. Rientrano in questa categoria i token di autenticazione e di sessione gestiti dalla nostra infrastruttura tramite Supabase. Questi strumenti sono fondamentali per riconoscere l'utente dopo il login, mantenere attiva la sessione di lavoro in modo sicuro e impedire accessi non autorizzati ai diari alimentari o alle metriche fisiche. Essendo indispensabili per il funzionamento dell'app, l'installazione di questi cookie non richiede il preventivo consenso dell'utente. La loro disattivazione tramite le impostazioni del browser renderebbe impossibile l'utilizzo di NC Nutrition.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold font-display">3. Cookie di Terze Parti e Servizi Integrati</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Durante l'utilizzo di NC Nutrition, il tuo dispositivo potrebbe ricevere cookie o tracciatori gestiti da servizi di terze parti necessari per fornire funzionalità specifiche. Integriamo Stripe per l'elaborazione sicura dei pagamenti e la gestione degli abbonamenti. Stripe utilizza cookie propri per prevenire frodi, garantire la sicurezza delle transazioni e processare i rinnovi. Utilizziamo inoltre Iubenda per la gestione dei consensi privacy. Iubenda installa un cookie tecnico dedicato esclusivamente a ricordare le tue preferenze in materia di tracciamento e accettazione delle policy, evitando di doverti mostrare il banner informativo a ogni accesso.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold font-display">4. Gestione delle Preferenze e Disattivazione</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Hai il pieno controllo sulle tue preferenze di tracciamento. Puoi gestire, modificare o revocare i consensi prestati in qualsiasi momento utilizzando il widget fluttuante di Iubenda presente nell'applicazione. In alternativa, puoi accedere alla sezione Impostazioni di NC Nutrition e utilizzare il pulsante dedicato alla gestione delle preferenze cookie. È inoltre possibile intervenire direttamente sulle impostazioni del proprio browser o del sistema operativo mobile per bloccare preventivamente l'installazione di nuovi cookie o per cancellare quelli già salvati in passato.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold font-display">5. Collegamento alla Privacy Policy e Contatti</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Questa Cookie Policy costituisce parte integrante della{" "}
              <Link to="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>{" "}
              generale di NC Nutrition. Per conoscere l'identità del Titolare del Trattamento, i dettagli completi su come proteggiamo e gestiamo i tuoi dati sensibili, le basi giuridiche del trattamento e le modalità per esercitare i tuoi diritti sanciti dal GDPR, ti invitiamo a consultare la nostra Informativa sulla Privacy completa disponibile all'interno dell'applicazione.
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}
