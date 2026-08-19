import type { APIRoute } from "astro";
import { authErrorPath, parseAuthCredentials } from "@/lib/auth";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  let credentials;
  try {
    const form = await context.request.formData();
    credentials = parseAuthCredentials(form.get("email"), form.get("password"));
  } catch {
    return context.redirect(authErrorPath("/auth/signin"));
  }

  if (!credentials) {
    return context.redirect(authErrorPath("/auth/signin"));
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(authErrorPath("/auth/signin"));
  }

  try {
    const { error } = await supabase.auth.signInWithPassword(credentials);
    if (error) {
      return context.redirect(authErrorPath("/auth/signin"));
    }
  } catch {
    return context.redirect(authErrorPath("/auth/signin"));
  }

  return context.redirect("/dashboard");
};
