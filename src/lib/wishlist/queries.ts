"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { HttpError, toAuthFailure } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";

export type Wishlist = components["schemas"]["GetWishlistResponseDto"];
export type WishlistItem = components["schemas"]["GetWishlistItemResponseDto"];

export const WISHLIST_KEY = ["wishlist"] as const;

function failed(status: number, body: unknown): HttpError {
  return new HttpError(status, toAuthFailure(status, body).message);
}

export async function fetchWishlist(): Promise<Wishlist> {
  const { data, error, response } = await api.GET("/api/v1/wishlist");
  if (!response.ok || !data?.data) throw failed(response.status, error);
  return data.data;
}

/** Disabled for signed-out shoppers: the endpoint is owner-only and would 401. */
export function useWishlistQuery(enabled: boolean) {
  return useQuery({
    queryKey: WISHLIST_KEY,
    queryFn: fetchWishlist,
    enabled,
    staleTime: 60_000,
  });
}

export function savedProductIds(wishlist: Wishlist | undefined): Set<number> {
  return new Set(
    (wishlist?.items ?? [])
      .map((item) => item.productId)
      .filter((id): id is number => typeof id === "number"),
  );
}

export function useWishlistToggle() {
  const queryClient = useQueryClient();

  const add = useMutation({
    mutationFn: async ({ productId, variantId }: { productId: number; variantId?: number }) => {
      const { data, error, response } = await api.POST("/api/v1/wishlist/items", {
        body: { productId, ...(variantId ? { variantId } : {}) },
      });
      if (!response.ok || !data?.data) throw failed(response.status, error);
      return data.data;
    },
    onSuccess: (wishlist) => queryClient.setQueryData(WISHLIST_KEY, wishlist),
  });

  const remove = useMutation({
    mutationFn: async (productId: number) => {
      const { error, response } = await api.DELETE("/api/v1/wishlist/items/{productId}", {
        params: { path: { productId } },
      });
      if (!response.ok) throw failed(response.status, error);
    },
    onMutate: async (productId) => {
      await queryClient.cancelQueries({ queryKey: WISHLIST_KEY });
      const previous = queryClient.getQueryData<Wishlist>(WISHLIST_KEY);
      if (previous) {
        const items = (previous.items ?? []).filter((item) => item.productId !== productId);
        queryClient.setQueryData<Wishlist>(WISHLIST_KEY, {
          ...previous,
          items,
          itemCount: items.length,
        });
      }
      return { previous };
    },
    onError: (_error, _productId, context) => {
      if (context?.previous) queryClient.setQueryData(WISHLIST_KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: WISHLIST_KEY }),
  });

  return { add, remove };
}
