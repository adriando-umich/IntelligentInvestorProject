"use client";

import type { ReactNode } from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

type ToolbarOption = {
  value: string;
  label: string;
};

type ToolbarFilter = {
  key: string;
  label: string;
  value: string;
  options: ToolbarOption[];
  onValueChange: (value: string) => void;
};

export function TableToolbar({
  searchLabel,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filters = [],
  resultLabel,
  className,
}: {
  searchLabel: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  filters?: ToolbarFilter[];
  resultLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.65rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,252,0.88))] px-4 py-4 shadow-[0_18px_54px_-42px_rgba(15,23,42,0.22)] backdrop-blur",
        className
      )}
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <label className="flex-1 space-y-2">
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
            {searchLabel}
          </span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              className="flex h-11 w-full rounded-[1.1rem] border border-slate-200/80 bg-white/90 px-3 pl-10 text-sm text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-3 focus:ring-emerald-100"
            />
          </div>
        </label>

        {filters.map((filter) => (
          <label key={filter.key} className="space-y-2 xl:min-w-[180px]">
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              {filter.label}
            </span>
            <select
              value={filter.value}
              onChange={(event) => filter.onValueChange(event.target.value)}
              className="flex h-11 w-full rounded-[1.1rem] border border-slate-200/80 bg-white/90 px-3 text-sm text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-3 focus:ring-emerald-100"
            >
              {filter.options.map((option) => (
                <option key={`${filter.key}-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {resultLabel ? (
        <p className="mt-3 text-xs text-slate-500">{resultLabel}</p>
      ) : null}
    </div>
  );
}

export function TableSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[1.65rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,255,255,0.9))] shadow-[0_22px_60px_-42px_rgba(15,23,42,0.24)]",
        className
      )}
    >
      {children}
    </div>
  );
}
