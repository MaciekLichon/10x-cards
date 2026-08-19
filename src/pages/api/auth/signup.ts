import type { APIRoute } from "astro";
import { authErrorPath, parseAuthCredentials } from "@/lib/auth";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  let credentials;
  try {
    const form = await context.request.formData();
    credentials = parseAuthCredentials(form.get("email"), form.get("password"));
  } catch {
    return context.redirect(authErrorPath("/auth/signup"));
  }

  if (!credentials) {
    return context.redirect(authErrorPath("/auth/signup"));
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(authErrorPath("/auth/signup"));
  }

  try {
    const { error } = await supabase.auth.signUp({
      ...credentials,
      options: { emailRedirectTo: new URL("/api/auth/confirm", context.url.origin).toString() },
    });
    if (error) {
      return context.redirect(authErrorPath("/auth/signup"));
    }
  } catch {
    return context.redirect(authErrorPath("/auth/signup"));
  }

  return context.redirect("/auth/confirm-email");
};
