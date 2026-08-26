import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { authUseSecureCookies } from "@/lib/auth-cookie-config";

function loginRedirect(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("callbackUrl", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: authUseSecureCookies
  });

  if (pathname === "/login") {
    return token?.id ? NextResponse.redirect(new URL("/gestion", request.url)) : NextResponse.next();
  }

  if (!token?.id) {
    return loginRedirect(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/gestion", "/gestion/:path*", "/onboarding", "/login"]
};
