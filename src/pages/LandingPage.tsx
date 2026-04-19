import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Activity, PieChart, Smartphone, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: "easeOut" as const },
};

const features = [
  {
    icon: Activity,
    title: "Motore Metabolico Adattivo",
    description:
      "Il tuo TDEE viene ricalcolato in tempo reale in base a peso, allenamenti e introito calorico, senza più stime statiche.",
  },
  {
    icon: PieChart,
    title: "Nutrizione Non-Lineare",
    description:
      "Strategie avanzate come Refeed, MATADOR e ciclizzazione dei macronutrienti, integrate nel tuo piano settimanale.",
  },
  {
    icon: Smartphone,
    title: "Check-in Intelligente",
    description:
      "Monitora sonno, stress, fame e performance. L'AI auto-regola il piano quando il biofeedback lo richiede.",
  },
];

const LandingPage = () => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Glow background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute top-1/2 -right-32 h-[420px] w-[420px] rounded-full bg-accent/40 blur-[120px]" />
        <div className="absolute bottom-0 -left-32 h-[420px] w-[420px] rounded-full bg-primary/10 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="container mx-auto flex items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight">NC Nutrition</span>
        </Link>
        <Link to="/login">
          <Button variant="ghost" className="font-medium">
            Accedi
          </Button>
        </Link>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-6 pt-16 pb-24 md:pt-24 md:pb-32">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Nutrizione adattiva potenziata dall'AI
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl"
          >
            Il Tuo Metabolismo,
            <br />
            <span className="text-gradient-primary">Decodificato.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl"
          >
            L'ecosistema nutrizionale adattivo che si evolve con il tuo corpo.
            Basato su AI, supportato dalla scienza.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Link to="/login?signup=true">
              <Button size="lg" className="glow-primary h-12 gap-2 px-8 text-base">
                Inizia Ora
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="ghost" className="h-12 px-6 text-base">
                Ho già un account
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-6 pb-28">
        <motion.div {...fadeUp} className="mx-auto mb-14 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            Costruito per chi prende sul serio i propri risultati
          </h2>
          <p className="mt-4 text-muted-foreground">
            Tre pilastri pensati per trasformare ogni dato in una decisione concreta.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, delay: idx * 0.1, ease: "easeOut" }}
                className="glass-card group relative rounded-2xl p-7 transition-all hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20 transition-colors group-hover:bg-primary/15">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display text-xl font-semibold tracking-tight">
                  {feature.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* CTA strip */}
      <section className="container mx-auto px-6 pb-28">
        <motion.div
          {...fadeUp}
          className="glass-card glow-primary relative overflow-hidden rounded-3xl px-8 py-14 text-center md:py-20"
        >
          <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
            Pronto a ridisegnare la tua nutrizione?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Inizia gratis. Il tuo piano si adatterà a te dal primo giorno.
          </p>
          <div className="mt-8">
            <Link to="/login?signup=true">
              <Button size="lg" className="h-12 gap-2 px-8 text-base">
                Crea il mio account
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground md:flex-row">
          <p>© {new Date().getFullYear()} NC Personal Trainer. Tutti i diritti riservati.</p>
          <nav className="flex items-center gap-6">
            <Link to="/privacy" className="transition-colors hover:text-foreground">
              Privacy
            </Link>
            <Link to="/terms" className="transition-colors hover:text-foreground">
              Termini
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
