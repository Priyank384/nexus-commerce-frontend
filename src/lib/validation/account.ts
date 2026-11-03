import { z } from "zod";

// Mirrors UpdateProfileRequestDto: name is required and capped at 120, phone is optional and
// capped at 20. The number gets no format rule here because signup never enforced one either —
// a shopper with an old, malformed value must still be able to save a name change.
export const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(120, "Name must be at most 120 characters"),
  phone: z.string().trim().max(20, "Phone must be at most 20 characters"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    // BCrypt truncates past 72 bytes, so the same guard the signup form applies belongs here too.
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters")
      .max(72, "New password must be at most 72 characters"),
    confirmPassword: z.string(),
  })
  // Checked where it was typed rather than on submit: a mistyped confirmation should cost a
  // retyped field, not a round trip that revokes every session on the account.
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export type ProfileValues = z.infer<typeof profileSchema>;
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
