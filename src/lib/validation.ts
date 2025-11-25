import { z } from "zod";

// Auth validation schemas
export const signUpSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Invalid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" })
    .max(72, { message: "Password must be less than 72 characters" }),
  fullName: z
    .string()
    .trim()
    .min(1, { message: "Full name is required" })
    .max(100, { message: "Full name must be less than 100 characters" }),
});

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Invalid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  password: z
    .string()
    .min(1, { message: "Password is required" })
    .max(72, { message: "Password must be less than 72 characters" }),
});

// Profile validation schemas
export const profileUpdateSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, { message: "Full name is required" })
    .max(100, { message: "Full name must be less than 100 characters" }),
});

// Search validation schema
export const searchQuerySchema = z.object({
  query: z
    .string()
    .trim()
    .min(3, { message: "Search query must be at least 3 characters" })
    .max(500, { message: "Search query must be less than 500 characters" }),
});

// Property search params validation (for direct parser)
export const propertySearchParamsSchema = z.object({
  location: z.string().min(2, { message: "Location is required" }),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  minBeds: z.number().int().min(0).max(20).optional(),
  maxBeds: z.number().int().min(0).max(20).optional(),
  minBaths: z.number().min(0).max(20).optional(),
  propertyType: z.enum(['house', 'condo', 'townhome', 'multi', 'any']).optional(),
});

// Deal analysis validation schema
export const dealAnalysisSchema = z.object({
  address: z
    .string()
    .trim()
    .min(5, { message: "Address must be at least 5 characters" })
    .max(200, { message: "Address must be less than 200 characters" }),
  purchasePrice: z
    .number()
    .min(1000, { message: "Purchase price must be at least $1,000" })
    .max(100000000, { message: "Purchase price must be less than $100,000,000" }),
  rehabCost: z
    .number()
    .min(0, { message: "Rehab cost cannot be negative" })
    .max(10000000, { message: "Rehab cost must be less than $10,000,000" }),
  monthlyRent: z
    .number()
    .min(0, { message: "Monthly rent cannot be negative" })
    .max(1000000, { message: "Monthly rent must be less than $1,000,000" }),
  downPayment: z
    .number()
    .min(0, { message: "Down payment cannot be negative" })
    .max(100000000, { message: "Down payment must be less than $100,000,000" }),
});

// Chat message validation
export const chatMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, { message: "Message cannot be empty" })
    .max(5000, { message: "Message must be less than 5000 characters" }),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
export type DealAnalysisInput = z.infer<typeof dealAnalysisSchema>;
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
