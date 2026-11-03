import { z } from "zod";

// Mirrors backend Bean Validation on CreateUserRequestDto and LoginRequestDto.
// Kept in sync — the Spring response wins if they diverge.
// Zod 4 uses top-level `z.email(...)` so the parse issue carries `path: ["email"]`
// and react-hook-form can bind the message to the field.
export const loginSchema = z.object({
  email: z.email("Email must be valid"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Email must be valid"),
  phone: z.string(),
  // BCrypt stops at 72 bytes and the DTO refuses more, so a longer password is not silently
  // truncated here — it is rejected before the shopper thinks they have an account.
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters"),
});

export const forgotPasswordSchema = z.object({
  email: z.email("Email must be valid"),
});

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72, "Password must be at most 72 characters"),
    confirmPassword: z.string(),
  })
  // Checked where the shopper typed it rather than on the button, because a mistyped
  // confirmation otherwise costs them a single-use link.
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
