"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_STORE_COOKIE, ROLE_PAGES, currentStaff } from "@/lib/auth";

/** Switches the admin to another store the person works in. */
export async function switchStore(formData: FormData) {
  const staff = await currentStaff();
  if (!staff) redirect("/admin/login");
  const store = staff.stores.find((s) => s.id === formData.get("storeId"));
  if (!store) redirect("/admin");

  (await cookies()).set(ACTIVE_STORE_COOKIE, store.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect(`/admin/${ROLE_PAGES[store.role][0]}`);
}
