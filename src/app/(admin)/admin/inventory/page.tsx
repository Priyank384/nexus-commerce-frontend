"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useAdminProduct,
  useAdminProducts,
  useSetProductStock,
  useUpdateVariant,
  type AdminProductSummary,
} from "@/lib/admin/products";
import { toast } from "sonner";

const PRODUCT_KEY = "product";

function stockLabel(stock: number): { label: string; tone: "default" | "secondary" | "destructive" | "outline" } {
  if (stock <= 0) return { label: "Out of stock", tone: "destructive" };
  if (stock <= 5) return { label: "Low", tone: "outline" };
  return { label: String(stock), tone: "secondary" };
}

/**
 * Stock lives on the variant when a piece has any, and on the piece itself only when it has
 * none. The dialog has to read the detail first for that reason: the list row's aggregate
 * says nothing about which sizes need replenishing.
 */
function AdjustStockDialog({
  product,
  onClose,
}: {
  product: AdminProductSummary;
  onClose: () => void;
}) {
  const productId = product.id!;
  const { data, isPending, isError, error, refetch } = useAdminProduct(productId);
  const setProductStock = useSetProductStock(productId);
  const updateVariant = useUpdateVariant(productId);

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const variants = data?.variants ?? [];
  const usesVariants = variants.length > 0;

  const current = (key: string, stock: number | undefined) => drafts[key] ?? String(stock ?? 0);

  function parsed(key: string, stock: number | undefined): number | null {
    const raw = current(key, stock).trim();
    return /^\d+$/.test(raw) ? Number(raw) : null;
  }

  async function save() {
    setProblem(null);

    if (!usesVariants) {
      const next = parsed(PRODUCT_KEY, data?.stock);
      if (next === null) {
        setProblem("Stock must be a whole number, zero or more.");
        return;
      }
      setSaving(true);
      try {
        await setProductStock.mutateAsync(next);
        toast.success(`Stock for ${product.title} set to ${next}`);
        onClose();
      } catch (mutationError) {
        setProblem(mutationError instanceof Error ? mutationError.message : "Could not save stock.");
      } finally {
        setSaving(false);
      }
      return;
    }

    const changed: { variantId: number; stock: number }[] = [];
    for (const variant of variants) {
      if (variant.id === undefined) continue;
      if (!(String(variant.id) in drafts)) continue;
      const next = parsed(String(variant.id), variant.stock);
      if (next === null) {
        setProblem(`Stock for ${variant.colorName} · ${variant.size} must be a whole number.`);
        return;
      }
      if (next !== (variant.stock ?? 0)) changed.push({ variantId: variant.id, stock: next });
    }

    if (changed.length === 0) {
      onClose();
      return;
    }

    // Sequential on purpose: the service recomputes products.stock from the variant rows after
    // each write, and overlapping writes could let the last resync read a half-applied total.
    setSaving(true);
    try {
      for (const line of changed) {
        await updateVariant.mutateAsync({ variantId: line.variantId, body: { stock: line.stock } });
      }
      toast.success(`Updated ${changed.length === 1 ? "1 variant" : `${changed.length} variants`}`);
      onClose();
    } catch (mutationError) {
      setProblem(mutationError instanceof Error ? mutationError.message : "Could not save stock.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adjust stock for {product.title}</DialogTitle>
          <DialogDescription>
            {usesVariants
              ? "Each size and colour is stocked separately; the piece's total is their sum."
              : "This piece has no variants, so its stock is set directly."}
          </DialogDescription>
        </DialogHeader>

        {isPending ? (
          <div className="space-y-2 py-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError ? (
          <Alert variant="destructive">
            <AlertTitle>Stock could not be loaded</AlertTitle>
            <AlertDescription>{error instanceof Error ? error.message : "Please try again."}</AlertDescription>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>
              Retry
            </Button>
          </Alert>
        ) : usesVariants ? (
          <div className="max-h-80 space-y-3 overflow-y-auto py-1">
            {variants.map((variant) => {
              const key = String(variant.id);
              return (
                <div key={variant.id} className="grid grid-cols-[1fr_9rem] items-center gap-3">
                  <div className="flex min-w-0 items-center gap-2 text-sm">
                    <span
                      aria-hidden
                      className="size-4 shrink-0 rounded-full border"
                      style={{ backgroundColor: variant.colorHex ?? "#000000" }}
                    />
                    <span className="truncate">
                      {variant.colorName ?? "Other"} · {variant.size ?? "One size"}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">{variant.sku}</span>
                  </div>
                  <Input
                    inputMode="numeric"
                    aria-label={`Stock for ${variant.colorName ?? "Other"} ${variant.size ?? "one size"}`}
                    value={current(key, variant.stock)}
                    onChange={(event) => setDrafts((prev) => ({ ...prev, [key]: event.target.value }))}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="max-w-40 py-1">
            <Label htmlFor={`stock-${productId}`}>Units on hand</Label>
            <Input
              id={`stock-${productId}`}
              inputMode="numeric"
              value={current(PRODUCT_KEY, data?.stock)}
              onChange={(event) =>
                setDrafts((prev) => ({ ...prev, [PRODUCT_KEY]: event.target.value }))
              }
            />
          </div>
        )}

        {problem ? (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        ) : null}

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button type="button" disabled={saving || isPending || isError} onClick={() => void save()}>
            {saving ? "Saving…" : "Save stock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InventoryTable({
  products,
  onAdjust,
}: {
  products: AdminProductSummary[];
  onAdjust: (product: AdminProductSummary) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Piece</TableHead>
          <TableHead className="hidden md:table-cell">Category</TableHead>
          <TableHead className="text-right">Stock</TableHead>
          <TableHead className="hidden sm:table-cell">Status</TableHead>
          <TableHead className="w-28 text-right">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => {
          const stock = stockLabel(product.stock ?? 0);
          return (
            <TableRow key={product.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="relative size-11 shrink-0 overflow-hidden rounded-sm border bg-muted">
                    {product.image ? (
                      <Image
                        src={product.image}
                        alt=""
                        fill
                        sizes="44px"
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm">{product.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{product.slug}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                {product.category ?? "—"}
              </TableCell>
              <TableCell className="text-right">
                <Badge variant={stock.tone}>{stock.label}</Badge>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Badge variant={product.isActive === false ? "outline" : "secondary"}>
                  {product.isActive === false ? "Draft" : "Live"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="outline" size="sm" onClick={() => onAdjust(product)}>
                  Adjust
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default function AdminInventoryPage() {
  const [rawKeyword, setRawKeyword] = useState("");
  const [keyword, setKeyword] = useState("");
  const [outOfStockOnly, setOutOfStockOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [adjusting, setAdjusting] = useState<AdminProductSummary | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setKeyword(rawKeyword.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [rawKeyword]);

  const { data, isPending, isError, error, refetch, isFetching } = useAdminProducts(
    page,
    keyword,
    outOfStockOnly,
  );
  const products = data?.content ?? [];
  const total = data?.totalElements ?? 0;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-heading text-3xl tracking-tight">Inventory</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {outOfStockOnly
            ? total
              ? `${total} sold-out pieces`
              : "Nothing is sold out."
            : total
              ? `${total} pieces in the catalogue`
              : "Stock across the catalogue."}
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 border-y py-3">
        <Input
          value={rawKeyword}
          onChange={(event) => setRawKeyword(event.target.value)}
          placeholder="Search by title, brand, material…"
          aria-label="Search inventory"
          className="max-w-sm bg-transparent"
        />
        <div className="flex items-center gap-3">
          {isFetching && !isPending ? (
            <span className="label-caps text-muted-foreground">Updating…</span>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant={outOfStockOnly ? "default" : "outline"}
            aria-pressed={outOfStockOnly}
            onClick={() => {
              setOutOfStockOnly((current) => !current);
              setPage(0);
            }}
          >
            Out of stock only
          </Button>
        </div>
      </div>

      {isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : isError ? (
        <Alert variant="destructive">
          <AlertTitle>Inventory could not be loaded</AlertTitle>
          <AlertDescription>{error instanceof Error ? error.message : "Please try again."}</AlertDescription>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>
            Retry
          </Button>
        </Alert>
      ) : products.length === 0 ? (
        <div className="border border-dashed px-6 py-16 text-center">
          <p className="font-heading text-lg">
            {outOfStockOnly ? "Everything is in stock." : "Nothing matches."}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {outOfStockOnly
              ? "Turn the filter off to see the whole catalogue."
              : "Try a different search."}
          </p>
        </div>
      ) : (
        <InventoryTable products={products} onAdjust={setAdjusting} />
      )}

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          Page {(data?.page ?? 0) + 1} of {Math.max(data?.totalPages ?? 1, 1)}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((current) => Math.max(current - 1, 0))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={data?.last ?? true}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      {adjusting ? (
        <AdjustStockDialog
          key={adjusting.id}
          product={adjusting}
          onClose={() => setAdjusting(null)}
        />
      ) : null}
    </section>
  );
}
