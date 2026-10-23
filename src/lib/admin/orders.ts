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

export type AdminOrder = components["schemas"]["GetOrderResponseDto"];
export type AdminOrderItem = components["schemas"]["OrderItemResponseDto"];
export type AdminOrderStatus = NonNullable<AdminOrder["orderStatus"]>;
export type AdminPaymentStatus = NonNullable<AdminOrder["paymentStatus"]>;

export const ADMIN_ORDERS_KEY = ["admin", "orders"] as const;
export const ADMIN_ORDERS_PAGE_SIZE = 15;

function failed(status: number, body: unknown): HttpError {
  return new HttpError(status, toAuthFailure(status, body).message);
}

export function useAdminOrders(page: number) {
  return useQuery({
    queryKey: [...ADMIN_ORDERS_KEY, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error, response } = await api.GET("/api/v1/orders", {
        params: { query: { page, size: ADMIN_ORDERS_PAGE_SIZE } },
      });
      if (!response.ok || !data?.data) throw failed(response.status, error);
      return data.data;
    },
  });
}

/**
 * Status-only PUT. Line edits are deliberately absent: an administrator fulfilling an order
 * moves it forward or cancels it, they do not rewrite what the customer bought.
 */
export function useUpdateOrderStatus(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (status: AdminOrderStatus): Promise<AdminOrder> => {
      const { data, error, response } = await api.PUT("/api/v1/orders/{id}", {
        params: { path: { id } },
        body: { status },
      });
      if (!response.ok || !data?.data) throw failed(response.status, error);
      return data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_ORDERS_KEY });
      void queryClient.invalidateQueries({ queryKey: ["admin", "metrics"] });
      // Cancelling returns stock, and the owner's own views must reflect the new status.
      void queryClient.invalidateQueries({ queryKey: ["order", id] });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

/** PENDING → SHIPPED → DELIVERED, with PENDING → CANCELLED as the only branch out. */
export function nextOrderActions(status: AdminOrderStatus): { next: AdminOrderStatus; label: string }[] {
  if (status === "PENDING") return [{ next: "SHIPPED", label: "Mark shipped" }];
  if (status === "SHIPPED") return [{ next: "DELIVERED", label: "Mark delivered" }];
  return [];
}
