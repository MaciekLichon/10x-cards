import type { APIRoute } from "astro";
import { authErrorPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase";

const CONFIRMATION_ERROR_REDIRECT = `${authErrorPath("/auth/signin")}#authentication-failed`;

export const GET: APIRoute = async (context) => {
  const code = context.url.searchParams.get("code");
  const supabase = createClient(context.request.headers, context.cookies);

  if (!code || !supabase) {
    return context.redirect(CONFIRMATION_ERROR_REDIRECT);
  }

  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return context.redirect(CONFIRMATION_ERROR_REDIRECT);
    }
  } catch {
    return context.redirect(CONFIRMATION_ERROR_REDIRECT);
  }

  return context.redirect("/dashboard");
};
