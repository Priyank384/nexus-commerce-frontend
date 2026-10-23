"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { HttpError, toAuthFailure } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";

export type AdminUser = components["schemas"]["GetUserResponseDto"];
export type AdminRole = NonNullable<AdminUser["role"]>;

export const ADMIN_USERS_KEY = ["admin", "users"] as const;
export const ADMIN_USERS_PAGE_SIZE = 20;

function failed(status: number, body: unknown): HttpError {
  return new HttpError(status, toAuthFailure(status, body).message);
}

export function useAdminUsers(page: number, keyword: string) {
  return useQuery({
    queryKey: [...ADMIN_USERS_KEY, page, keyword],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error, response } = await api.GET("/api/v1/admin/users", {
        params: {
          query: {
            page,
            size: ADMIN_USERS_PAGE_SIZE,
            q: keyword.trim() || undefined,
          },
        },
      });
      if (!response.ok || !data?.data) throw failed(response.status, error);
      return data.data;
    },
  });
}

export function useSetUserEnabled(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean): Promise<AdminUser> => {
      const { data, error, response } = await api.PATCH("/api/v1/admin/users/{id}", {
        params: { path: { id } },
        body: { enabled },
      });
      if (!response.ok || !data?.data) throw failed(response.status, error);
      return data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_USERS_KEY });
      void queryClient.invalidateQueries({ queryKey: ["admin", "metrics"] });
    },
  });
}
