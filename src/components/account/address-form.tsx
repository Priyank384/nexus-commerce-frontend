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
          <Input id="acct-addr-label" placeholder="Home, Work…" {...register("label")} />
          {errors.label ? <p className="mt-1 text-sm text-destructive">{errors.label.message}</p> : null}
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="acct-addr-name">Recipient name</Label>
          <Input id="acct-addr-name" autoComplete="name" {...register("recipientName")} />
          {errors.recipientName ? (
            <p className="mt-1 text-sm text-destructive">{errors.recipientName.message}</p>
          ) : null}
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="acct-addr-line1">Address line 1</Label>
          <Input id="acct-addr-line1" autoComplete="address-line1" {...register("line1")} />
          {errors.line1 ? <p className="mt-1 text-sm text-destructive">{errors.line1.message}</p> : null}
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="acct-addr-line2">Address line 2 (optional)</Label>
          <Input id="acct-addr-line2" autoComplete="address-line2" {...register("line2")} />
          {errors.line2 ? <p className="mt-1 text-sm text-destructive">{errors.line2.message}</p> : null}
        </div>
        <div>
          <Label htmlFor="acct-addr-city">City</Label>
          <Input id="acct-addr-city" autoComplete="address-level2" {...register("city")} />
          {errors.city ? <p className="mt-1 text-sm text-destructive">{errors.city.message}</p> : null}
        </div>
        <div>
          <Label htmlFor="acct-addr-state">State</Label>
          <Input id="acct-addr-state" autoComplete="address-level1" {...register("state")} />
          {errors.state ? <p className="mt-1 text-sm text-destructive">{errors.state.message}</p> : null}
        </div>
        <div>
          <Label htmlFor="acct-addr-postal">PIN code</Label>
          <Input
            id="acct-addr-postal"
            autoComplete="postal-code"
            inputMode="numeric"
            {...register("postalCode")}
          />
          {errors.postalCode ? (
            <p className="mt-1 text-sm text-destructive">{errors.postalCode.message}</p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="acct-addr-phone">Phone</Label>
          <Input id="acct-addr-phone" type="tel" autoComplete="tel" {...register("phone")} />
          {errors.phone ? <p className="mt-1 text-sm text-destructive">{errors.phone.message}</p> : null}
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
