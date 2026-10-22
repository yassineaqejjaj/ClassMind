import { Button } from "@/components/ui";
import { LogoMark } from "@/components/Logo";
import { userManager } from "@/services/auth";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-3xl bg-white p-10 text-center shadow-xl">
        <LogoMark size={56} />
        <h1 className="text-3xl font-bold tracking-tight">ClassMind</h1>
        <p className="text-balance text-base text-muted">
          Every student learns differently. Every teacher deserves to know how.
        </p>
        <Button className="w-full" onClick={() => userManager.signinRedirect()}>
          Se connecter
        </Button>
        <p className="text-xs text-muted">
          Connexion sécurisée via le service d'authentification de votre établissement.
        </p>
      </div>
    </main>
  );
}
