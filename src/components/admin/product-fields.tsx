"use client";

import type { FieldError, UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { categoryOptions, type AdminCategoryNode } from "@/lib/admin/categories";
import { GENDERS, type ProductFormValues } from "@/lib/validation/admin-product";

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30";

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: FieldError;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      {error?.message ? <p className="mt-1 text-sm text-destructive">{error.message}</p> : null}
    </div>
  );
}

export function ProductFields({
  form,
  categories,
  stockEditable,
}: {
  form: UseFormReturn<ProductFormValues>;
  categories: AdminCategoryNode[];
  stockEditable: boolean;
}) {
  const {
    register,
    formState: { errors },
  } = form;
  const options = categoryOptions(categories);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Title" htmlFor="product-title" error={errors.title}>
            <Input id="product-title" placeholder="Relaxed linen shirt" {...register("title")} />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field
            label="Description"
            htmlFor="product-description"
            error={errors.description}
            hint="Shown on the product page, under the name."
          >
            <Textarea
              id="product-description"
              rows={4}
              placeholder="A quiet, breathable layer cut for everyday wear."
              {...register("description")}
            />
          </Field>
        </div>

        <Field label="Slug" htmlFor="product-slug" error={errors.slug} hint="Blank derives one from the title.">
          <Input id="product-slug" placeholder="relaxed-linen-shirt" {...register("slug")} />
        </Field>

        <Field label="Status" htmlFor="product-status" error={errors.status}>
          <select id="product-status" className={selectClass} {...register("status")}>
            <option value="live">Live — visible in the store</option>
            <option value="draft">Draft — hidden from shoppers</option>
          </select>
        </Field>
      </div>

      <div className="grid gap-4 border-t pt-6 sm:grid-cols-2">
        <Field label="Price (₹)" htmlFor="product-price" error={errors.price}>
          <Input id="product-price" inputMode="decimal" placeholder="2499" {...register("price")} />
        </Field>

        <Field
          label="Compare-at price (₹)"
          htmlFor="product-compare-at"
          error={errors.compareAtPrice}
          hint="The struck-through original. Leave blank for no sale."
        >
          <Input
            id="product-compare-at"
            inputMode="decimal"
            placeholder="3299"
            {...register("compareAtPrice")}
          />
        </Field>

        <Field label="Category" htmlFor="product-category" error={errors.categoryId}>
          <select id="product-category" className={selectClass} {...register("categoryId")}>
            <option value="">Choose a category</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {`${"— ".repeat(option.depth)}${option.label}`}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Stock on hand"
          htmlFor="product-stock"
          error={errors.stock}
          hint={stockEditable ? undefined : "This piece has variants, so stock is set per size below."}
        >
          <Input
            id="product-stock"
            inputMode="numeric"
            disabled={!stockEditable}
            placeholder="0"
            {...register("stock")}
          />
        </Field>
      </div>

      <div className="grid gap-4 border-t pt-6 sm:grid-cols-2">
        <Field label="Brand" htmlFor="product-brand" error={errors.brand}>
          <Input id="product-brand" placeholder="Plain Thread" {...register("brand")} />
        </Field>

        <Field label="Gender" htmlFor="product-gender" error={errors.gender}>
          <select id="product-gender" className={selectClass} {...register("gender")}>
            <option value="">Unspecified</option>
            {GENDERS.map((gender) => (
              <option key={gender} value={gender}>
                {gender.charAt(0) + gender.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Material" htmlFor="product-material" error={errors.material}>
          <Input id="product-material" placeholder="100% European linen" {...register("material")} />
        </Field>

        <Field label="Care" htmlFor="product-care" error={errors.careInstructions}>
          <Input
            id="product-care"
            placeholder="Cold wash, line dry"
            {...register("careInstructions")}
          />
        </Field>
      </div>
    </div>
  );
}
