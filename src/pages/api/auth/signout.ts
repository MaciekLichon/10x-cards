import type { APIRoute } from "astro";
import { authErrorPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(authErrorPath("/auth/signin"));
  }

  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return context.redirect(authErrorPath("/auth/signin"));
    }
  } catch {
    return context.redirect(authErrorPath("/auth/signin"));
  }

  return context.redirect("/");
};
