
L'utente non riesce a trovare la sezione Workspace Settings → Build Secrets. Devo darle istruzioni chiare per trovarla, considerando sia desktop sia mobile, e proporre un'alternativa nel caso non sia disponibile nel suo piano.

## Diagnosi

Per accedere ai **Build Secrets** servono i Workspace Settings (separati dai Project Settings):

**Desktop:**
1. Clicca sul tuo **avatar in alto a destra** dell'editor (NON il nome del progetto in alto a sinistra)
2. Nel menu apparirà **Workspace settings**
3. All'interno cerca la scheda **Build Secrets**

**Mobile:**
1. Tap sul tuo **avatar in basso** nella sidebar
2. Tap **Workspace settings**
3. Scheda **Build Secrets**

**Scorciatoia desktop:** Cmd+K (Mac) o Ctrl+K (Win) → digita "build secrets" → invio.

## Possibili cause se non la trovi

1. **Piano insufficiente** — i Build Secrets potrebbero essere riservati a piani Pro/Business/Enterprise.
2. **Confusione con Project Settings** — i Project Settings (raggiungibili dal nome progetto in alto a sx) NON contengono i Build Secrets.
3. **Confusione con Cloud Secrets** — il pannello Cloud → Secrets (quello dello screenshot precedente) sono **runtime secret**, diversi.

## Piano alternativo (se Build Secrets non disponibili)

Refactor per eliminare la dipendenza da `import.meta.env.VITE_VAPID_PUBLIC_KEY`:

1. **Creare nuova edge function `get-vapid-public-key`** che legge `VAPID_PUBLIC_KEY` (runtime secret già configurato) e lo restituisce. Pubblica, no autenticazione necessaria (la chiave pubblica è... pubblica).
2. **Modificare `PushNotificationManager.tsx`**: invece di leggere da `import.meta.env`, fa una `supabase.functions.invoke('get-vapid-public-key')` al click di "Attiva Notifiche" e usa il valore restituito come `applicationServerKey`.
3. Rimuovere la necessità del Build Secret.

**Vantaggio:** funziona su qualsiasi piano, nessuna config manuale aggiuntiva, la chiave viene gestita centralmente come gli altri VAPID secret.

**Svantaggio minimo:** una chiamata HTTP extra al primo click su "Attiva Notifiche" (~100ms, irrilevante).

## Domanda all'utente

Prima di procedere, chiedo se vuole tentare ancora di trovare i Build Secrets o passare direttamente all'alternativa via edge function.
