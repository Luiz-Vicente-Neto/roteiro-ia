import { type NextRequest, NextResponse } from "next/server";
import {
  COOKIE_DO_DONO,
  donoValido,
  VALIDADE_DO_DONO_EM_SEGUNDOS,
} from "./app/dono";

/**
 * Gives the browser its anonymous dono on the first visit. The cookie is set
 * on the request too, so the page rendering this very request already sees it.
 */
export function proxy(request: NextRequest) {
  if (donoValido(request.cookies.get(COOKIE_DO_DONO)?.value)) {
    return NextResponse.next();
  }
  const dono = crypto.randomUUID();
  request.cookies.set(COOKIE_DO_DONO, dono);
  const response = NextResponse.next({ request });
  response.cookies.set(COOKIE_DO_DONO, dono, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VALIDADE_DO_DONO_EM_SEGUNDOS,
  });
  return response;
}

export const config = {
  // Pages and the chat route; not static files nor images.
  matcher: ["/((?!_next/static|_next/image|destinos/|favicon.ico).*)"],
};
