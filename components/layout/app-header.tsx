import Link from "next/link";
import { BrandMark } from "@/components/common/brand-mark";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <BrandMark href="/" size="sm" showDescriptor={false} />
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/login">Connexion</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard">Espace client</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
