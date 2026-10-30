"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addressSchema, type AddressValues } from "@/lib/validation/checkout";

export function AddressForm({
  defaultValues,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: {
  defaultValues: AddressValues;
  submitLabel: string;
  pending: boolean;
  onSubmit: (values: AddressValues) => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AddressValues>({
    resolver: zodResolver(addressSchema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="acct-addr-label">Label</Label>
          <Input
            id="acct-addr-label"
            placeholder="Home, Work…"
            aria-invalid={Boolean(errors.label)}
            aria-describedby={errors.label ? "acct-addr-label-error" : undefined}
            {...register("label")}
          />
          {errors.label ? (
            <p id="acct-addr-label-error" role="alert" className="mt-1 text-sm text-destructive">
              {errors.label.message}
            </p>
          ) : null}
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="acct-addr-name">Recipient name</Label>
          <Input
            id="acct-addr-name"
            autoComplete="name"
            aria-invalid={Boolean(errors.recipientName)}
            aria-describedby={errors.recipientName ? "acct-addr-name-error" : undefined}
            {...register("recipientName")}
          />
          {errors.recipientName ? (
            <p id="acct-addr-name-error" role="alert" className="mt-1 text-sm text-destructive">
              {errors.recipientName.message}
            </p>
          ) : null}
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="acct-addr-line1">Address line 1</Label>
          <Input
            id="acct-addr-line1"
            autoComplete="address-line1"
            aria-invalid={Boolean(errors.line1)}
            aria-describedby={errors.line1 ? "acct-addr-line1-error" : undefined}
            {...register("line1")}
          />
          {errors.line1 ? (
            <p id="acct-addr-line1-error" role="alert" className="mt-1 text-sm text-destructive">
              {errors.line1.message}
            </p>
          ) : null}
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="acct-addr-line2">Address line 2 (optional)</Label>
          <Input id="acct-addr-line2" autoComplete="address-line2" {...register("line2")} />
          {errors.line2 ? (
            <p id="acct-addr-line2-error" role="alert" className="mt-1 text-sm text-destructive">
              {errors.line2.message}
            </p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="acct-addr-city">City</Label>
          <Input
            id="acct-addr-city"
            autoComplete="address-level2"
            aria-invalid={Boolean(errors.city)}
            aria-describedby={errors.city ? "acct-addr-city-error" : undefined}
            {...register("city")}
          />
          {errors.city ? (
            <p id="acct-addr-city-error" role="alert" className="mt-1 text-sm text-destructive">
              {errors.city.message}
            </p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="acct-addr-state">State</Label>
          <Input
            id="acct-addr-state"
            autoComplete="address-level1"
            aria-invalid={Boolean(errors.state)}
            aria-describedby={errors.state ? "acct-addr-state-error" : undefined}
            {...register("state")}
          />
          {errors.state ? (
            <p id="acct-addr-state-error" role="alert" className="mt-1 text-sm text-destructive">
              {errors.state.message}
            </p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="acct-addr-postal">PIN code</Label>
          <Input
            id="acct-addr-postal"
            autoComplete="postal-code"
            inputMode="numeric"
            aria-invalid={Boolean(errors.postalCode)}
            aria-describedby={errors.postalCode ? "acct-addr-postal-error" : undefined}
            {...register("postalCode")}
          />
          {errors.postalCode ? (
            <p id="acct-addr-postal-error" role="alert" className="mt-1 text-sm text-destructive">
              {errors.postalCode.message}
            </p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="acct-addr-phone">Phone</Label>
          <Input
            id="acct-addr-phone"
            type="tel"
            autoComplete="tel"
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? "acct-addr-phone-error" : undefined}
            {...register("phone")}
          />
          {errors.phone ? (
            <p id="acct-addr-phone-error" role="alert" className="mt-1 text-sm text-destructive">
              {errors.phone.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t pt-5">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
