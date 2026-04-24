import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPushSubscriptions, savePushSubscriptions } from "@/lib/storage";
import { WebPushSubscription } from "@/lib/types";

function isValidSubscription(candidate: unknown): candidate is Omit<WebPushSubscription, "createdAt"> {
  if (!candidate || typeof candidate !== "object") return false;
  const maybe = candidate as Record<string, unknown>;
  if (typeof maybe.endpoint !== "string" || !maybe.endpoint.startsWith("https://")) return false;

  const keys = maybe.keys;
  if (!keys || typeof keys !== "object") return false;
  const keyObj = keys as Record<string, unknown>;

  return typeof keyObj.p256dh === "string" && keyObj.p256dh.length > 0 && typeof keyObj.auth === "string" && keyObj.auth.length > 0;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const subscriptionPayload = body?.subscription;

  if (!isValidSubscription(subscriptionPayload)) {
    return NextResponse.json({ error: "Invalid push subscription" }, { status: 400 });
  }

  const subscription: WebPushSubscription = {
    endpoint: subscriptionPayload.endpoint,
    expirationTime: typeof subscriptionPayload.expirationTime === "number" ? subscriptionPayload.expirationTime : null,
    keys: {
      p256dh: subscriptionPayload.keys.p256dh,
      auth: subscriptionPayload.keys.auth,
    },
    createdAt: new Date().toISOString(),
  };

  const subscriptions = getPushSubscriptions(session.userId);
  const existingIdx = subscriptions.findIndex((s) => s.endpoint === subscription.endpoint);

  if (existingIdx >= 0) {
    subscriptions[existingIdx] = { ...subscriptions[existingIdx], ...subscription };
  } else {
    subscriptions.push(subscription);
  }

  savePushSubscriptions(session.userId, subscriptions);

  return NextResponse.json({ success: true, count: subscriptions.length });
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let endpoint: string | undefined;
  try {
    const body = await request.json();
    endpoint = typeof body?.endpoint === "string" ? body.endpoint : undefined;
  } catch {
    endpoint = undefined;
  }

  if (!endpoint) {
    savePushSubscriptions(session.userId, []);
    return NextResponse.json({ success: true, count: 0 });
  }

  const subscriptions = getPushSubscriptions(session.userId);
  const filtered = subscriptions.filter((s) => s.endpoint !== endpoint);
  savePushSubscriptions(session.userId, filtered);

  return NextResponse.json({ success: true, count: filtered.length });
}
