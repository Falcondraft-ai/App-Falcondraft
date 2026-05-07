import { MockActionButton } from "@/components/common/mock-action-button";
import { PageTransition } from "@/components/common/page-transition";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { mockTeamMembers } from "@/data/mock-team";
import { formatDateTime } from "@/lib/format";

export default function TeamSettingsPage() {
  return (
    <PageTransition>
      <section className="rounded-lg border bg-card">
        <div className="flex flex-col justify-between gap-3 border-b px-4 py-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-semibold">Membres de l’équipe</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Rôles, invitations et disponibilité des membres de l’espace.
            </p>
          </div>
          <MockActionButton
            label="Inviter un membre"
            message="Invitation préparée."
            variant="default"
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Dernière activité</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockTeamMembers.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">{member.name}</TableCell>
                <TableCell>{member.email}</TableCell>
                <TableCell>{member.role}</TableCell>
                <TableCell>
                  <span className="rounded-md border bg-secondary px-2 py-1 text-xs">
                    {member.status}
                  </span>
                </TableCell>
                <TableCell>{formatDateTime(member.lastActiveAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </PageTransition>
  );
}
