import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Activity, ArrowRight, Lock, Mail, User } from "lucide-react";
import { Link } from "react-router-dom";

type AuthView = "login" | "register" | "recovery";

const AuthPage = () => {
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<AuthView>(searchParams.get("signup") === "true" ? "register" : "login");

  useEffect(() => {
    if (searchParams.get("signup") === "true") setView("register");
  }, [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptHealth, setAcceptHealth] = useState(false);
  const [acceptMarketing, setAcceptMarketing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ title: "Errore di accesso", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Bentornato!", description: "Accesso effettuato con successo." });
    }
    setIsSubmitting(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptTerms || !acceptHealth) {
      toast({
        title: "Consensi obbligatori",
        description: "Devi accettare i Termini e il consenso al trattamento dei dati sanitari.",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      const msg = error.message?.toLowerCase().includes("already registered")
        ? "Questa email è già registrata. Prova ad accedere oppure usa 'Password dimenticata' per recuperare il tuo account."
        : error.message;
      toast({ title: "Errore di registrazione", description: msg, variant: "destructive" });
    } else {
      // Persist consents on the freshly-created profile (handle_new_user trigger has just inserted it)
      if (data.user?.id) {
        await supabase
          .from("profiles")
          .update({
            terms_accepted: true,
            health_data_consent: true,
            marketing_consent: acceptMarketing,
          })
          .eq("id", data.user.id);
      }
      toast({ title: "Account creato!", description: "Controlla la tua email (anche nello spam) per la verifica." });
      setView("login");
    }
    setIsSubmitting(false);
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Email di recupero inviata", description: "Controlla la tua casella per le istruzioni di reset." });
      setView("login");
    }
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Pannello sinistro - branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-display font-bold text-foreground">NC Nutrition</h1>
          </div>
          <p className="text-muted-foreground text-sm">by NC Personal Trainer</p>
        </div>
        <div className="relative z-10 space-y-6">
          <h2 className="text-4xl font-display font-bold leading-tight text-foreground">
            Il tuo motore<br />
            <span className="text-gradient-primary">nutrizionale.</span>
          </h2>
          <p className="text-muted-foreground max-w-md leading-relaxed">
            Accedi per tracciare i tuoi progressi e ricevere i tuoi target nutrizionali personalizzati.
          </p>
        </div>
        <div className="relative z-10">
          <p className="text-xs text-muted-foreground">© 2026 NC Personal Trainer. Tutti i diritti riservati.</p>
        </div>
      </div>

      {/* Pannello destro - form di autenticazione */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          {/* Logo mobile */}
          <div className="lg:hidden flex items-center gap-3 justify-center mb-8">
            <Activity className="h-7 w-7 text-primary" />
            <h1 className="text-xl font-display font-bold text-foreground">NC Nutrition</h1>
          </div>

          {view === "recovery" ? (
            <Card className="glass-card border-border">
              <CardHeader className="space-y-1">
                <CardTitle className="text-xl font-display">Reimposta Password</CardTitle>
                <CardDescription>Inserisci la tua email per ricevere un link di reset</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRecovery} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="recovery-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="recovery-email"
                        type="email"
                        placeholder="tu@esempio.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 bg-secondary border-border"
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? "Invio in corso..." : "Invia Link di Reset"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-muted-foreground"
                    onClick={() => setView("login")}
                  >
                    Torna al Login
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Tabs value={view} onValueChange={(v) => setView(v as AuthView)} className="space-y-6">
              <TabsList className="grid w-full grid-cols-2 bg-secondary">
                <TabsTrigger value="login">Accedi</TabsTrigger>
                <TabsTrigger value="register">Registrati</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <Card className="glass-card border-border">
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-xl font-display">Bentornato</CardTitle>
                    <CardDescription>Inserisci le tue credenziali per continuare</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="login-email">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="login-email"
                            type="email"
                            placeholder="tu@esempio.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="pl-10 bg-secondary border-border"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="login-password">Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="login-password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="pl-10 bg-secondary border-border"
                            required
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setView("recovery")}
                          className="text-xs text-primary hover:underline"
                        >
                          Password dimenticata?
                        </button>
                      </div>
                      <Button type="submit" className="w-full group" disabled={isSubmitting}>
                        {isSubmitting ? "Accesso in corso..." : (
                          <span className="flex items-center gap-2">
                            Accedi <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                          </span>
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="register">
                <Card className="glass-card border-border">
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-xl font-display">Crea un account</CardTitle>
                    <CardDescription>Inizia a monitorare i tuoi progressi con NC Nutrition</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleRegister} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="reg-name">Nome Completo</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="reg-name"
                            type="text"
                            placeholder="Mario Rossi"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="pl-10 bg-secondary border-border"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reg-email">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="reg-email"
                            type="email"
                            placeholder="tu@esempio.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="pl-10 bg-secondary border-border"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reg-password">Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="reg-password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="pl-10 bg-secondary border-border"
                            required
                            minLength={6}
                          />
                        </div>
                      </div>
                      <div className="space-y-3 pt-1">
                        <div className="flex items-start gap-2.5">
                          <Checkbox
                            id="reg-terms"
                            checked={acceptTerms}
                            onCheckedChange={(v) => setAcceptTerms(v === true)}
                            className="mt-0.5"
                          />
                          <Label htmlFor="reg-terms" className="text-xs leading-relaxed cursor-pointer text-muted-foreground">
                            Accetto i{" "}
                            <Link to="/terms" className="text-primary hover:underline">
                              Termini e Condizioni
                            </Link>{" "}
                            e la{" "}
                            <Link to="/privacy" className="text-primary hover:underline">
                              Privacy Policy
                            </Link>
                            . <span className="text-destructive">*</span>
                          </Label>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <Checkbox
                            id="reg-health"
                            checked={acceptHealth}
                            onCheckedChange={(v) => setAcceptHealth(v === true)}
                            className="mt-0.5"
                          />
                          <Label htmlFor="reg-health" className="text-xs leading-relaxed cursor-pointer text-muted-foreground">
                            Consento al trattamento dei miei dati sanitari e biometrici
                            (peso, macro, biofeedback) per le finalità del servizio.{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <Checkbox
                            id="reg-marketing"
                            checked={acceptMarketing}
                            onCheckedChange={(v) => setAcceptMarketing(v === true)}
                            className="mt-0.5"
                          />
                          <Label htmlFor="reg-marketing" className="text-xs leading-relaxed cursor-pointer text-muted-foreground">
                            Voglio ricevere aggiornamenti e consigli via email (opzionale).
                          </Label>
                        </div>
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={isSubmitting || !acceptTerms || !acceptHealth}
                      >
                        {isSubmitting ? "Creazione account..." : "Crea Account"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
