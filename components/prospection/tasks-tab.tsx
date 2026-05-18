"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { T } from "@/components/i18n/translated-text";
import { Button } from "@/components/ui/button";
import type { ProspectTaskRow } from "@/types/database";

type ProspectTaskWithCompany = ProspectTaskRow & {
  company_name?: string | null;
};

function formatDate(value: string | null): string {
  if (!value) return "\u2013";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const taskTypeLabels: Record<string, string> = {
  call: "Appel",
  email: "Email",
  follow_up: "Relance",
  meeting: "RDV",
  qualification: "Qualification",
};

export function TasksTab({
  initialTasks,
}: {
  initialTasks: ProspectTaskWithCompany[];
}) {
  const [tasks, setTasks] = React.useState(initialTasks);
  const [updating, setUpdating] = React.useState<string | null>(null);

  async function markDone(taskId: string) {
    setUpdating(taskId);
    try {
      const res = await fetch("/api/prospection/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: taskId, action: "mark_task_done" }),
      });

      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, status: "done" } : t,
          ),
        );
      }
    } catch {
      // silently fail
    } finally {
      setUpdating(null);
    }
  }

  const pendingTasks = tasks.filter(
    (t) => t.status !== "done" && t.status !== "cancelled",
  );
  const doneTasks = tasks.filter((t) => t.status === "done");

  if (initialTasks.length === 0) {
    return (
      <section className="bg-card/75 rounded-lg border p-8 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          <T tx="prospection.empty.tasks" />
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Les tâches de prospection sont créées automatiquement par les
          workflows n8n.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {pendingTasks.length > 0 && (
        <div className="bg-card rounded-lg border overflow-hidden">
          <div className="border-b bg-muted/40 px-4 py-3">
            <span className="text-sm font-medium text-muted-foreground">
              {pendingTasks.length} tâche{pendingTasks.length > 1 ? "s" : ""}{" "}
              en cours
            </span>
          </div>
          <div className="divide-y">
            {pendingTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
              >
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="mt-0.5 shrink-0"
                  disabled={updating === task.id}
                  onClick={() => markDone(task.id)}
                >
                  <Check className="size-3.5" />
                </Button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{task.title}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                    {task.company_name && (
                      <span>{task.company_name}</span>
                    )}
                    {task.type && (
                      <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                        {taskTypeLabels[task.type] ?? task.type}
                      </span>
                    )}
                    {task.due_at && (
                      <span>{formatDate(task.due_at)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {doneTasks.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors select-none">
            {doneTasks.length} tâche{doneTasks.length > 1 ? "s" : ""}{" "}
            terminée{doneTasks.length > 1 ? "s" : ""}
          </summary>
          <div className="mt-3 bg-card rounded-lg border overflow-hidden">
            <div className="divide-y">
              {doneTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start gap-3 px-4 py-3 opacity-60"
                >
                  <div className="mt-0.5 shrink-0 rounded border p-1 text-emerald-600">
                    <Check className="size-3" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm line-through">{task.title}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                      {task.company_name && (
                        <span>{task.company_name}</span>
                      )}
                      {task.type && (
                        <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                          {taskTypeLabels[task.type] ?? task.type}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
