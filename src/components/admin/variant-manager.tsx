"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import {
  useCreateVariant,
  useDeleteVariant,
  useUpdateVariant,
  type AdminProduct,
  type AdminVariant,
} from "@/lib/admin/products";
import { formatPrice } from "@/lib/catalog/format";
import { COLOR_HEX } from "@/lib/validation/admin-product";

type Draft = {
  sku: string;
  size: string;
  colorName: string;
  colorHex: string;
  stock: string;
  priceDelta: string;
};

const EMPTY: Draft = { sku: "", size: "", colorName: "", colorHex: "#1C1B19", stock: "0", priceDelta: "0" };

function toDraft(variant: AdminVariant): Draft {
  return {
    sku: variant.sku ?? "",
    size: variant.size ?? "",
    colorName: variant.colorName ?? "",
    colorHex: variant.colorHex ?? "#1C1B19",
    stock: String(variant.stock ?? 0),
    priceDelta: String(variant.priceDelta ?? 0),
  };
}

function validate(draft: Draft): string | null {
  const stock = draft.stock.trim();
  const delta = draft.priceDelta.trim();
  if (draft.sku.trim() === "") return "A SKU is required.";
  if (draft.sku.trim().length > 64) return "SKUs stop at 64 characters.";
  if (draft.size.trim() === "") return "A size is required.";
  if (draft.size.trim().length > 20) return "Sizes stop at 20 characters.";
  if (draft.colorName.trim() === "") return "A colour name is required.";
  if (draft.colorName.trim().length > 60) return "Colour names stop at 60 characters.";
  if (!COLOR_HEX.test(draft.colorHex.trim())) return "The hex must look like #1C1B19.";
  if (!/^\d+$/.test(stock)) return "Stock must be a whole number.";
  if (delta !== "" && !/^\d+(\.\d{1,2})?$/.test(delta)) return "The price delta must be a number.";
  return null;
}

function body(draft: Draft) {
  return {
    sku: draft.sku.trim(),
    size: draft.size.trim(),
    colorName: draft.colorName.trim(),
    colorHex: draft.colorHex.trim().toUpperCase(),
    stock: Number(draft.stock.trim()),
    priceDelta: Number(draft.priceDelta.trim() || 0),
  };
}

function DraftGrid({
  draft,
  onChange,
  idPrefix,
}: {
  draft: Draft;
  onChange: (next: Draft) => void;
  idPrefix: string;
}) {
  const field = (key: keyof Draft) => ({
    id: `${idPrefix}-${key}`,
    value: draft[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...draft, [key]: event.target.value }),
  });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <Label htmlFor={`${idPrefix}-sku`}>SKU</Label>
        <Input className="font-mono text-xs uppercase" {...field("sku")} />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-size`}>Size</Label>
        <Input placeholder="M" {...field("size")} />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-colorName`}>Colour name</Label>
        <Input placeholder="Olive" {...field("colorName")} />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-colorHex`}>Colour hex</Label>
        <Input className="font-mono uppercase" placeholder="#6B6B47" {...field("colorHex")} />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-stock`}>Stock</Label>
        <Input inputMode="numeric" {...field("stock")} />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-priceDelta`}>Price delta (₹)</Label>
        <Input inputMode="decimal" {...field("priceDelta")} />
      </div>
    </div>
  );
}

export function VariantManager({ product }: { product: AdminProduct }) {
  const productId = product.id!;
  const variants = product.variants ?? [];
  const create = useCreateVariant(productId);
  const update = useUpdateVariant(productId);
  const remove = useDeleteVariant(productId);

  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<AdminVariant | null>(null);

  function startEdit(variant: AdminVariant) {
    setEditingId(variant.id!);
    setEditDraft(toDraft(variant));
    setError(null);
  }

  function submitEdit() {
    if (editingId === null) return;
    const problem = validate(editDraft);
    if (problem) {
      setError(problem);
      return;
    }
    update.mutate(
      { variantId: editingId, body: body(editDraft) },
      {
        onSuccess: () => {
          setEditingId(null);
          setError(null);
          toast.success("Variant saved");
        },
        onError: (mutationError) => setError(mutationError.message),
      },
    );
  }

  function submitAdd() {
    const problem = validate(addDraft);
    if (problem) {
      setError(problem);
      return;
    }
    create.mutate(body(addDraft), {
      onSuccess: () => {
        setAddDraft(EMPTY);
        setAdding(false);
        setError(null);
        toast.success("Variant added");
      },
      onError: (mutationError) => setError(mutationError.message),
    });
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {variants.length === 0 ? (
        <p className="border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          No variants. Stock is set on the piece itself.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left label-caps text-muted-foreground">
                <th className="py-2 pr-3 font-normal">Colour</th>
                <th className="py-2 pr-3 font-normal">Size</th>
                <th className="py-2 pr-3 font-normal">SKU</th>
                <th className="py-2 pr-3 font-normal">Stock</th>
                <th className="py-2 pr-3 font-normal">Delta</th>
                <th className="py-2 text-right font-normal">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {variants.map((variant) => {
                if (variant.id === editingId) {
                  return (
                    <tr key={variant.id} className="border-b last:border-b-0">
                      <td colSpan={6} className="py-3">
                        <DraftGrid draft={editDraft} onChange={setEditDraft} idPrefix={`edit-${variant.id}`} />
                        <div className="mt-3 flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingId(null);
                              setError(null);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button type="button" size="sm" disabled={update.isPending} onClick={submitEdit}>
                            {update.isPending ? "Saving…" : "Save variant"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={variant.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-3">
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="size-4 rounded-full border"
                          style={{ backgroundColor: variant.colorHex ?? "#000000" }}
                        />
                        {variant.colorName}
                      </span>
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{variant.size}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{variant.sku}</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {variant.stock === 0 ? (
                        <span className="text-destructive">Sold out</span>
                      ) : (
                        variant.stock
                      )}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {variant.priceDelta ? `+${formatPrice(variant.priceDelta)}` : "—"}
                    </td>
                    <td className="py-2">
                      <div className="flex justify-end gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Edit ${variant.colorName} ${variant.size}`}
                          onClick={() => startEdit(variant)}
                        >
                          <Pencil aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Delete ${variant.colorName} ${variant.size}`}
                          onClick={() => setTarget(variant)}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {adding ? (
        <div className="border-t pt-4">
          <DraftGrid draft={addDraft} onChange={setAddDraft} idPrefix="new-variant" />
          <div className="mt-3 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={create.isPending} onClick={submitAdd}>
              {create.isPending ? "Adding…" : "Add variant"}
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus aria-hidden />
          Add variant
        </Button>
      )}

      <Dialog open={target !== null} onOpenChange={(open) => (open ? null : setTarget(null))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Remove {target?.colorName} {target?.size}?
            </DialogTitle>
            <DialogDescription>
              The SKU is retired and cannot be sold again. A product needs at least one variant, so
              the last one is kept.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => {
                if (!target?.id) return;
                remove.mutate(target.id, {
                  onSuccess: () => {
                    setTarget(null);
                    toast.success("Variant removed");
                  },
                  onError: (mutationError) => toast.error(mutationError.message),
                });
              }}
            >
              {remove.isPending ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
