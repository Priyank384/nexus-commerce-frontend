"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { HttpError, toAuthFailure } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";

export type AdminProduct = components["schemas"]["GetProductWithDetailsResponseDto"];
export type AdminProductSummary = components["schemas"]["GetProductResponseDto"];
export type AdminProductImage = components["schemas"]["GetProductImageResponseDto"];
export type AdminVariant = components["schemas"]["GetVariantResponseDto"];
export type CreateProductBody = components["schemas"]["CreateProductRequestDto"];
export type UpdateProductBody = components["schemas"]["UpdateProductRequestDto"];
export type CreateVariantBody = components["schemas"]["CreateVariantRequestDto"];
export type UpdateVariantBody = components["schemas"]["UpdateVariantRequestDto"];

export const ADMIN_PRODUCTS_KEY = ["admin", "products"] as const;
export const ADMIN_PRODUCT_KEY = ["admin", "product"] as const;
export const PRODUCT_PAGE_SIZE = 12;

function failed(status: number, body: unknown): HttpError {
  return new HttpError(status, toAuthFailure(status, body).message);
}

function invalidateProductList(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ADMIN_PRODUCTS_KEY });
  void queryClient.invalidateQueries({ queryKey: ["admin", "metrics"] });
}

function invalidateProduct(queryClient: QueryClient, id: number) {
  void queryClient.invalidateQueries({ queryKey: [...ADMIN_PRODUCT_KEY, id] });
  invalidateProductList(queryClient);
}

export function useAdminProducts(page: number, keyword: string, outOfStockOnly = false) {
  return useQuery({
    queryKey: [...ADMIN_PRODUCTS_KEY, page, keyword, outOfStockOnly],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      // The ADMIN listing includes drafts; the public search hides them, which made the
      // "Draft" badge unreachable and left unpublished products uneditable from the table.
      const { data, error, response } = await api.GET("/api/v1/admin/products", {
        params: {
          query: {
            page,
            size: PRODUCT_PAGE_SIZE,
            q: keyword.trim() || undefined,
            outOfStock: outOfStockOnly || undefined,
          },
        },
      });
      if (!response.ok || !data?.data) throw failed(response.status, error);
      return data.data;
    },
  });
}

/** Absolute stock on a piece without variants; multi-variant pieces are set per variant. */
export function useSetProductStock(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (stock: number): Promise<AdminProductSummary> => {
      const { data, error, response } = await api.PUT("/api/v1/admin/products/{id}/stock", {
        params: { path: { id } },
        body: { stock },
      });
      if (!response.ok || !data?.data) throw failed(response.status, error);
      return data.data;
    },
    onSuccess: () => invalidateProduct(queryClient, id),
  });
}

export function useAdminProduct(id: number) {
  return useQuery({
    queryKey: [...ADMIN_PRODUCT_KEY, id],
    enabled: Number.isFinite(id),
    queryFn: async (): Promise<AdminProduct> => {
      // The public detail read 404s a draft; the editor must be able to open one.
      const { data, error, response } = await api.GET("/api/v1/admin/products/{id}", {
        params: { path: { id } },
      });
      if (!response.ok || !data?.data) throw failed(response.status, error);
      return data.data;
    },
  });
}

export type CreateProductInput = { body: CreateProductBody; files: File[] };
export type CreateProductResult = { product: AdminProductSummary; failedImages: string[] };

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, files }: CreateProductInput): Promise<CreateProductResult> => {
      const { data, error, response } = await api.POST("/api/v1/products", { body });
      if (!response.ok || !data?.data?.id) throw failed(response.status, error);
      const product = data.data;
      const productId = product.id!;

      // The product exists now. An image that fails must not fail the whole mutation, or the
      // retry would create a second product; the edit page's gallery can re-add it instead.
      const failedImages: string[] = [];
      for (const file of files) {
        try {
          const upload = await api.POST("/api/v1/admin/products/{id}/images", {
            params: { path: { id: productId } },
            ...multipart(file),
          });
          if (!upload.response.ok) failedImages.push(file.name);
        } catch {
          failedImages.push(file.name);
        }
      }
      return { product, failedImages };
    },
    onSuccess: () => invalidateProductList(queryClient),
  });
}

export function useUpdateProduct(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateProductBody): Promise<AdminProductSummary> => {
      const { data, error, response } = await api.PUT("/api/v1/products/{id}", {
        params: { path: { id } },
        body,
      });
      if (!response.ok || !data?.data) throw failed(response.status, error);
      return data.data;
    },
    onSuccess: () => invalidateProduct(queryClient, id),
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error, response } = await api.DELETE("/api/v1/products/{id}", {
        params: { path: { id } },
      });
      if (!response.ok) throw failed(response.status, error);
    },
    onSuccess: () => invalidateProductList(queryClient),
  });
}

export function useCreateVariant(productId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateVariantBody): Promise<AdminVariant> => {
      const { data, error, response } = await api.POST("/api/v1/products/{productId}/variants", {
        params: { path: { productId } },
        body,
      });
      if (!response.ok || !data?.data) throw failed(response.status, error);
      return data.data;
    },
    onSuccess: () => invalidateProduct(queryClient, productId),
  });
}

export function useUpdateVariant(productId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ variantId, body }: { variantId: number; body: UpdateVariantBody }) => {
      const { data, error, response } = await api.PUT("/api/v1/products/variants/{variantId}", {
        params: { path: { variantId } },
        body,
      });
      if (!response.ok || !data?.data) throw failed(response.status, error);
      return data.data;
    },
    onSuccess: () => invalidateProduct(queryClient, productId),
  });
}

export function useDeleteVariant(productId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variantId: number) => {
      const { error, response } = await api.DELETE("/api/v1/products/variants/{variantId}", {
        params: { path: { variantId } },
      });
      if (!response.ok) throw failed(response.status, error);
    },
    onSuccess: () => invalidateProduct(queryClient, productId),
  });
}

/** openapi-typescript renders binary multipart fields as strings; the wire body is FormData. */
type MultipartBody = { file: string };

function multipart(file: File) {
  const form = new FormData();
  form.append("file", file);
  return {
    body: form as unknown as MultipartBody,
    bodySerializer: () => form,
  };
}

export function useAppendGalleryImage(productId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<AdminProductImage> => {
      const { data, error, response } = await api.POST("/api/v1/admin/products/{id}/images", {
        params: { path: { id: productId } },
        ...multipart(file),
      });
      if (!response.ok || !data?.data) throw failed(response.status, error);
      return data.data;
    },
    onSuccess: () => invalidateProduct(queryClient, productId),
  });
}

export function useDeleteGalleryImage(productId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (imageId: number) => {
      const { error, response } = await api.DELETE("/api/v1/admin/products/{id}/images/{imageId}", {
        params: { path: { id: productId, imageId } },
      });
      if (!response.ok) throw failed(response.status, error);
    },
    onSuccess: () => invalidateProduct(queryClient, productId),
  });
}

export function useReorderGallery(productId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (imageIds: number[]) => {
      const { data, error, response } = await api.PUT("/api/v1/admin/products/{id}/images/order", {
        params: { path: { id: productId } },
        body: { imageIds },
      });
      if (!response.ok || !data?.data) throw failed(response.status, error);
      return data.data;
    },
    onSuccess: () => invalidateProduct(queryClient, productId),
  });
}
