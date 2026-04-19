
## Phase 83: GDPR Cookie Consent Banner

### 1. Create `src/components/CookieBanner.tsx`
- Fixed-bottom banner (z-50, glass-card styling, responsive layout).
- Reads `localStorage.getItem("cookie_consent")` on mount; hides if present.
- Three buttons: **Rifiuta** (saves `"rejected"`), **Personalizza** (opens a Dialog with toggles for "Tecnici" — locked on — and "Analitici/Pagamenti"), **Accetta tutto** (saves `"accepted"`).
- "Personalizza" Dialog: switches per categoria, "Salva preferenze" button → saves JSON `{technical:true, payments:bool}` as `cookie_consent`.
- Testo italiano con link inline a `/privacy` (usa `react-router-dom` `Link`).
- Tutto tematizzato con token semantici (`bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, `bg-primary`).

### 2. Integrate in `src/App.tsx`
- Importa `CookieBanner` e renderizzalo a livello root all'interno del provider tree (dopo `<Toaster />`, fuori dalle Routes) così appare ovunque.

### 3. Policy Update
I dati reali del Titolare (Nicolò Castello, Via Fratelli Cervi 8 Bagnoli di Sopra, nctrainingsystems@gmail.com) sono **già stati inseriti** in Privacy.tsx (sez. 1) e Terms.tsx (sez. 6) nella fase precedente. Non ci sono placeholder residui — quindi questo punto è già completo e lo segnalerò senza ulteriori modifiche, a meno che tu voglia aggiungere una nuova sezione "Cookie Policy" dedicata in Privacy.tsx.

**Proposta extra (consigliata):** aggiungo una breve sezione "6. Cookie" in `Privacy.tsx` che spiega le categorie (tecnici necessari + Stripe per pagamenti) e rimanda al banner per modificare le preferenze. Questo allinea la policy al banner ed è richiesto da GDPR/ePrivacy.

### File da modificare
1. **NEW** `src/components/CookieBanner.tsx`
2. `src/App.tsx` — montare il banner globalmente
3. `src/pages/Privacy.tsx` — aggiungere sezione "Cookie"

### Note tecniche
- Nessun cookie reale viene installato dall'app stessa; il consenso è registrato solo in `localStorage` (no third-party tracker da bloccare). Stripe carica i propri cookie solo quando l'utente apre il checkout, quindi il consenso "payments" è informativo.
- Nessuna nuova dipendenza necessaria (uso `Dialog`, `Switch`, `Button` shadcn già presenti).
