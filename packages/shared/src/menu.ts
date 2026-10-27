import { z } from "zod";
import { AvailabilityMode, PriceMode, ProductType, SoldBy } from "./enums";

/** Peso amount. Prices may be null until the owner sets them. */
const Peso = z.number().nonnegative();

export const Category = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  sortOrder: z.number().int(),
  active: z.boolean(),
});
export type Category = z.infer<typeof Category>;

export const Modifier = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  /** Null until priced; unpriced options aren't offered. */
  priceDelta: Peso.nullable(),
  /** Frozen "Cooked"/"Fried" options set this so the item goes to the kitchen. */
  requiresCooking: z.boolean(),
  sortOrder: z.number().int(),
});
export type Modifier = z.infer<typeof Modifier>;

export const ModifierGroup = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  required: z.boolean(),
  minSelect: z.number().int().nonnegative(),
  maxSelect: z.number().int().positive(),
  modifiers: z.array(Modifier),
});
export type ModifierGroup = z.infer<typeof ModifierGroup>;

export const Ingredient = z.object({
  id: z.uuid(),
  /** Stable slug used in webhooks, e.g. "shrimp". */
  key: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string().min(1),
  unit: z.string().nullable(),
  availabilityMode: AvailabilityMode,
  defaultWaitMinutes: z.number().int().positive().nullable(),
});
export type Ingredient = z.infer<typeof Ingredient>;

export const Product = z.object({
  id: z.uuid(),
  sku: z.string().regex(/^[A-Z0-9-]+$/),
  name: z.string().min(1),
  categoryId: z.uuid(),
  type: ProductType,
  priceMode: PriceMode,
  /** Fixed price, or price per kg when soldBy is "weight". Null until set. */
  price: Peso.nullable(),
  /** Shown as "~₱___" for market-price items. */
  estimatedPrice: Peso.nullable(),
  soldBy: SoldBy,
  weightOptionsKg: z.array(z.number().positive()),
  prepMinutes: z.number().int().nonnegative().nullable(),
  stockTracked: z.boolean(),
  imageUrl: z.url().nullable(),
  active: z.boolean(),
  keyIngredientIds: z.array(z.uuid()),
  modifierGroups: z.array(ModifierGroup),
});
export type Product = z.infer<typeof Product>;

/** What GET /api/menu returns and what the ordering backend caches. */
export const MenuSnapshot = z.object({
  version: z.string(),
  categories: z.array(Category),
  ingredients: z.array(Ingredient),
  products: z.array(Product),
});
export type MenuSnapshot = z.infer<typeof MenuSnapshot>;
