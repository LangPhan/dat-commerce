"use client";

import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/format";

export function Suggestions({
  items,
  onSelect,
  compact = false,
  className,
}: {
  items: string[];
  onSelect: (text: string) => void;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("ai-el-suggestions", compact && "compact", className)}>
      {items.map((text) => (
        <button
          key={text}
          type="button"
          className="ai-el-suggestion-btn"
          onClick={() => onSelect(text)}
        >
          <span>{text}</span>
          <ArrowUpRight size={12} />
        </button>
      ))}
    </div>
  );
}
