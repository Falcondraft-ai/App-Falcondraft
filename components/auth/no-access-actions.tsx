"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function NoAccessActions() {
  const router = useRouter();

  async function signOut() {
    const supabase = getSupabaseBrowserClient();

    if (supabase) {
      await supabase.auth.signOut();
    }

    toast.success("Session fermée.");
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button type="button" className="w-full" size="lg" onClick={signOut}>
      Se déconnecter
    </Button>
  );
}
