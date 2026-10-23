"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminProducts, useDeleteProduct, type AdminProductSummary } from "@/lib/admin/products";
import { formatPrice } from "@/lib/catalog/format";

function DeleteProduct({ product }: { product: AdminProductSummary }) {
  const [open, setOpen] = useState(false);
  const remove = useDeleteProduct();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        aria-label={`Delete ${product.title}`}
        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
      >
        <Trash2 aria-hidden className="size-4" />
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Remove {product.title}?</DialogTitle>
          <DialogDescription>
            It leaves the storefront and its gallery immediately. Past orders keep their snapshots.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => {
              remove.mutate(product.id!, {
                onSuccess: () => {
                  setOpen(false);
                  toast.success(`${product.title} removed`);
                },
                onError: (error) => toast.error(error.message),
              });
            }}
          >
            {remove.isPending ? "Removing…" : "Remove"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProductsTable({ products }: { products: AdminProductSummary[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Piece</TableHead>
          <TableHead className="hidden md:table-cell">Category</TableHead>
          <TableHead className="text-right">Price</TableHead>
          <TableHead className="text-right">Stock</TableHead>
          <TableHead className="hidden sm:table-cell">Status</TableHead>
          <TableHead className="w-20 text-right">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
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
                  <Link
                    href={`/admin/products/${product.id}`}
                    className="block truncate text-sm underline-offset-4 hover:underline"
                  >
                    {product.title}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">{product.slug}</p>
                </div>
              </div>
            </TableCell>
            <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
              {product.category ?? "—"}
            </TableCell>
            <TableCell className="text-right text-sm tabular-nums">
              {formatPrice(product.price)}
            </TableCell>
            <TableCell className="text-right text-sm tabular-nums">{product.stock ?? 0}</TableCell>
            <TableCell className="hidden sm:table-cell">
              <Badge variant={product.isActive === false ? "outline" : "secondary"}>
                {product.isActive === false ? "Draft" : "Live"}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1">
                <Link
                  href={`/admin/products/${product.id}`}
                  aria-label={`Edit ${product.title}`}
                  className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Pencil aria-hidden className="size-4" />
                </Link>
                <DeleteProduct product={product} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function AdminProductsPage() {
  const [rawKeyword, setRawKeyword] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setKeyword(rawKeyword.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [rawKeyword]);

  const { data, isPending, isError, error, refetch, isFetching } = useAdminProducts(page, keyword);
  const products = data?.content ?? [];
  const total = data?.totalElements ?? 0;

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total ? `${total} pieces in the catalogue` : "The catalogue, newest first."}
          </p>
        </div>
        <Link href="/admin/products/new" className={buttonVariants({ size: "sm" })}>
          <Plus aria-hidden className="size-4" />
          New product
        </Link>
      </header>

      <div className="flex items-center justify-between gap-4 border-y py-3">
        <Input
          value={rawKeyword}
          onChange={(event) => setRawKeyword(event.target.value)}
          placeholder="Search by title, brand, material…"
          aria-label="Search products"
          className="max-w-sm bg-transparent"
        />
        {isFetching && !isPending ? (
          <span className="label-caps text-muted-foreground">Updating…</span>
        ) : null}
      </div>

      {isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : isError ? (
        <Alert variant="destructive">
          <AlertTitle>Products could not be loaded</AlertTitle>
          <AlertDescription>{error instanceof Error ? error.message : "Please try again."}</AlertDescription>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>
            Retry
          </Button>
        </Alert>
      ) : products.length === 0 ? (
        <div className="border border-dashed px-6 py-16 text-center">
          <p className="font-heading text-lg">Nothing matches &ldquo;{keyword}&rdquo;.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Clear the search, or add a new piece to the catalogue.
          </p>
        </div>
      ) : (
        <ProductsTable products={products} />
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
    </section>
  );
}
