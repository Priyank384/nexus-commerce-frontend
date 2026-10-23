"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { HttpError, toAuthFailure } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";

export type Address = components["schemas"]["GetAddressResponseDto"];
export type SaveAddress = components["schemas"]["SaveAddressRequestDto"];

export const ADDRESSES_KEY = ["addresses"] as const;

function failed(status: number, body: unknown): HttpError {
  return new HttpError(status, toAuthFailure(status, body).message);
}

export function useAddressesQuery() {
  return useQuery({
    queryKey: ADDRESSES_KEY,
    queryFn: async (): Promise<Address[]> => {
      const { data, error, response } = await api.GET("/api/v1/addresses");
      if (!response.ok || !data?.data) throw failed(response.status, error);
      return data.data;
    },
  });
}

export function useCreateAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: SaveAddress) => {
      const { data, error, response } = await api.POST("/api/v1/addresses", { body });
      if (!response.ok || !data?.data) throw failed(response.status, error);
      return data.data;
    },
    onSuccess: (created) => {
      // Appending before the refetch lands keeps the payment review from flashing an empty
      // address right after the shopper saves one.
      queryClient.setQueryData<Address[]>(ADDRESSES_KEY, (current) =>
        current ? [...current, created] : [created],
      );
      void queryClient.invalidateQueries({ queryKey: ADDRESSES_KEY });
    },
  });
}

export function useUpdateAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: SaveAddress }) => {
      const { data, error, response } = await api.PUT("/api/v1/addresses/{id}", {
        params: { path: { id } },
        body,
      });
      if (!response.ok || !data?.data) throw failed(response.status, error);
      return data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADDRESSES_KEY }),
  });
}

export function useDeleteAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error, response } = await api.DELETE("/api/v1/addresses/{id}", {
        params: { path: { id } },
      });
      if (!response.ok) throw failed(response.status, error);
    },
    // Deleting a default promotes another row server-side, so the whole list is refetched
    // rather than filtered locally.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ADDRESSES_KEY }),
  });
}

export function useSetDefaultAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data, error, response } = await api.PUT("/api/v1/addresses/{id}/default", {
        params: { path: { id }, query: { shipping: true, billing: true } },
      });
      if (!response.ok || !data?.data) throw failed(response.status, error);
      return data.data;
    },
    // Exactly one row holds each default, so the previous holder changes too.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ADDRESSES_KEY }),
  });
}
