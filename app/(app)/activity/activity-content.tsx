"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Chip,
  Select,
  SelectItem,
  Pagination,
  Tooltip,
  Spinner,
} from "@heroui/react";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { ActivityLog, ActivityAction } from "@/lib/types";
import { useTranslation } from "@/lib/i18n";

const ACTION_CONFIG: Record<ActivityAction, { icon: string; color: string; colorClass: string }> = {
  login: { icon: "solar:login-2-bold-duotone", color: "success", colorClass: "text-success bg-success/10" },
  login_failed: { icon: "solar:shield-warning-bold-duotone", color: "danger", colorClass: "text-danger bg-danger/10" },
  logout: { icon: "solar:logout-2-bold-duotone", color: "default", colorClass: "text-default-500 bg-default/10" },
  expense_add: { icon: "solar:add-circle-bold-duotone", color: "primary", colorClass: "text-primary bg-primary/10" },
  expense_edit: { icon: "solar:pen-bold-duotone", color: "warning", colorClass: "text-warning bg-warning/10" },
  expense_delete: { icon: "solar:trash-bin-minimalistic-bold-duotone", color: "danger", colorClass: "text-danger bg-danger/10" },
  recurring_add: { icon: "solar:refresh-circle-bold-duotone", color: "primary", colorClass: "text-primary bg-primary/10" },
  recurring_delete: { icon: "solar:trash-bin-minimalistic-bold-duotone", color: "danger", colorClass: "text-danger bg-danger/10" },
  reminder_add: { icon: "solar:bell-bold-duotone", color: "primary", colorClass: "text-primary bg-primary/10" },
  reminder_delete: { icon: "solar:bell-off-bold-duotone", color: "danger", colorClass: "text-danger bg-danger/10" },
  reminder_confirm: { icon: "solar:check-circle-bold-duotone", color: "success", colorClass: "text-success bg-success/10" },
  settings_update: { icon: "solar:settings-bold-duotone", color: "secondary", colorClass: "text-secondary bg-secondary/10" },
  password_change: { icon: "solar:lock-keyhole-bold-duotone", color: "warning", colorClass: "text-warning bg-warning/10" },
  "2fa_enable": { icon: "solar:shield-check-bold-duotone", color: "success", colorClass: "text-success bg-success/10" },
  "2fa_disable": { icon: "solar:shield-cross-bold-duotone", color: "danger", colorClass: "text-danger bg-danger/10" },
  profile_update: { icon: "solar:user-id-bold-duotone", color: "primary", colorClass: "text-primary bg-primary/10" },
};

const PAGE_SIZE = 20;

function countryFlagIcon(code: string): string {
  if (!code) return "";
  return `flag:${code.toLowerCase()}-4x3`;
}

function parseUserAgent(ua: string): { browser: string; os: string } {
  if (!ua || ua === "unknown") return { browser: "Unknown", os: "Unknown" };

  let browser = "Unknown";
  if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("OPR/") || ua.includes("Opera")) browser = "Opera";
  else if (ua.includes("Chrome/") && !ua.includes("Edg/")) browser = "Chrome";
  else if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Safari/") && !ua.includes("Chrome")) browser = "Safari";

  let os = "Unknown";
  if (ua.includes("Windows NT 10")) os = "Windows";
  else if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS X")) os = "macOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Linux")) os = "Linux";

  return { browser, os };
}

function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}

// ---- IP Info cache & tooltip ----

interface IpInfo {
  ip: string;
  city?: string;
  region?: string;
  country?: string;
  country_code?: string;
  continent?: string;
  as_name?: string;
  asn?: string;
  timezone?: string;
  local_time?: string;
  detection?: {
    vpn?: boolean;
    proxy?: boolean;
    tor?: boolean;
    hosting?: boolean;
    cloud?: boolean;
  };
}

const ipInfoCache = new Map<string, IpInfo | "loading" | "error">();

