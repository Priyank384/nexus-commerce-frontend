"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useCreateAddress, type Address } from "@/lib/addresses/queries";
import { HttpError } from "@/lib/api/errors";
import { addressSchema, type AddressValues, type ContactValues } from "@/lib/validation/checkout";
import { AddressSummary } from "./summary";

export function DeliveryStep({
  addresses,
  initialAddressId,
  contact,
  onBack,
  onContinue,
}: {
  addresses: Address[];
  initialAddressId: number | null;
  contact: ContactValues;
  onBack: () => void;
  onContinue: (addressId: number) => void;
}) {
  const createAddress = useCreateAddress();
  const [selectedId, setSelectedId] = useState<number | null>(
    initialAddressId ?? addresses.find((address) => address.defaultShipping)?.id ?? addresses[0]?.id ?? null,
  );
  const [adding, setAdding] = useState(addresses.length === 0);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AddressValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      label: "Home",
      recipientName: contact.name,
      phone: contact.phone,
      line1: "",
      line2: "",
      city: "",
      state: "",
      postalCode: "",
    },
  });

  async function saveNewAddress(values: AddressValues) {
    try {
      const created = await createAddress.mutateAsync({
        ...values,
        line2: values.line2?.trim() || undefined,
        label: values.label?.trim() || "Home",
        country: "IN",
        defaultShipping: addresses.length === 0,
        defaultBilling: addresses.length === 0,
      });
      if (created.id) onContinue(created.id);
    } catch (error) {
      toast.error(error instanceof HttpError ? error.message : "Could not save the address.");
    }
  }

  if (adding) {
    return (
      <form onSubmit={handleSubmit(saveNewAddress)} className="space-y-6" noValidate>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg">Delivery address</h2>
            <p className="mt-1 text-sm text-muted-foreground">We deliver anywhere in India.</p>
          </div>
          {addresses.length > 0 ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="addr-name">Recipient name</Label>
            <Input id="addr-name" autoComplete="name" {...register("recipientName")} />
            {errors.recipientName ? (
              <p className="mt-1 text-sm text-destructive">{errors.recipientName.message}</p>
            ) : null}
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="addr-line1">Address line 1</Label>
            <Input id="addr-line1" autoComplete="address-line1" {...register("line1")} />
            {errors.line1 ? (
              <p className="mt-1 text-sm text-destructive">{errors.line1.message}</p>
            ) : null}
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="addr-line2">Address line 2 (optional)</Label>
            <Input id="addr-line2" autoComplete="address-line2" {...register("line2")} />
            {errors.line2 ? (
              <p className="mt-1 text-sm text-destructive">{errors.line2.message}</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="addr-city">City</Label>
            <Input id="addr-city" autoComplete="address-level2" {...register("city")} />
            {errors.city ? (
              <p className="mt-1 text-sm text-destructive">{errors.city.message}</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="addr-state">State</Label>
            <Input id="addr-state" autoComplete="address-level1" {...register("state")} />
            {errors.state ? (
              <p className="mt-1 text-sm text-destructive">{errors.state.message}</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="addr-postal">PIN code</Label>
            <Input id="addr-postal" autoComplete="postal-code" inputMode="numeric" {...register("postalCode")} />
            {errors.postalCode ? (
              <p className="mt-1 text-sm text-destructive">{errors.postalCode.message}</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="addr-phone">Phone</Label>
            <Input id="addr-phone" type="tel" autoComplete="tel" {...register("phone")} />
            {errors.phone ? (
              <p className="mt-1 text-sm text-destructive">{errors.phone.message}</p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between border-t pt-6">
          <Button type="button" variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button type="submit" disabled={createAddress.isPending}>
            {createAddress.isPending ? "Saving…" : "Save and continue"}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg">Delivery address</h2>
        <p className="mt-1 text-sm text-muted-foreground">Choose where this order should go.</p>
      </div>

      <fieldset className="space-y-3">
        <legend className="sr-only">Saved addresses</legend>
        {addresses.map((address) => (
          <label
            key={address.id}
            className={cn(
              "flex cursor-pointer gap-3 border p-4 transition-colors",
              selectedId === address.id ? "border-foreground" : "border-border hover:border-foreground/40",
            )}
          >
            <input
              type="radio"
              name="delivery-address"
              value={address.id}
              checked={selectedId === address.id}
              onChange={() => setSelectedId(address.id ?? null)}
              className="mt-1 size-3.5 accent-foreground"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm">{address.label || "Address"}</span>
                {address.defaultShipping ? <Badge variant="outline">Default</Badge> : null}
              </div>
              <div className="mt-2">
                <AddressSummary address={address} />
              </div>
            </div>
          </label>
        ))}
      </fieldset>

      <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
        Use a new address
      </Button>

      <div className="flex items-center justify-between border-t pt-6">
        <Button type="button" variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button
          type="button"
          disabled={selectedId == null}
          onClick={() => selectedId != null && onContinue(selectedId)}
        >
          Continue to payment
        </Button>
      </div>
    </div>
  );
}
