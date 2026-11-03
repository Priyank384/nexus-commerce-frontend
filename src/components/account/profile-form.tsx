"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { profileSchema, type ProfileValues } from "@/lib/validation/account";

export function ProfileForm({
  defaultValues,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: {
  defaultValues: ProfileValues;
  submitLabel: string;
  pending: boolean;
  onSubmit: (values: ProfileValues) => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="acct-profile-name">Name</Label>
        <Input
          id="acct-profile-name"
          autoComplete="name"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "acct-profile-name-error" : undefined}
          {...register("name")}
        />
        {errors.name ? (
          <p id="acct-profile-name-error" role="alert" className="mt-1 text-sm text-destructive">
            {errors.name.message}
          </p>
        ) : null}
      </div>
      <div>
        <Label htmlFor="acct-profile-phone">Phone (optional)</Label>
        <Input
          id="acct-profile-phone"
          type="tel"
          autoComplete="tel"
          placeholder="Used for delivery updates"
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={errors.phone ? "acct-profile-phone-error" : undefined}
          {...register("phone")}
        />
        {errors.phone ? (
          <p id="acct-profile-phone-error" role="alert" className="mt-1 text-sm text-destructive">
            {errors.phone.message}
          </p>
        ) : null}
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
