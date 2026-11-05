import { z } from "zod";
import { CartLine, Fulfillment } from "@wfh/shared";

export const CheckoutAddress = z.object({
  barangayId: z.uuid(),
  streetPurok: z.string().trim().max(120),
  landmark: z.string().trim().max(120),
  riderNotes: z.string().trim().max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  save: z.boolean(),
});
export type CheckoutAddress = z.infer<typeof CheckoutAddress>;

export const CheckoutInput = z.object({
  /** Store slug (/s/<slug>). */
  store: z.string().regex(/^[a-z0-9-]+$/),
  cart: z.array(CartLine).min(1, "Your cart is empty").max(30),
  name: z.string().trim().min(1, "Enter your name").max(80),
  phone: z.string().trim().min(1, "Enter your mobile number"),
  fulfillment: Fulfillment,
  scheduledFor: z.iso.datetime({ offset: true }),
  address: CheckoutAddress.nullable(),
  consent: z.literal(true, { message: "Please agree to the privacy notice" }),
});
export type CheckoutInput = z.infer<typeof CheckoutInput>;

export type PlaceOrderResult = { ok: true; url: string; code: string } | { ok: false; errors: string[] };

export const QuoteInput = z.object({
  storeId: z.uuid(),
  barangayId: z.uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  subtotal: z.number().nonnegative(),
});
