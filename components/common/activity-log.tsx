import type { ActivityEvent } from "@/data/mock-activity";
import { formatDateTime } from "@/lib/format";

export function ActivityLog({ items }: { items: ActivityEvent[] }) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Aucune activité récente pour cette opportunité.
      </p>
    );
  }

  return (
    <ol className="divide-y">
      {items.map((item) => (
        <li key={item.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-muted-foreground mt-1 text-sm leading-5">
                {item.description}
              </p>
            </div>
            <time className="text-muted-foreground shrink-0 text-xs">
              {formatDateTime(item.createdAt)}
            </time>
          </div>
          <p className="text-muted-foreground mt-2 text-xs">{item.actorName}</p>
        </li>
      ))}
    </ol>
  );
}
