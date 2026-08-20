export const AUTH_ERROR_CODE = "authentication_failed";
export const AUTH_ERROR_MESSAGE = "Authentication failed. Please try again.";

const MIN_PASSWORD_LENGTH = 6;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AuthCredentials {
  email: string;
  password: string;
}

export function parseAuthCredentials(emailValue: unknown, passwordValue: unknown): AuthCredentials | null {
  if (typeof emailValue !== "string" || typeof passwordValue !== "string") {
    return null;
  }

  const email = emailValue.trim();
  if (!EMAIL_PATTERN.test(email) || passwordValue.length < MIN_PASSWORD_LENGTH) {
    return null;
  }

  return { email, password: passwordValue };
}

export function authErrorPath(pathname: "/auth/signin" | "/auth/signup") {
  return `${pathname}?error=${AUTH_ERROR_CODE}`;
}

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin;
}