function IpTooltipContent({ ip }: { ip: string }) {
  const [info, setInfo] = useState<IpInfo | "loading" | "error">(
    ipInfoCache.get(ip) || "loading"
  );

  useEffect(() => {
    const cached = ipInfoCache.get(ip);
    if (cached && cached !== "loading") {
      setInfo(cached);
      return;
    }

    ipInfoCache.set(ip, "loading");
    fetch(`/api/ip-info?ip=${encodeURIComponent(ip)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: IpInfo) => {
        ipInfoCache.set(ip, data);
        setInfo(data);
      })
      .catch(() => {
        ipInfoCache.set(ip, "error");
        setInfo("error");
      });
  }, [ip]);

  if (info === "loading") {
    return (
      <div className="flex items-center gap-2 p-1">
        <Spinner size="sm" />
        <span className="text-xs">Loading...</span>
      </div>
    );
  }

  if (info === "error") {
    return (
      <div className="p-1 text-xs text-default-400">{ip}</div>
    );
  }

  const flags: string[] = [];
  if (info.detection?.vpn) flags.push("VPN");
  if (info.detection?.proxy) flags.push("Proxy");
  if (info.detection?.tor) flags.push("Tor");
  if (info.detection?.hosting) flags.push("Hosting");
  if (info.detection?.cloud) flags.push("Cloud");

  const flagIcon = info.country_code ? countryFlagIcon(info.country_code) : "";
  const location = [info.city, info.region, info.country].filter(Boolean).join(", ");

  return (
    <div className="p-1 space-y-1.5 max-w-[280px]">
      <div className="font-mono text-xs text-default-500">{ip}</div>
      {location && (
        <div className="flex items-center gap-1.5 text-sm">
          {flagIcon && <Icon icon={flagIcon} width={16} height={12} style={{ borderRadius: "2px" }} />}
          <span>{location}</span>
        </div>
      )}
      {info.as_name && (
        <div className="text-xs text-default-400">
          {info.as_name} {info.asn ? `(${info.asn})` : ""}
        </div>
      )}
      {info.timezone && (
        <div className="text-xs text-default-400">
          UTC{info.timezone}{info.local_time ? ` — ${info.local_time}` : ""}
        </div>
      )}
      {flags.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {flags.map((f) => (
            <span
              key={f}
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                f === "VPN" || f === "Proxy" || f === "Tor"
                  ? "bg-warning/15 text-warning"
                  : "bg-default/15 text-default-500"
              }`}
            >
              {f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ActivityContent() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState<string>("");
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/activity");
      const data = await res.json();
      setLogs(data.logs || []);
    } catch {
      addToast({ title: t("activity.failed_load"), color: "danger" });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredLogs = useMemo(() => {
    if (!filterAction) return logs;
    return logs.filter((l) => l.action === filterAction);
  }, [logs, filterAction]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const pagedLogs = filteredLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const actionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const log of logs) {
      counts[log.action] = (counts[log.action] || 0) + 1;
    }
    return counts;
  }, [logs]);

  const groupedByDate = useMemo(() => {
    const groups: { label: string; logs: ActivityLog[] }[] = [];
    let currentLabel = "";

    for (const log of pagedLogs) {
      const date = new Date(log.timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let label: string;
      if (date.toDateString() === today.toDateString()) {
        label = t("activity.today");
      } else if (date.toDateString() === yesterday.toDateString()) {
        label = t("activity.yesterday");
      } else {
        label = date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
      }

      if (label !== currentLabel) {
        groups.push({ label, logs: [] });
        currentLabel = label;
      }
      groups[groups.length - 1].logs.push(log);
    }

    return groups;
  }, [pagedLogs, t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Icon icon="solar:refresh-circle-bold-duotone" className="animate-spin text-primary" width={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("activity.title")}</h1>
        <p className="text-default-400 text-sm mt-1">{t("activity.subtitle")}</p>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardBody className="flex flex-row items-center gap-3 py-3">
            <div className="p-2 rounded-lg text-success bg-success/10">
              <Icon icon="solar:login-2-bold-duotone" width={20} />
            </div>
            <div>
              <p className="text-xs text-default-400">{t("activity.logins")}</p>
              <p className="text-lg font-bold">{actionCounts["login"] || 0}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex flex-row items-center gap-3 py-3">
            <div className="p-2 rounded-lg text-primary bg-primary/10">
              <Icon icon="solar:add-circle-bold-duotone" width={20} />
            </div>
            <div>
              <p className="text-xs text-default-400">{t("activity.added")}</p>
              <p className="text-lg font-bold">{actionCounts["expense_add"] || 0}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex flex-row items-center gap-3 py-3">
            <div className="p-2 rounded-lg text-warning bg-warning/10">
              <Icon icon="solar:pen-bold-duotone" width={20} />
            </div>
            <div>
              <p className="text-xs text-default-400">{t("activity.edited")}</p>
              <p className="text-lg font-bold">{actionCounts["expense_edit"] || 0}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex flex-row items-center gap-3 py-3">
            <div className="p-2 rounded-lg text-danger bg-danger/10">
              <Icon icon="solar:trash-bin-minimalistic-bold-duotone" width={20} />
            </div>
            <div>
              <p className="text-xs text-default-400">{t("activity.deleted_count")}</p>
              <p className="text-lg font-bold">{actionCounts["expense_delete"] || 0}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select
          label={t("activity.filter")}
          placeholder={t("activity.all_actions")}
          selectedKeys={filterAction ? [filterAction] : []}
          onSelectionChange={(keys) => {
            const val = Array.from(keys)[0] as string;
            setFilterAction(val || "");
            setPage(1);
          }}
          className="max-w-xs"
          size="sm"
        >
          {Object.keys(ACTION_CONFIG).map((action) => (
            <SelectItem key={action}>
              {t(`activity.action_${action}`)}
            </SelectItem>
          ))}
        </Select>
        {filterAction && (
          <Chip
            size="sm"
            variant="flat"
            onClose={() => { setFilterAction(""); setPage(1); }}
          >
            {t(`activity.action_${filterAction}`)}
          </Chip>
        )}
        <span className="text-sm text-default-400 ml-auto">
          {filteredLogs.length} {t("activity.events")}
        </span>
      </div>

      {/* Timeline */}
      {filteredLogs.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center">
            <Icon icon="solar:history-bold-duotone" className="text-default-300 mx-auto mb-3" width={48} />
            <p className="text-default-400">{t("activity.no_activity")}</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedByDate.map((group) => (
            <div key={group.label}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm font-semibold text-default-500">{group.label}</span>
                <div className="flex-1 h-px bg-divider" />
              </div>
              <Card>
                <CardBody className="p-0">
                  <div className="divide-y divide-divider">
                    {group.logs.map((log) => {
                      const config = ACTION_CONFIG[log.action] || ACTION_CONFIG.login;
                      const parsed = log.userAgent ? parseUserAgent(log.userAgent) : null;

                      return (
                        <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-default-50 transition-colors">
                          <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${config.colorClass}`}>
                            <Icon icon={config.icon} width={18} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">
                                {t(`activity.action_${log.action}`)}
                              </span>
                              {log.details && (
                                <span className="text-sm text-default-400 truncate">
                                  — {log.details}
                                </span>
                              )}
                            </div>
                            {log.ip && log.ip !== "unknown" && (
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
                                <Tooltip
                                  content={<IpTooltipContent ip={log.ip} />}
                                  delay={300}
                                  classNames={{ content: "p-2" }}
                                >
                                  <span className="flex items-center gap-1 text-xs text-default-400 cursor-help">
                                    <Icon icon="solar:global-bold" width={12} />
                                    {log.ip}
                                  </span>
                                </Tooltip>
                                {parsed && parsed.browser !== "Unknown" && (
                                  <Tooltip
                                    content={
                                      <div className="max-w-[360px] p-1">
                                        <p className="text-xs font-mono break-all">{log.userAgent}</p>
                                      </div>
                                    }
                                    delay={300}
                                    classNames={{ content: "p-2" }}
                                  >
                                    <span className="flex items-center gap-1 text-xs text-default-400 cursor-help">
                                      <Icon icon="solar:monitor-bold" width={12} />
                                      {parsed.browser} / {parsed.os}
                                    </span>
                                  </Tooltip>
                                )}
                              </div>
                            )}
                            {log.metadata && Object.keys(log.metadata).length > 0 && (
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {Object.entries(log.metadata).map(([key, value]) => (
                                  <Chip key={key} size="sm" variant="flat" className="text-xs">
                                    {key}: {value}
                                  </Chip>
                                ))}
                              </div>
                            )}
                          </div>
                          <Tooltip content={new Date(log.timestamp).toLocaleString()}>
                            <span className="text-xs text-default-400 whitespace-nowrap shrink-0 mt-1">
                              {formatRelativeTime(log.timestamp)}
                            </span>
                          </Tooltip>
                        </div>
                      );
                    })}
                  </div>
                </CardBody>
              </Card>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination total={totalPages} page={page} onChange={setPage} showControls />
        </div>
      )}
    </div>
  );
}
