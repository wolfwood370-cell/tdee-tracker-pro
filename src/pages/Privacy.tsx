import { useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto py-12 px-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-8"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Torna indietro
        </Button>

        <div className="text-center space-y-4 mb-12">
          <h1 className="text-4xl font-bold font-display">
            Documenti Legali
          </h1>
          <p className="text-muted-foreground">
            Consulta la nostra Privacy Policy e Cookie Policy. I documenti si
            apriranno in una finestra dedicata gestita da Iubenda.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a
            href="https://www.iubenda.com/privacy-policy/84645274"
            className="iubenda-white iubenda-noiframe iubenda-embed inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-card border border-border hover:bg-accent transition-colors text-foreground font-medium"
            title="Privacy Policy"
          >
            Privacy Policy
            <ExternalLink className="h-4 w-4" />
          </a>

          <a
            href="https://www.iubenda.com/privacy-policy/84645274/cookie-policy"
            className="iubenda-white iubenda-noiframe iubenda-embed inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-card border border-border hover:bg-accent transition-colors text-foreground font-medium"
            title="Cookie Policy"
          >
            Cookie Policy
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-12">
          Titolare del trattamento: Nicolò Castello — Via Fratelli Cervi 8,
          Bagnoli di Sopra (PD) —{" "}
          <a
            href="mailto:nctrainingsystems@gmail.com"
            className="text-primary hover:underline"
          >
            nctrainingsystems@gmail.com
          </a>
        </p>
      </div>
    </div>
  );
}
