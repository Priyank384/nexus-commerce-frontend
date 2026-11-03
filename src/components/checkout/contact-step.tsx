"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { contactSchema, type ContactValues } from "@/lib/validation/checkout";

export function ContactStep({
  initial,
  emailReadOnly,
  onContinue,
}: {
  initial: ContactValues;
  /** An account's email is its identity and the order addresses it anyway, so only a guest types one. */
  emailReadOnly: boolean;
  onContinue: (values: ContactValues) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactValues>({ resolver: zodResolver(contactSchema), defaultValues: initial });

  return (
    <form onSubmit={handleSubmit(onContinue)} className="space-y-6" noValidate>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 tabIndex={-1} className="text-lg outline-none">
            Contact
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {emailReadOnly
              ? "Your receipt and delivery updates go to this address."
              : "We email your receipt and delivery updates here — no account needed."}
          </p>
        </div>
        {emailReadOnly ? null : (
          <Link
            href="/login?next=%2Fcheckout"
            className="shrink-0 text-sm underline underline-offset-4 hover:text-muted-foreground"
          >
            Sign in
          </Link>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="contact-email">Email</Label>
          <Input
            id="contact-email"
            type="email"
            autoComplete="email"
            readOnly={emailReadOnly}
            className={emailReadOnly ? "bg-muted/50" : undefined}
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
