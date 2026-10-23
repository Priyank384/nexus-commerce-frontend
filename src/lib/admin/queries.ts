"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { HttpError, toAuthFailure } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";

export type AdminMetrics = components["schemas"]["AdminMetricsResponseDto"];

export const ADMIN_METRICS_KEY = ["admin", "metrics"] as const;

export function useAdminMetrics() {
  return useQuery({
    queryKey: ADMIN_METRICS_KEY,
    queryFn: async (): Promise<AdminMetrics> => {
      const { data, error, response } = await api.GET("/api/v1/admin/metrics");
      if (!response.ok || !data?.data) {
        throw new HttpError(response.status, toAuthFailure(response.status, error).message);
      }
      return data.data;
    },
  });
}
