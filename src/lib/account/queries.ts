"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { HttpError, toAuthFailure } from "@/lib/api/errors";
import { signInWith } from "@/lib/auth/sign-in";
import type { components } from "@/lib/api/schema";
import type { ChangePasswordValues } from "@/lib/validation/account";

export type Profile = components["schemas"]["GetUserResponseDto"];
export type UpdateProfile = components["schemas"]["UpdateProfileRequestDto"];

export const PROFILE_KEY = ["profile"] as const;

function failed(status: number, body: unknown): HttpError {
  return new HttpError(status, toAuthFailure(status, body).message);
}

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

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateProfile): Promise<Profile> => {
      const { data, error, response } = await api.PATCH("/api/v1/users/me", { body });
      if (!response.ok || !data?.data) throw failed(response.status, error);
      return data.data;
    },
    // The header greets the shopper by name, so the row is written straight into the store
    // rather than waited on: a saved name should be visible before the refetch lands.
    onSuccess: (profile) => {
      queryClient.setQueryData<Profile>(PROFILE_KEY, profile);
      void queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
    },
  });
}

/**
 * Changes the account password and keeps this browser signed in.
 *
 * Resolves with whether the session survived. The endpoint revokes every refresh token the
 * account holds so a stolen credential cannot outlive the password, and that includes this
 * one, so the caller has to treat `false` as "sign in again" rather than "nothing happened".
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: async ({
      email,
      currentPassword,
      newPassword,
    }: ChangePasswordValues & { email: string }): Promise<boolean> => {
      const { error, response } = await api.POST("/api/v1/users/me/password", {
        body: { currentPassword, newPassword },
      });
      if (!response.ok) throw failed(response.status, error);
      return signInWith(email, newPassword);
    },
  });
}
