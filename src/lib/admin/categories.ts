"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { HttpError, toAuthFailure } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";

export type AdminCategoryNode = components["schemas"]["GetCategoryNodeResponseDto"] & {
  // springdoc cannot describe a self-referential list, so the recursion is declared here.
  children?: AdminCategoryNode[];
};
export type AdminCategory = components["schemas"]["GetCategoryResponseDto"];
export type CreateCategoryBody = components["schemas"]["CreateCategoryRequestDto"];
export type UpdateCategoryBody = components["schemas"]["UpdateCategoryRequestDto"];

export const CATEGORY_TREE_KEY = ["category-tree"] as const;

export type CategoryOption = { id: number; label: string; depth: number };

/** Flattens the tree into indented options for a native select. */
export function categoryOptions(
  nodes: AdminCategoryNode[],
  { depth = 0, excludeIds, out = [] }: {
    depth?: number;
    excludeIds?: ReadonlySet<number>;
    out?: CategoryOption[];
  } = {},
): CategoryOption[] {
  for (const node of nodes) {
    if (node.id == null || excludeIds?.has(node.id)) continue;
    out.push({ id: node.id, label: node.name ?? "Untitled", depth });
    if (Array.isArray(node.children)) {
      categoryOptions(node.children, { depth: depth + 1, excludeIds, out });
    }
  }
  return out;
}

/** The node's own id plus every descendant, so it can never be picked as its own parent. */
export function subtreeIds(node: AdminCategoryNode, out = new Set<number>()): Set<number> {
  if (node.id != null) out.add(node.id);
  for (const child of node.children ?? []) subtreeIds(child, out);
  return out;
}

function failed(status: number, body: unknown): HttpError {
  return new HttpError(status, toAuthFailure(status, body).message);
}

/**
 * Category names appear in the admin product rows and in the storefront nav, so both the
 * category tree and the product reads have to be refreshed after any write.
 */
function invalidateCategories(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: CATEGORY_TREE_KEY });
  void queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
  void queryClient.invalidateQueries({ queryKey: ["admin", "product"] });
}

export function useAdminCategories() {
  return useQuery({
    queryKey: CATEGORY_TREE_KEY,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<AdminCategoryNode[]> => {
      const { data, error, response } = await api.GET("/api/v1/categories/tree");
      if (!response.ok || !data?.data) throw failed(response.status, error);
      return data.data as AdminCategoryNode[];
    },
  });
}

/** The dialog's fields, normalised before they reach either mutation. */
export type CategoryDraft = {
  name: string;
  parentId: number | null;
  description: string;
  slug: string;
};

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draft: CategoryDraft): Promise<AdminCategory> => {
      const body: CreateCategoryBody = {
        name: draft.name.trim(),
        parentId: draft.parentId ?? undefined,
        description: draft.description.trim() || undefined,
        slug: draft.slug.trim() || undefined,
      };
      const { data, error, response } = await api.POST("/api/v1/categories", { body });
      if (!response.ok || !data?.data) throw failed(response.status, error);
      return data.data;
    },
    onSuccess: () => invalidateCategories(queryClient),
  });
}

export function useUpdateCategory(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draft: CategoryDraft): Promise<AdminCategory> => {
      const body: UpdateCategoryBody = {
        name: draft.name.trim(),
        // An absent parentId means "keep the current parent", so a null pick has to travel
        // as the explicit moveToTopLevel flag instead.
        parentId: draft.parentId ?? undefined,
        moveToTopLevel: draft.parentId === null,
        description: draft.description.trim(),
        slug: draft.slug.trim(),
      };
      const { data, error, response } = await api.PUT("/api/v1/categories/{id}", {
        params: { path: { id } },
        body,
      });
      if (!response.ok || !data?.data) throw failed(response.status, error);
      return data.data;
    },
    onSuccess: () => invalidateCategories(queryClient),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error, response } = await api.DELETE("/api/v1/categories/{id}", {
        params: { path: { id } },
      });
      if (!response.ok) throw failed(response.status, error);
    },
    onSuccess: () => invalidateCategories(queryClient),
  });
}
