"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAddressesQuery,
  useCreateAddress,
  useDeleteAddress,
  useSetDefaultAddress,
  useUpdateAddress,
  type Address,
} from "@/lib/addresses/queries";
import { HttpError } from "@/lib/api/errors";
import type { AddressValues } from "@/lib/validation/checkout";
import { AddressForm } from "./address-form";

const EMPTY: AddressValues = {
  label: "Home",
  recipientName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
};

function valuesOf(address: Address): AddressValues {
  return {
    label: address.label ?? "Home",
    recipientName: address.recipientName ?? "",
    phone: address.phone ?? "",
    line1: address.line1 ?? "",
    line2: address.line2 ?? "",
    city: address.city ?? "",
    state: address.state ?? "",
    postalCode: address.postalCode ?? "",
  };
}

export function AddressPanel() {
  const addresses = useAddressesQuery();
  const create = useCreateAddress();
  const update = useUpdateAddress();
  const remove = useDeleteAddress();
  const setDefault = useSetDefaultAddress();

  const [editing, setEditing] = useState<Address | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Address | null>(null);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(address: Address) {
    setEditing(address);
    setFormOpen(true);
  }

  async function save(values: AddressValues) {
    const body = {
      ...values,
      line2: values.line2?.trim() || undefined,
      label: values.label?.trim() || "Home",
      country: "IN",
    };
    try {
      if (editing?.id) {
        // A null flag keeps the existing default rather than clearing it, which matters
        // because PUT replaces every other field.
        await update.mutateAsync({ id: editing.id, body });
        toast.success("Address updated");
      } else {
        const first = (addresses.data?.length ?? 0) === 0;
        await create.mutateAsync({ ...body, defaultShipping: first, defaultBilling: first });
        toast.success("Address saved");
      }
      setFormOpen(false);
    } catch (error) {
      toast.error(error instanceof HttpError ? error.message : "Could not save the address.");
    }
  }

  async function confirmDelete() {
    if (!deleting?.id) return;
    try {
      await remove.mutateAsync(deleting.id);
      toast.success("Address deleted");
      setDeleting(null);
    } catch (error) {
      toast.error(error instanceof HttpError ? error.message : "Could not delete the address.");
    }
  }

  async function makeDefault(address: Address) {
    if (!address.id) return;
    try {
      await setDefault.mutateAsync(address.id);
      toast.success("Default address updated");
    } catch (error) {
      toast.error(error instanceof HttpError ? error.message : "Could not update the default.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg">Saved addresses</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Checkout fills from the default address, and every order keeps its own copy.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus aria-hidden className="mr-1.5 size-4" />
          Add address
        </Button>
      </div>

      {addresses.isPending ? <Skeleton className="h-40 w-full" /> : null}

      {addresses.isError ? (
        <p role="alert" className="text-sm text-muted-foreground">
          We could not load your addresses.
        </p>
      ) : null}

      {addresses.data?.length === 0 ? (
        <p className="border p-6 text-sm text-muted-foreground">
          No addresses yet. Add one so checkout can use it.
        </p>
      ) : null}

      <ul className="grid gap-4 md:grid-cols-2">
        {(addresses.data ?? []).map((address) => (
          <li key={address.id} className="flex flex-col justify-between border p-5">
            <div>
              <div className="flex items-start justify-between gap-3">
                <p className="label-caps text-muted-foreground">{address.label || "Address"}</p>
                {address.defaultShipping ? <Badge variant="secondary">Default</Badge> : null}
              </div>
              <p className="mt-2 text-sm">{address.recipientName}</p>
              <p className="text-sm text-muted-foreground">
                {address.line1}
                {address.line2 ? `, ${address.line2}` : ""}
              </p>
              <p className="text-sm text-muted-foreground">
                {[address.city, address.state, address.postalCode].filter(Boolean).join(", ")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{address.phone}</p>
            </div>
            <div className="mt-5 flex flex-wrap gap-1">
              <Button size="sm" variant="outline" onClick={() => openEdit(address)}>
                Edit
              </Button>
              {!address.defaultShipping ? (
                <Button size="sm" variant="ghost" onClick={() => makeDefault(address)}>
                  Make default
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" onClick={() => setDeleting(address)}>
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit address" : "Add address"}</DialogTitle>
            <DialogDescription>We deliver anywhere in India.</DialogDescription>
          </DialogHeader>
          <AddressForm
            defaultValues={editing ? valuesOf(editing) : EMPTY}
            submitLabel={editing ? "Save changes" : "Save address"}
            pending={create.isPending || update.isPending}
            onSubmit={save}
            onCancel={() => setFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this address?</DialogTitle>
            <DialogDescription>
              {deleting?.defaultShipping
                ? "It is your default, so the oldest remaining address takes its place."
                : "It will no longer be offered at checkout. Placed orders keep their copy."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={remove.isPending}>
              {remove.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
