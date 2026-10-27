import "server-only";
import { refresh, updateTag } from "next/cache";

/** Cache tag for everything the public menu shows (products, prices, add-ons, hours, badges). */
export const MENU_TAG = "menu";

/** Call at the end of every admin Server Action that changes what customers see. */
export function menuChanged() {
  updateTag(MENU_TAG);
  refresh();
}
