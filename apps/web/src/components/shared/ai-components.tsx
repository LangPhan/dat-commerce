"use client";
import {
  Check,
  CircleAlert,
  Clock3,
  Cpu,
  LoaderCircle,
  Sparkles,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/format";
import {
  AI_MODELS,
  type AIModelId,
  type RecordChange,
  type ToolStep,
  type TurnStatus,
} from "@/types/ai";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const modelItems = AI_MODELS.map((model) => ({
  value: model.id,
  label: `${model.label} (${model.provider})`,
}));

export function ModelSelector({
  value,
  onChange,
  compact = false,
}: {
  value: AIModelId;
  onChange: (next: AIModelId) => void;
  compact?: boolean;
}) {
  const current = AI_MODELS.find((m) => m.id === value) || AI_MODELS[0];
  return (
    <div className={cn("model-selector", compact && "compact")}>
      <Cpu size={13} aria-hidden="true" />
      <Select
        items={modelItems}
        value={current.id}
        onValueChange={(next) => {
          if (next) onChange(next as AIModelId);
        }}
      >
        <SelectTrigger
          aria-label="Select AI model"
          size="sm"
          className="model-selector-trigger"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {modelItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ToolExecutionTimeline({
  steps,
  status,
  activeStepIndex,
}: {
  steps: ToolStep[];
  status?: TurnStatus | "Running";
  activeStepIndex?: number;
}) {
  return (
    <ol className="tool-timeline">
      {steps.map((step, index) => {
        const isRunning =
          status === "Running" && activeStepIndex === index;
        const isPending =
          status === "Running" &&
          activeStepIndex !== undefined &&
          index > activeStepIndex;
        const isDone =
          status === "Completed" ||
          (status === "Running" &&
            activeStepIndex !== undefined &&
            index < activeStepIndex) ||
          (status === "Pending" && step.status === "completed");

        const Icon = isRunning
          ? LoaderCircle
          : isDone
            ? Check
            : status === "Failed" || status === "Canceled"
              ? CircleAlert
              : Clock3;

        return (
          <li
            key={step.id}
            className={cn(
              isRunning && "step-running",
              isDone && "step-done",
              isPending && "step-pending"
            )}
          >
            <span className="step-icon">
              <Icon size={13} className={isRunning ? "spin" : undefined} />
            </span>
            <div className="step-body">
              <div className="step-head">
                <strong>{step.label}</strong>
                <code className="tool-code">
                  <Wrench size={10} /> {step.tool}
                </code>
              </div>
              <span className="step-detail">{step.detail}</span>
            </div>
            <div className="step-meta">
              <Badge tone={isDone ? "green" : isRunning ? "accent" : "neutral"}>
                {step.records} {step.records === 1 ? "record" : "records"}
              </Badge>
              <small>{step.durationMs} ms</small>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function ChangeDiffTable({ changes }: { changes: RecordChange[] }) {
  return (
    <div className="table-scroll diff-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Record</th>
            <th>Before</th>
            <th>After</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((change, index) => (
            <tr key={change.name + index}>
              <td>
                <strong>{change.name}</strong>
              </td>
              <td className="diff-before">{change.before}</td>
              <td className="diff-after">
                <strong>{change.after}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AIAvatarBadge() {
  return (
    <span className="assistant-icon" aria-hidden="true">
      <Sparkles size={14} />
    </span>
  );
}
