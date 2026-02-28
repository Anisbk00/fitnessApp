"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import {
  User,
  Watch,
  Tag,
  Brain,
  Calculator,
  Users,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type ProvenanceSource =
  | "manual"
  | "device"
  | "label"
  | "model"
  | "estimated"
  | "community";

export interface ProvenanceTagProps {
  /** Source of the data */
  source: ProvenanceSource;
  /** Timestamp when the data was recorded or derived */
  timestamp: Date | string;
  /** Optional rationale explaining how the value was derived */
  rationale?: string;
  /** Device name for device sources */
  deviceName?: string;
  /** AI model name for model sources */
  modelName?: string;
  /** Additional CSS classes */
  className?: string;
}

const sourceConfig: Record<
  ProvenanceSource,
  {
    icon: React.ElementType;
    label: string;
    bgClass: string;
    darkBgClass: string;
    textClass: string;
    darkTextClass: string;
  }
> = {
  manual: {
    icon: User,
    label: "Manual Entry",
    bgClass: "bg-emerald-100",
    darkBgClass: "dark:bg-emerald-950/50",
    textClass: "text-emerald-700",
    darkTextClass: "dark:text-emerald-300",
  },
  device: {
    icon: Watch,
    label: "Device Sync",
    bgClass: "bg-blue-100",
    darkBgClass: "dark:bg-blue-950/50",
    textClass: "text-blue-700",
    darkTextClass: "dark:text-blue-300",
  },
  label: {
    icon: Tag,
    label: "Label",
    bgClass: "bg-purple-100",
    darkBgClass: "dark:bg-purple-950/50",
    textClass: "text-purple-700",
    darkTextClass: "dark:text-purple-300",
  },
  model: {
    icon: Brain,
    label: "AI Model",
    bgClass: "bg-amber-100",
    darkBgClass: "dark:bg-amber-950/50",
    textClass: "text-amber-700",
    darkTextClass: "dark:text-amber-300",
  },
  estimated: {
    icon: Calculator,
    label: "Estimated",
    bgClass: "bg-gray-100",
    darkBgClass: "dark:bg-gray-800/50",
    textClass: "text-gray-700",
    darkTextClass: "dark:text-gray-300",
  },
  community: {
    icon: Users,
    label: "Community",
    bgClass: "bg-rose-100",
    darkBgClass: "dark:bg-rose-950/50",
    textClass: "text-rose-700",
    darkTextClass: "dark:text-rose-300",
  },
};

/**
 * ProvenanceTag shows the source and origin of data with transparency.
 * Displays a small badge with an icon, and reveals full provenance details on hover.
 */
export function ProvenanceTag({
  source,
  timestamp,
  rationale,
  deviceName,
  modelName,
  className,
}: ProvenanceTagProps) {
  const config = sourceConfig[source];
  const Icon = config.icon;

  const parsedTimestamp =
    typeof timestamp === "string" ? new Date(timestamp) : timestamp;

  const relativeTime = formatDistanceToNow(parsedTimestamp, {
    addSuffix: true,
  });

  const formattedTimestamp = parsedTimestamp.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const getSourceDetail = () => {
    switch (source) {
      case "device":
        return deviceName ? `Device: ${deviceName}` : "Synced from device";
      case "model":
        return modelName ? `Model: ${modelName}` : "AI-generated estimate";
      case "community":
        return "Sourced from community data";
      case "estimated":
        return "Calculated estimate";
      case "label":
        return "User-applied label";
      case "manual":
        return "User-entered value";
      default:
        return config.label;
    }
  };

  const tooltipContent = (
    <div className="space-y-2 max-w-xs">
      <div className="flex items-center gap-2 font-medium">
        <Icon className="h-4 w-4" aria-hidden="true" />
        <span>{config.label}</span>
      </div>
      <div className="text-xs opacity-90">
        <p>{getSourceDetail()}</p>
        <p className="mt-1">
          Recorded: {formattedTimestamp} ({relativeTime})
        </p>
      </div>
      {rationale && (
        <div className="pt-2 border-t border-current/20">
          <p className="text-xs opacity-80">
            <span className="font-medium">How derived: </span>
            {rationale}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors cursor-default",
            config.bgClass,
            config.darkBgClass,
            config.textClass,
            config.darkTextClass,
            "hover:opacity-80",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
            className
          )}
          role="status"
          aria-label={`Data source: ${config.label}, recorded ${relativeTime}`}
        >
          <Icon className="h-3 w-3" aria-hidden="true" />
          <span className="sr-only">{config.label}</span>
          <span aria-hidden="true">
            {relativeTime.replace(/^about /, "")}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="bg-popover text-popover-foreground border shadow-lg"
      >
        {tooltipContent}
      </TooltipContent>
    </Tooltip>
  );
}

export default ProvenanceTag;
