import Link from "next/link";
import { AppHeader } from "@/components/layout/app-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default function LoginPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
        <Card className="shadow-primary/5 shadow-2xl">
          <CardHeader>
            <CardTitle>
              <h1 className="text-2xl">Connexion</h1>
            </CardTitle>
            <CardDescription>
              Interface minimale pour valider le socle d’authentification futur.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Alert>
              <AlertTitle>Authentification prête à connecter</AlertTitle>
              <AlertDescription>
                Les champs sont volontairement inactifs pour cette première
                étape.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="email">Email professionnel</Label>
              <Input
                id="email"
                type="email"
                placeholder="vous@entreprise.com"
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                disabled
              />
            </div>
          </CardContent>
          <Separator />
          <CardFooter className="flex flex-col gap-3 pt-6 sm:flex-row">
            <Button className="w-full" disabled>
              Connexion bientôt disponible
            </Button>
            <Button asChild className="w-full" variant="outline">
              <Link href="/">Retour</Link>
            </Button>
          </CardFooter>
        </Card>
      </main>
    </>
  );
}
