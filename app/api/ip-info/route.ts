import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

const IP_INFO_API = "https://ipinfo.spacehost.ovh/api/v2/lookup";

const cache = new Map<string, { data: Record<string, unknown>; expires: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = request.nextUrl.searchParams.get("ip");
  if (!ip) {
    return NextResponse.json({ error: "Missing ip parameter" }, { status: 400 });
  }

  const cached = cache.get(ip);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.data);
  }

  try {
    const res = await fetch(`${IP_INFO_API}?ip=${encodeURIComponent(ip)}&checkVpn=true`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Lookup failed" }, { status: 502 });
    }

    const data = await res.json();
    cache.set(ip, { data, expires: Date.now() + CACHE_TTL });

    if (cache.size > 500) {
      const now = Date.now();
      for (const [key, val] of cache) {
        if (val.expires < now) cache.delete(key);
      }
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Lookup failed" }, { status: 502 });
  }
}
