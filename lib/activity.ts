import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { appendActivityLog } from "./storage";
import { ActivityAction, ActivityLog } from "./types";

function extractIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

function extractUserAgent(request: NextRequest): string {
  return request.headers.get("user-agent") || "unknown";
}

export function logActivity(
  userId: string,
  action: ActivityAction,
  request: NextRequest,
  options?: { details?: string; metadata?: Record<string, string> }
) {
  const log: ActivityLog = {
    id: uuidv4(),
    action,
    details: options?.details,
    metadata: options?.metadata,
    ip: extractIp(request),
    userAgent: extractUserAgent(request),
    timestamp: new Date().toISOString(),
  };
  appendActivityLog(userId, log);
}

export function logActivityNoRequest(
  userId: string,
  action: ActivityAction,
  options?: { details?: string; metadata?: Record<string, string> }
) {
  const log: ActivityLog = {
    id: uuidv4(),
    action,
    details: options?.details,
    metadata: options?.metadata,
    timestamp: new Date().toISOString(),
  };
  appendActivityLog(userId, log);
}
