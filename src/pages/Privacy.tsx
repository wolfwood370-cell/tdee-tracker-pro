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

        <article className="space-y-6">
          <header className="space-y-2 mb-8">
            <h1 className="text-4xl font-bold font-display">
              Informativa sulla Privacy di NC Nutrition
            </h1>
            <p className="text-sm text-muted-foreground">
              Ultimo aggiornamento: {new Date().toLocaleDateString("it-IT", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </header>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold font-display">1. Titolare del Trattamento</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Il Titolare del Trattamento dei Dati è <strong className="text-foreground">Nicolò Castello</strong>, con sede legale in Via Fratelli Cervi, 8, 35023, Bagnoli di Sopra, P.IVA 05392420286. Indirizzo email di contatto del Titolare:{" "}
              <a href="mailto:nctrainingsystems@gmail.com" className="text-primary hover:underline">
                nctrainingsystems@gmail.com
              </a>.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold font-display">2. Tipologie di Dati Raccolti</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              L'applicazione NC Nutrition raccoglie autonomamente o tramite terze parti diverse tipologie di dati personali.
            </p>
            <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground list-disc pl-5">
              <li><strong className="text-foreground">Dati Anagrafici e di Contatto:</strong> Nome, cognome, indirizzo email e data di nascita forniti durante la registrazione.</li>
              <li><strong className="text-foreground">Dati Sensibili e Relativi alla Salute (Art. 9 GDPR):</strong> Per poter fornire il servizio di calcolo del TDEE adattivo e i piani alimentari, raccogliamo dati quali peso, altezza, sesso, composizione corporea (es. dati InBody, massa grassa, massa magra), tracking del ciclo mestruale, intolleranze o allergie alimentari, livelli di stress, qualità del sonno (biofeedback) e diari alimentari giornalieri.</li>
              <li><strong className="text-foreground">Contenuti Multimediali:</strong> Fotografie dei progressi fisici caricate volontariamente dall'utente.</li>
              <li><strong className="text-foreground">Dati di Pagamento:</strong> Informazioni relative agli abbonamenti, gestite in modo sicuro tramite il nostro fornitore di servizi di pagamento (Stripe). Noi non conserviamo i dati completi della tua carta di credito.</li>
              <li><strong className="text-foreground">Dati Tecnici e di Navigazione:</strong> Dati di utilizzo dell'app, token per le notifiche push e log di sistema essenziali per il funzionamento e la sicurezza (gestiti tramite Supabase).</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold font-display">3. Finalità e Base Giuridica del Trattamento</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">I Dati dell'Utente sono raccolti per le seguenti finalità:</p>
            <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground list-disc pl-5">
              <li><strong className="text-foreground">Fornitura del Servizio:</strong> Calcolo algoritmico del metabolismo, generazione di piani pasto assistiti dall'Intelligenza Artificiale, monitoraggio dei progressi fisici e interazione con il coach. La base giuridica è l'esecuzione del contratto di cui l'Utente è parte.</li>
              <li><strong className="text-foreground">Trattamento di Dati Sensibili:</strong> L'elaborazione di metriche fisiche, allergie e parametri di salute avviene esclusivamente previo consenso esplicito dell'Utente, raccolto al momento dell'inserimento dei dati o in fase di registrazione.</li>
              <li><strong className="text-foreground">Gestione dei Pagamenti:</strong> Elaborare le transazioni per gli abbonamenti tramite Stripe.</li>
              <li><strong className="text-foreground">Comunicazioni di Servizio:</strong> Invio di notifiche push o email relative ad aggiornamenti del piano, check-in settimanali o scadenze di abbonamento.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold font-display">4. Modalità di Trattamento e Sicurezza</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Il Titolare adotta le opportune misure di sicurezza volte ad impedire l'accesso, la divulgazione, la modifica o la distruzione non autorizzata dei Dati Personali. Il trattamento viene effettuato mediante strumenti informatici e telematici. I dati sono salvati su database sicuri (Supabase) con protocolli di crittografia standard di settore.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold font-display">5. Condivisione dei Dati con Terze Parti (Responsabili del Trattamento)</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Per erogare il servizio, collaboriamo con partner tecnologici selezionati che agiscono come Responsabili del Trattamento:
            </p>
            <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground list-disc pl-5">
              <li><strong className="text-foreground">Supabase:</strong> Per l'autenticazione, la gestione del database e l'archiviazione delle foto di progresso.</li>
              <li><strong className="text-foreground">Stripe:</strong> Per l'elaborazione sicura dei pagamenti.</li>
              <li><strong className="text-foreground">Servizi di Intelligenza Artificiale (es. OpenAI/Anthropic):</strong> Utilizzati per l'analisi dei cibi e la generazione dei pasti. A questi servizi vengono inviati solo i dati strettamente necessari (macro, calorie, preferenze e allergie) in formato pseudo-anonimizzato, evitando di condividere l'identità diretta dell'utente laddove non necessario.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold font-display">6. Luogo del Trattamento</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              I Dati sono trattati presso le sedi operative del Titolare ed in ogni altro luogo in cui le parti coinvolte nel trattamento siano localizzate. I dati potrebbero essere trasferiti al di fuori dell'Unione Europea (es. verso server negli Stati Uniti da parte di Supabase o Stripe), garantendo l'adesione alle Clausole Contrattuali Standard approvate dalla Commissione Europea o ad altri meccanismi di tutela validi.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold font-display">7. Periodo di Conservazione dei Dati</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              I Dati sono trattati e conservati per il tempo richiesto dalle finalità per le quali sono stati raccolti. I dati legati all'account verranno conservati fino alla richiesta di cancellazione dell'account da parte dell'Utente, funzione accessibile direttamente dalle Impostazioni dell'app. I dati relativi alla fatturazione e ai pagamenti verranno conservati per il periodo previsto dagli obblighi di legge in materia fiscale e contabile.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold font-display">8. Diritti dell'Utente (GDPR)</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Gli Utenti possono esercitare determinati diritti in riferimento ai Dati trattati dal Titolare, in particolare:
            </p>
            <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground list-disc pl-5">
              <li>Revocare il consenso in ogni momento (ad esempio per l'uso di dati sanitari o notifiche push).</li>
              <li>Opporsi al trattamento dei propri Dati.</li>
              <li>Accedere ai propri Dati.</li>
              <li>Verificare e chiedere la rettifica.</li>
              <li>Ottenere la limitazione del trattamento.</li>
              <li>Ottenere la cancellazione o rimozione dei propri Dati Personali (Diritto all'Oblio). L'app è dotata di un pulsante automatizzato "Elimina Account" che rimuove permanentemente i log e i dati associati.</li>
              <li>Ricevere i propri Dati o farli trasferire ad altro titolare (Portabilità dei dati).</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold font-display">9. Come Esercitare i Diritti</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Per esercitare i diritti dell'Utente, è possibile indirizzare una richiesta agli estremi di contatto del Titolare indicati in questo documento. Le richieste sono depositate a titolo gratuito ed evase dal Titolare nel più breve tempo possibile, in ogni caso entro un mese.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold font-display">10. Modifiche a questa Privacy Policy</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Il Titolare del Trattamento si riserva il diritto di apportare modifiche alla presente Privacy Policy in qualunque momento dandone informazione agli Utenti su questa pagina e all'interno dell'Applicazione.
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}
