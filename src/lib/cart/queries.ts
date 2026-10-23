"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { HttpError, toAuthFailure } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";

export type Cart = components["schemas"]["CartResponseDto"];
export type CartLine = components["schemas"]["CartItemResponseDto"];
export type Address = components["schemas"]["GetAddressResponseDto"];

export const CART_KEY = ["cart"] as const;

function failed(status: number, body: unknown): HttpError {
  return new HttpError(status, toAuthFailure(status, body).message);
}

export async function fetchCart(): Promise<Cart> {
  const { data, error, response } = await api.GET("/api/v1/cart");
  if (!response.ok || !data?.data) throw failed(response.status, error);
  return data.data;
}

export function useCartQuery() {
  return useQuery({ queryKey: CART_KEY, queryFn: fetchCart });
}

/**
 * Every cart mutation answers with the whole cart, so the cache is replaced from the
 * response instead of invalidated — one round trip, no second GET, and all three
 * surfaces (drawer, badge, cart page) re-render together.
 */
export function useCartMutations() {
  const queryClient = useQueryClient();

  const setQuantity = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: number; quantity: number }) => {
      const { data, error, response } = await api.PATCH("/api/v1/cart/items/{id}", {
        params: { path: { id: itemId } },
        body: { quantity },
      });
      if (!response.ok || !data?.data) throw failed(response.status, error);
      return data.data;
    },
    onSuccess: (cart) => queryClient.setQueryData(CART_KEY, cart),
  });

  const removeItem = useMutation({
    mutationFn: async (itemId: number) => {
      const { error, response } = await api.DELETE("/api/v1/cart/items/{id}", {
        params: { path: { id: itemId } },
      });
      // DELETE answers with a null payload, unlike the PATCH above.
      if (!response.ok) throw failed(response.status, error);
      return undefined;
    },
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: CART_KEY });
      const previous = queryClient.getQueryData<Cart>(CART_KEY);
      if (previous) queryClient.setQueryData(CART_KEY, cartWithoutLine(previous, itemId));
      return { previous };
    },
    onError: (_error, _itemId, context) => {
      if (context?.previous) queryClient.setQueryData(CART_KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: CART_KEY }),
  });

  return { setQuantity, removeItem };
}

function cartWithoutLine(cart: Cart, itemId: number): Cart {
  const items = (cart.items ?? []).filter((item) => item.id !== itemId);
  return {
    ...cart,
    items,
    itemCount: items.reduce((sum, item) => sum + (item.quantity ?? 0), 0),
    grandTotal: items.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0),
  };
}

export function useAddressesQuery() {
  return useQuery({
    queryKey: ["addresses"] as const,
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
    mutationFn: async (body: components["schemas"]["SaveAddressRequestDto"]) => {
      const { data, error, response } = await api.POST("/api/v1/addresses", { body });
      if (!response.ok || !data?.data) throw failed(response.status, error);
      return data.data;
    },
    onSuccess: (created) => {
      // Appending before the refetch lands keeps the payment review from flashing an empty
      // address right after the shopper saves one.
      queryClient.setQueryData<Address[]>(["addresses"], (current) =>
        current ? [...current, created] : [created],
      );
      void queryClient.invalidateQueries({ queryKey: ["addresses"] });
    },
  });
}
