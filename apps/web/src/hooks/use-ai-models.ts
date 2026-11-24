"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { aiAdminApi } from "@/lib/cms-ai-api";
import { AI_MODELS, type AIModel, type AIModelId } from "@/types/ai";

export function useAiModels() {
  const { hasPermission } = useAuth();
  const canUseAi = hasPermission("ai:use");

  const query = useQuery({
    queryKey: ["admin-ai-settings"],
    queryFn: () => aiAdminApi.getSettings(),
    enabled: canUseAi,
    staleTime: 30_000,
  });

  const models = useMemo<AIModel[]>(() => {
    const data = query.data;
    if (!data || !data.enabledModelIds.length) {
      return AI_MODELS;
    }
    const byId = new Map(data.availableModels.map((m) => [m.id, m]));
    return data.enabledModelIds.map((id, idx) => {
      const info = byId.get(id);
      return {
        id,
        label: info?.label || id,
        provider: info?.ownedBy || "9Router",
        badge: idx === 0 ? "Default" : info?.reasoning ? "Reasoning" : "Active",
        contextLength: info?.contextLength ?? null,
        maxOutputTokens: info?.maxOutputTokens ?? null,
        vision: info?.vision ?? false,
        tools: info?.tools ?? true,
        reasoning: info?.reasoning ?? false,
      };
    });
  }, [query.data]);

  const defaultModelId: AIModelId =
    query.data?.defaultModelId || models[0]?.id || "gpt-6-luna";

  return {
    models,
    defaultModelId,
    settings: query.data,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
