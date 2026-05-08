import Link from "next/link";
import { BrandMark } from "@/components/common/brand-mark";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/96">
      <div className="mx-auto flex h-18 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <BrandMark href="/" size="md" showDescriptor={false} />
        <nav className="flex items-center">
          <Button asChild>
            <Link href="/login">Accéder à l’espace client</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
