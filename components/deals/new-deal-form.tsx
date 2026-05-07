"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const newDealSchema = z.object({
  name: z.string().min(3, "Indiquez un nom d’opportunité."),
  clientCompanyName: z.string().min(2, "Indiquez l’entreprise cliente."),
  clientContactName: z.string().min(2, "Indiquez le contact principal."),
  clientEmail: z.string().email("Indiquez un email professionnel valide."),
  phone: z.string().optional(),
  transcript: z.string().min(20, "Ajoutez au moins quelques notes d’échange."),
  additionalContext: z.string().optional(),
  emailInstructions: z.string().optional(),
});

type NewDealFormValues = z.infer<typeof newDealSchema>;

const defaultValues: NewDealFormValues = {
  name: "",
  clientCompanyName: "",
  clientContactName: "",
  clientEmail: "",
  phone: "",
  transcript: "",
  additionalContext: "",
  emailInstructions: "",
};

export function NewDealForm() {
  const form = useForm<NewDealFormValues>({
    resolver: zodResolver(newDealSchema),
    defaultValues,
  });

  function onSubmit(values: NewDealFormValues) {
    toast.success("Opportunité créée.", {
      description: `${values.name} est prête pour le compte-rendu.`,
    });
    form.reset(defaultValues);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <section className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Informations principales</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Les éléments nécessaires pour créer l’espace de travail.
            </p>
          </div>
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom de l’opportunité</FormLabel>
                  <FormControl>
                    <Input placeholder="Réponse appel d’offres..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="clientCompanyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Entreprise cliente</FormLabel>
                  <FormControl>
                    <Input placeholder="Atelier, cabinet, agence..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="clientContactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact principal</FormLabel>
                  <FormControl>
                    <Input placeholder="Prénom Nom" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="clientEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email professionnel</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="contact@entreprise.fr"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Téléphone optionnel</FormLabel>
                  <FormControl>
                    <Input placeholder="+33 ..." {...field} />
                  </FormControl>
                  <FormDescription>
                    Utile pour garder le contexte commercial au même endroit.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <section className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Contexte commercial</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Notes, contraintes et consignes qui guideront la proposition.
            </p>
          </div>
          <div className="space-y-4 p-4">
            <FormField
              control={form.control}
              name="transcript"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Transcript ou notes d’appel</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={8}
                      placeholder="Collez ici les notes de découverte, points de douleur, contraintes, attentes et décisions évoquées..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="additionalContext"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contexte complémentaire</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder="Références à privilégier, ton attendu, points sensibles..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="emailInstructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instructions email</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Ton du message, points à mentionner, prochaine étape..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <div className="flex justify-end">
          <Button type="submit">Créer l’opportunité</Button>
        </div>
      </form>
    </Form>
  );
}
