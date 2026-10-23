"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { HttpError, toAuthFailure } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";

export type Profile = components["schemas"]["GetUserResponseDto"];

export const PROFILE_KEY = ["profile"] as const;

export function useProfileQuery() {
  return useQuery({
    queryKey: PROFILE_KEY,
    queryFn: async (): Promise<Profile> => {
      const { data, error, response } = await api.GET("/api/v1/users/me");
      if (!response.ok || !data?.data) {
        throw new HttpError(response.status, toAuthFailure(response.status, error).message);
      }
      return data.data;
    },
  });
}
