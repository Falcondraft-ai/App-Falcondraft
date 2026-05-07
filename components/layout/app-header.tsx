import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  return (
    <header className="border-border/70 bg-background/80 sticky top-0 z-40 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-xl font-semibold tracking-tight">
            FD
          </span>
          <span className="text-sm font-semibold tracking-tight">
            FalconDraft
          </span>
          <Badge variant="secondary" className="hidden sm:inline-flex">
            Step 1
          </Badge>
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/login">Connexion</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
