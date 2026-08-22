import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

interface IpDetection {
  cloud: boolean;
  hosting: boolean;
  proxy: boolean;
  spamhaus: boolean;
  tor: boolean;
  vpn: boolean;
}

interface IpInfo {
  ip: string;
  city: string;
  region: string;
  postal: string;
  country: string;
  country_code: string;
  continent: string;
  continent_code: string;
  latitude: string;
  longitude: string;
  as_name: string;
  as_domain: string;
  asn: string;
  timezone: string;
  local_time: string;
  detection: IpDetection;
  suggestion: string;
  is_bogon: boolean;
  is_anycast: boolean;
}

const ipCache = new Map<string, { data: IpInfo; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const ip = searchParams.get("ip");

  if (!ip || ip === "unknown") {
    return NextResponse.json({ error: "Invalid IP address" }, { status: 400 });
  }

  const cached = ipCache.get(ip);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    const response = await fetch(
      `https://ipinfo.spacehost.ovh/api/v2/lookup?ip=${encodeURIComponent(ip)}&checkVpn=true`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch IP info");
    }

    const data: IpInfo = await response.json();

    ipCache.set(ip, { data, timestamp: Date.now() });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching IP info:", error);
    return NextResponse.json({ error: "Failed to fetch IP information" }, { status: 500 });
  }
}
