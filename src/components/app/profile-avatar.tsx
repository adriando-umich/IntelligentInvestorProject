"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/profiles";
import { cn } from "@/lib/utils";

export function ProfileAvatar({
  name,
  avatarUrl,
  size = "default",
  className,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  return (
    <Avatar size={size} className={className}>
      {avatarUrl ? (
        <AvatarImage
          src={avatarUrl}
          alt={`${name}'s avatar`}
          className="bg-slate-100"
        />
      ) : null}
      <AvatarFallback
        className={cn(
          "bg-slate-200 font-medium text-slate-700",
          size === "lg" ? "text-sm" : size === "sm" ? "text-[0.7rem]" : "text-xs"
        )}
      >
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
