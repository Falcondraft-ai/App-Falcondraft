import { MoreHorizontal } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dashboardPreviewRows } from "@/data/foundation";

export default function DashboardPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <Badge variant="secondary" className="mb-4">
              Dashboard placeholder
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">
              Pilotage commercial
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Une page minimale pour vérifier le socle UI. Les écrans métier
              seront conçus à l’étape suivante.
            </p>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Voir le périmètre</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Step 1 uniquement</SheetTitle>
                <SheetDescription>
                  Cette base prépare les composants, les routes minimales et les
                  intégrations futures sans construire le produit complet.
                </SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
        </div>

        <Tabs defaultValue="deals" className="space-y-6">
          <TabsList>
            <TabsTrigger value="deals">Deals</TabsTrigger>
            <TabsTrigger value="status">Statut</TabsTrigger>
          </TabsList>

          <TabsContent value="deals">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>Pipeline de démonstration</CardTitle>
                  <CardDescription>
                    Données fictives, sans connexion externe.
                  </CardDescription>
                </div>
                <Avatar>
                  <AvatarFallback>FD</AvatarFallback>
                </Avatar>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Deal</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Responsable</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboardPreviewRows.map((row) => (
                      <TableRow key={row.deal}>
                        <TableCell className="font-medium">
                          {row.deal}
                        </TableCell>
                        <TableCell>{row.status}</TableCell>
                        <TableCell>{row.owner}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Options"
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem disabled>
                                Action future
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="status">
            <Card>
              <CardHeader>
                <CardTitle>Fondation technique</CardTitle>
                <CardDescription>
                  Les principaux blocs sont installés et prêts à être connectés.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <Progress value={72} />
                <Separator />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Skeleton className="h-20 rounded-2xl" />
                  <Skeleton className="h-20 rounded-2xl" />
                  <Skeleton className="h-20 rounded-2xl" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}
