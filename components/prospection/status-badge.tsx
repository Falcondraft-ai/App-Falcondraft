"use client";

import * as React from "react";
import { useI18n } from "@/components/i18n/language-provider";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TranslationKey } from "@/lib/i18n/translations";

type StatusConfig = {
  label: TranslationKey;
  className: string;
};

const statusConfig: Record<string, StatusConfig> = {
  new: {
    label: "prospection.status.toCall",
    className:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  },
  to_call: {
    label: "prospection.status.toCall",
    className:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  },
  called: {
    label: "prospection.status.called",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  },
  no_answer: {
    label: "prospection.status.noAnswer",
    className:
      "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700",
  },
  to_follow_up: {
    label: "prospection.status.toFollowUp",
    className:
      "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
  },
  interested: {
    label: "prospection.status.interested",
    className:
      "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
  },
  meeting_booked: {
    label: "prospection.status.meetingBooked",
    className:
      "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800",
  },
  not_interested: {
    label: "prospection.status.notInterested",
    className:
      "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
  },
  bad_fit: {
    label: "prospection.status.badFit",
    className:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  },
  do_not_contact: {
    label: "prospection.status.doNotContact",
    className:
      "bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
  },
  client: {
    label: "prospection.status.client",
    className:
      "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800",
  },
  archived: {
    label: "prospection.status.archived",
    className:
      "bg-zinc-50 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  },
};

const defaultConfig: StatusConfig = {
  label: "prospection.status.new",
  className:
    "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
};

const selectableStatuses = Object.keys(statusConfig).filter(
  (status) => status !== "new",
);

export function ProspectionStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const { t } = useI18n();
  const config = statusConfig[status] ?? defaultConfig;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-5",
        config.className,
        className,
      )}
    >
      {t(config.label)}
    </span>
  );
}

export function ProspectionStatusDropdown({
  status,
  onStatusChange,
  disabled,
}: {
  status: string;
  onStatusChange: (newStatus: string) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const config = statusConfig[status] ?? defaultConfig;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={disabled}
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-5 cursor-pointer hover:opacity-80 transition-opacity whitespace-nowrap disabled:opacity-50 disabled:cursor-default",
            config.className,
          )}
        >
          {t(config.label)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {selectableStatuses.map((s) => {
          const cfg = statusConfig[s] ?? defaultConfig;
          return (
            <DropdownMenuItem
              key={s}
              onClick={() => onStatusChange(s)}
              disabled={s === status}
            >
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-5",
                  cfg.className,
                )}
              >
                {t(cfg.label)}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
