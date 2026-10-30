"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { contactSchema, type ContactValues } from "@/lib/validation/checkout";

export function ContactStep({
  initial,
  onContinue,
}: {
  initial: ContactValues;
  onContinue: (values: ContactValues) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactValues>({ resolver: zodResolver(contactSchema), defaultValues: initial });

  return (
    <form onSubmit={handleSubmit(onContinue)} className="space-y-6" noValidate>
      <div>
        <h2 tabIndex={-1} className="text-lg outline-none">
          Contact
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your receipt and delivery updates go to this address.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="contact-email">Email</Label>
          <Input
            id="contact-email"
            type="email"
            autoComplete="email"
            readOnly
            className="bg-muted/50"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "contact-email-error" : undefined}
            {...register("email")}
          />
          {errors.email ? (
            <p id="contact-email-error" role="alert" className="mt-1 text-sm text-destructive">
              {errors.email.message}
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="contact-name">Full name</Label>
            <Input
              id="contact-name"
              autoComplete="name"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "contact-name-error" : undefined}
              {...register("name")}
            />
            {errors.name ? (
              <p id="contact-name-error" role="alert" className="mt-1 text-sm text-destructive">
                {errors.name.message}
              </p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="contact-phone">Phone</Label>
            <Input
              id="contact-phone"
              type="tel"
              autoComplete="tel"
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? "contact-phone-error" : undefined}
              {...register("phone")}
            />
            {errors.phone ? (
              <p id="contact-phone-error" role="alert" className="mt-1 text-sm text-destructive">
                {errors.phone.message}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex justify-end border-t pt-6">
        <Button type="submit">Continue to delivery</Button>
      </div>
    </form>
  );
}
