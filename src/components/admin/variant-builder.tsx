"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COLOR_HEX, SIZES, autoSku, type VariantDraft } from "@/lib/validation/admin-product";

export type ColorDraft = { key: string; name: string; hex: string };
type ComboEdit = { sku?: string; stock: string; priceDelta: string };

export type VariantBuilderState = {
  sizes: string[];
  colors: ColorDraft[];
  edits: Record<string, ComboEdit>;
};

let colorSequence = 0;

export function newColor(): ColorDraft {
  colorSequence += 1;
  return { key: `colour-${colorSequence}`, name: "", hex: "#1C1B19" };
}

export function emptyBuilder(): VariantBuilderState {
  return { sizes: ["S", "M", "L"], colors: [newColor()], edits: {} };
}

export type BuiltVariants = { variants: VariantDraft[]; errors: string[] };

export function buildVariants(title: string, state: VariantBuilderState): BuiltVariants {
  const errors: string[] = [];
  const named = state.colors.filter((color) => color.name.trim() !== "");

  const seenNames = new Set<string>();
  for (const color of named) {
    const name = color.name.trim();
    const lower = name.toLowerCase();
    if (seenNames.has(lower)) errors.push(`Colour “${name}” appears twice.`);
    seenNames.add(lower);
    if (name.length > 60) errors.push(`Colour “${name.slice(0, 20)}…” must be 60 characters or fewer.`);
    if (!COLOR_HEX.test(color.hex.trim())) {
      errors.push(`Colour “${name}” needs a hex like #1C1B19.`);
    }
  }
  if (named.length > 0 && state.sizes.length === 0) {
    errors.push("Choose at least one size for the colours you added.");
  }

  const variants: VariantDraft[] = [];
  const seenSkus = new Set<string>();
  for (const color of named) {
    for (const size of state.sizes) {
      const edit = state.edits[`${color.key}|${size}`];
      const sku = (edit?.sku?.trim() || autoSku(title, color.name, size)).toUpperCase();
      const stock = edit?.stock?.trim() || "0";
      const priceDelta = edit?.priceDelta?.trim() || "0";
      const where = `${color.name.trim()} ${size}`;

      if (sku.length > 64) errors.push(`The SKU for ${where} must be 64 characters or fewer.`);
      if (seenSkus.has(sku)) errors.push(`SKU ${sku} is used twice.`);
      seenSkus.add(sku);
      if (!/^\d+$/.test(stock)) errors.push(`Stock for ${where} must be a whole number.`);
      if (!/^\d+(\.\d{1,2})?$/.test(priceDelta)) {
        errors.push(`The price delta for ${where} must be a number like 0 or 200.`);
      }

      variants.push({
        sku,
        size,
        colorName: color.name.trim(),
        colorHex: color.hex.trim().toUpperCase(),
        stock: Number(stock),
        priceDelta: Number(priceDelta),
      });
    }
  }
  return { variants, errors };
}

function safeHex(hex: string): string {
  return COLOR_HEX.test(hex) ? hex : "#000000";
}

export function VariantBuilder({
  title,
  state,
  onChange,
  errors,
}: {
  title: string;
  state: VariantBuilderState;
  onChange: (next: VariantBuilderState) => void;
  errors: string[];
}) {
  const named = state.colors.filter((color) => color.name.trim() !== "");
  const rows = named.flatMap((color) =>
    state.sizes.map((size) => ({ color, size, key: `${color.key}|${size}` })),
  );

  function toggleSize(size: string) {
    onChange({
      ...state,
      sizes: state.sizes.includes(size)
        ? state.sizes.filter((value) => value !== size)
        : [...state.sizes, size],
    });
  }

  function updateColor(key: string, patch: Partial<ColorDraft>) {
    onChange({
      ...state,
      colors: state.colors.map((color) => (color.key === key ? { ...color, ...patch } : color)),
    });
  }

  function updateEdit(key: string, patch: Partial<ComboEdit>) {
    const current = state.edits[key] ?? { stock: "", priceDelta: "" };
    onChange({ ...state, edits: { ...state.edits, [key]: { ...current, ...patch } } });
  }

  return (
    <div className="space-y-5">
      <div>
        <Label>Sizes</Label>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Sizes">
          {SIZES.map((size) => {
            const selected = state.sizes.includes(size);
            return (
              <button
                key={size}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleSize(size)}
                className={
                  selected
                    ? "h-9 min-w-11 rounded-full border border-foreground bg-foreground px-3 text-sm text-background"
                    : "h-9 min-w-11 rounded-full border border-input px-3 text-sm transition-colors hover:border-foreground"
                }
              >
                {size}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label>Colours</Label>
        <div className="mt-2 space-y-2">
          {state.colors.map((color, index) => (
            <div key={color.key} className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-8 shrink-0 rounded-full border"
                style={{ backgroundColor: safeHex(color.hex) }}
              />
              <Input
                aria-label={`Colour ${index + 1} name`}
                placeholder="Olive"
                value={color.name}
                onChange={(event) => updateColor(color.key, { name: event.target.value })}
                className="max-w-52"
              />
              <Input
                aria-label={`Colour ${index + 1} hex`}
                placeholder="#6B6B47"
                value={color.hex}
                onChange={(event) => updateColor(color.key, { hex: event.target.value })}
                className="max-w-36 font-mono uppercase"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove colour ${index + 1}`}
                disabled={state.colors.length === 1}
                onClick={() =>
                  onChange({ ...state, colors: state.colors.filter((row) => row.key !== color.key) })
                }
              >
                <X aria-hidden />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => onChange({ ...state, colors: [...state.colors, newColor()] })}
        >
          <Plus aria-hidden />
          Add colour
        </Button>
      </div>

      <div className="border-t pt-5">
        <Label>Generated variants</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          One row per colour and size. SKUs are suggested from the title and can be edited.
        </p>

        {rows.length === 0 ? (
          <p className="mt-3 border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            Name a colour to generate size combinations.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left label-caps text-muted-foreground">
                  <th className="py-2 pr-3 font-normal">Colour</th>
                  <th className="py-2 pr-3 font-normal">Size</th>
                  <th className="py-2 pr-3 font-normal">SKU</th>
                  <th className="py-2 pr-3 font-normal">Stock</th>
                  <th className="py-2 font-normal">Price delta</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ color, size, key }) => {
                  const edit = state.edits[key];
                  const where = `${color.name.trim()} ${size}`;
                  return (
                    <tr key={key} className="border-b last:border-b-0">
                      <td className="py-2 pr-3">
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className="size-4 rounded-full border"
                            style={{ backgroundColor: safeHex(color.hex) }}
                          />
                          {color.name.trim()}
                        </span>
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{size}</td>
                      <td className="py-2 pr-3">
                        <Input
                          aria-label={`SKU for ${where}`}
                          value={edit?.sku ?? ""}
                          placeholder={autoSku(title, color.name, size)}
                          onChange={(event) => updateEdit(key, { sku: event.target.value })}
                          className="min-w-56 font-mono text-xs uppercase"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          aria-label={`Stock for ${where}`}
                          inputMode="numeric"
                          value={edit?.stock ?? ""}
                          placeholder="0"
                          onChange={(event) => updateEdit(key, { stock: event.target.value })}
                          className="w-20"
                        />
                      </td>
                      <td className="py-2">
                        <Input
                          aria-label={`Price delta for ${where}`}
                          inputMode="decimal"
                          value={edit?.priceDelta ?? ""}
                          placeholder="0"
                          onChange={(event) => updateEdit(key, { priceDelta: event.target.value })}
                          className="w-24"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {errors.length > 0 ? (
        <ul className="space-y-1 border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
