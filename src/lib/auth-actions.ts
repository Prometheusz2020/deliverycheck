"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function getSessionAdmin() {
  const cookieStore = await cookies();
  return cookieStore.get("admin_session")?.value === "true";
}

import { prisma } from "./db";

export async function loginAdmin(emailOrPass: string, password?: string) {
  // Check master password (for legacy single input)
  if (!password) {
    if (emailOrPass === process.env.ADMIN_PASSWORD || emailOrPass === "admin_pratali") {
      const cookieStore = await cookies();
      cookieStore.set("admin_session", "true", { path: "/", maxAge: 60 * 60 * 8 });
      return { success: true };
    }
    return { success: false };
  }

  // Check individual admin login
  const admin = await prisma.admin.findUnique({
    where: { email: emailOrPass }
  });

  if (admin && admin.password === password) {
    const cookieStore = await cookies();
    cookieStore.set("admin_session", "true", { path: "/", maxAge: 60 * 60 * 8 });
    cookieStore.set("admin_name", admin.name, { path: "/", maxAge: 60 * 60 * 8 });
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
