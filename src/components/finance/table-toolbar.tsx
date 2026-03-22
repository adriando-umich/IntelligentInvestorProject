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
        "rounded-[1.5rem] border border-slate-200/80 bg-slate-50/90 px-4 py-4",
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
              className="flex h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 pl-10 text-sm text-slate-950 outline-none transition focus:border-teal-300"
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
              className="flex h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-300"
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
        "overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white/80",
        className
      )}
    >
      {children}
    </div>
  );
}
