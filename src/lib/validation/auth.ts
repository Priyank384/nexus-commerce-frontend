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
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
