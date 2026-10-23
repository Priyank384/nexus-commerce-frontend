"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { HttpError, toAuthFailure } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";

export type Review = components["schemas"]["GetReviewResponseDto"];

const PAGE_SIZE = 6;
export const REVIEWS_KEY = ["product-reviews"] as const;

function failed(status: number, body: unknown): HttpError {
  return new HttpError(status, toAuthFailure(status, body).message);
}

export function useProductReviews(productId: number) {
  return useInfiniteQuery({
    queryKey: [...REVIEWS_KEY, productId],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error, response } = await api.GET("/api/v1/reviews/product/{productId}", {
        params: { path: { productId }, query: { page: pageParam, size: PAGE_SIZE } },
      });
      if (!response.ok || !data?.data) throw failed(response.status, error);
      return data.data;
    },
    getNextPageParam: (last) => (last.last ? undefined : (last.page ?? 0) + 1),
  });
}

/**
 * A review must name the paid order the piece was bought on, and the backend allows one per
 * (order, product). This finds the newest such order that has not been reviewed yet, so a
 * shopper who bought the same piece twice can still review the second purchase.
 */
export function useReviewableOrder(productId: number, enabled: boolean) {
  return useQuery({
    queryKey: ["reviewable-order", productId],
    enabled,
    queryFn: async (): Promise<number | null> => {
      const { data, error, response } = await api.GET("/api/v1/orders/me", {
        params: { query: { page: 0, size: 50 } },
      });
      if (!response.ok || !data?.data) throw failed(response.status, error);

      const candidates = (data.data.content ?? []).filter(
        (order) =>
          order.paymentStatus === "PAID" &&
          (order.items ?? []).some((item) => item.productId === productId),
      );

      for (const order of candidates) {
        if (!order.id) continue;
        const reviewed = await api.GET("/api/v1/reviews/order/{orderId}", {
          params: { path: { orderId: order.id }, query: { page: 0, size: 100 } },
        });
        if (!reviewed.response.ok || !reviewed.data?.data) continue;
        const already = (reviewed.data.data.content ?? []).some(
          (review) => review.productId === productId,
        );
        if (!already) return order.id;
      }
      return null;
    },
  });
}

export function useCreateReview(productId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { orderId: number; rating: number; comment?: string }) => {
      const { data, error, response } = await api.POST("/api/v1/reviews", {
        body: { ...body, productId },
      });
      if (!response.ok || !data?.data) throw failed(response.status, error);
      return data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...REVIEWS_KEY, productId] });
      void queryClient.invalidateQueries({ queryKey: ["reviewable-order", productId] });
    },
  });
}
