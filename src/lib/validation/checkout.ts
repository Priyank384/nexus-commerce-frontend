import { z } from "zod";

// Mirrors SaveAddressRequestDto's Bean Validation; Spring stays the authority.
export const addressSchema = z.object({
  label: z.string().max(60, "Label must be at most 60 characters").optional(),
  recipientName: z.string().trim().min(1, "Recipient name is required").max(120),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{6,20}$/, "Use 6–20 digits, spaces or + - ( )"),
  line1: z.string().trim().min(1, "Address line 1 is required").max(255),
  line2: z.string().trim().max(255).optional(),
  city: z.string().trim().min(1, "City is required").max(80),
  state: z.string().trim().min(1, "State is required").max(80),
  postalCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9\-\s]{3,20}$/, "Enter a valid postal code"),
});

export type AddressValues = z.infer<typeof addressSchema>;

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  email: z.email("Email must be valid"),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{6,20}$/, "Use 6–20 digits, spaces or + - ( )"),
});

export type ContactValues = z.infer<typeof contactSchema>;
