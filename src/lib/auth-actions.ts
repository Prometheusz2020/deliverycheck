"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function getSessionAdmin() {
  const cookieStore = await cookies();
  return cookieStore.get("admin_session")?.value === "true";
}

export async function loginAdmin(password: string) {
  // Chave mestra simples configurada no .env ou hardcoded para emergência
  if (password === process.env.ADMIN_PASSWORD || password === "admin_pratali") {
    const cookieStore = await cookies();
    cookieStore.set("admin_session", "true", { path: "/", maxAge: 60 * 60 * 8 }); // 8 hours
    return { success: true };
  }
  return { success: false };
}

export async function logoutAdmin() {
  const cookieStore = await cookies();
  cookieStore.delete("admin_session");
  revalidatePath("/restaurant");
}

export async function getSessionDriver() {
  const cookieStore = await cookies();
  const id = cookieStore.get("driver_id")?.value;
  const name = cookieStore.get("driver_name")?.value;
  return id ? { id, name: name || "" } : null;
}
