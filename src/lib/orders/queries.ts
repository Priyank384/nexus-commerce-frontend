"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { HttpError, toAuthFailure } from "@/lib/api/errors";
import type { Order } from "@/lib/orders/format";

/**
 * Hands a guest order to the signed-in account.
 *
 * The token is the one mailed with the receipt and the backend retires it as it attaches the
 * order, so this is not idempotent: a second call — a double click, or a reload of a link a
 * friend forwarded — answers "not valid" rather than succeeding again.
 */
export function useClaimOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (claimToken: string): Promise<Order> => {
      const { data, error, response } = await api.POST("/api/v1/orders/claim", {
        body: { claimToken },
      });
      if (!response.ok || !data?.data) {
        throw new HttpError(response.status, toAuthFailure(response.status, error ?? null).message);
      }
      return data.data;
    },
    onSuccess: (order) => {
      // The order is on this account now, so the history the shopper was looking at a moment ago
      // is known to be incomplete. Refetch the list and this order rather than keep showing it.
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["order", order.id] });
    },
  });
}
