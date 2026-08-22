import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, getSessionFromRequest } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (session) {
    logActivity(session.userId, "logout", request);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
