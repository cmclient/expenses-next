"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Select,
  SelectItem,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Checkbox,
} from "@heroui/react";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { Reminder, AppConfig, VALID_INTERVALS } from "@/lib/types";
import { formatCurrency, formatDate, toDateTimeLocal } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function getStatus(reminder: Reminder): "paid" | "unpaid" | "overdue" {
  if (reminder.paid) return "paid";
  const now = new Date();
  const due = new Date(reminder.nextDueDate);
  const diffMs = due.getTime() - now.getTime();
  if (diffMs <= 0) return "overdue";
  if (diffMs <= 24 * 60 * 60 * 1000) return "unpaid";
  return "unpaid"; // default state when not yet paid
}

function getTimeDisplay(reminder: Reminder): string {
  const now = new Date();
  const due = new Date(reminder.nextDueDate);
  const diffMs = due.getTime() - now.getTime();

  if (diffMs <= 0) {
    // Overdue
    const absDiff = Math.abs(diffMs);
    const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((absDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h overdue`;
    return `${hours}h overdue`;
  }

  // Time left
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d left`;
  return `${hours}h ${Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))}m left`;
}

function getStatusColor(status: "paid" | "unpaid" | "overdue") {
  switch (status) {
    case "paid":
      return "success";
    case "unpaid":
      return "warning";
    case "overdue":
      return "danger";
  }
}

export default function RemindersContent() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form
  const [name, setName] = useState("");
  const [payer, setPayer] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [intervalAmount, setIntervalAmount] = useState("1");
  const [intervalType, setIntervalType] = useState<string>("monthly");
  const [startDate, setStartDate] = useState(toDateTimeLocal());
  const [submitting, setSubmitting] = useState(false);

  // Alert settings
  const [alertBrowser, setAlertBrowser] = useState(false);
  const [alertEmail, setAlertEmail] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [alertDiscord, setAlertDiscord] = useState(false);
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState("");
  const [discordUsername, setDiscordUsername] = useState("");
  const [discordAvatarUrl, setDiscordAvatarUrl] = useState("");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushToggleLoading, setPushToggleLoading] = useState(false);

  // Delete modal
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Time refresh
  const [tick, setTick] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const [configRes, remindersRes] = await Promise.all([
        fetch("/api/config"),
        fetch("/api/reminders"),
      ]);
      const configData = await configRes.json();
      const remindersData = await remindersRes.json();
      setConfig(configData);
      setReminders(remindersData.reminders || []);
    } catch {
      addToast({ title: t("reminders.failed_load"), color: "danger" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refresh time display every minute
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const currency = config?.currency || "usd";

  const ensurePushSubscription = useCallback(async (): Promise<boolean> => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return false;
    }

    try {
      const keyRes = await fetch("/api/push/public-key", { cache: "no-store" });
      if (!keyRes.ok) return false;
      const keyData = await keyRes.json();
      if (!keyData?.publicKey) return false;

      const registration = await navigator.serviceWorker.register("/sw.js");
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(String(keyData.publicKey)) as BufferSource,
        });
      }

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });

      return res.ok;
    } catch {
      return false;
    }
  }, []);

  const hasActivePushSubscription = useCallback(async (): Promise<boolean> => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

    try {
      const registration = (await navigator.serviceWorker.getRegistration("/sw.js")) || (await navigator.serviceWorker.ready);
      const subscription = await registration.pushManager.getSubscription();
      return !!subscription;
    } catch {
      return false;
    }
  }, []);

  const disablePushSubscription = useCallback(async (): Promise<boolean> => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

    try {
      const registration = (await navigator.serviceWorker.getRegistration("/sw.js")) || (await navigator.serviceWorker.ready);
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      } else {
        await fetch("/api/push/subscribe", { method: "DELETE" });
      }

      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    ensurePushSubscription();
  }, [ensurePushSubscription]);

  useEffect(() => {
    hasActivePushSubscription().then(setPushEnabled);
  }, [hasActivePushSubscription]);

  const requestBrowserNotificationPermission = async () => {
    if (!("Notification" in window)) {
      addToast({ title: t("reminders.browser_not_supported"), color: "warning" });
      return false;
    }
    if (Notification.permission === "granted") {
      return ensurePushSubscription();
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const subscribed = await ensurePushSubscription();
    if (!subscribed) {
      addToast({ title: "Failed to enable push notifications", color: "warning" });
      return false;
    }
    setPushEnabled(true);
    return true;
  };

  const handlePushToggle = async (enabled: boolean) => {
    if (pushToggleLoading) return;
    setPushToggleLoading(true);

    try {
      if (enabled) {
        const granted = await requestBrowserNotificationPermission();
        if (!granted) {
          setPushEnabled(false);
          addToast({ title: t("reminders.browser_permission_denied"), color: "warning" });
        } else {
          setPushEnabled(true);
          addToast({ title: t("reminders.push_enabled"), color: "success" });
        }
      } else {
        const disabled = await disablePushSubscription();
        if (!disabled) {
          addToast({ title: t("reminders.push_disable_failed"), color: "danger" });
          setPushEnabled(true);
        } else {
          setPushEnabled(false);
          addToast({ title: t("reminders.push_disabled"), color: "success" });
        }
      }
    } finally {
      setPushToggleLoading(false);
    }
  };

  // Foreground-only browser notifications when background push is disabled.
  useEffect(() => {
    if (pushEnabled) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    for (const reminder of reminders) {
      if (!reminder.alerts.browser || reminder.paid) continue;

      const due = new Date(reminder.nextDueDate);
      const inDueWindow = due.getTime() - now.getTime() <= 24 * 60 * 60 * 1000;
      if (!inDueWindow) continue;

      const marker = `reminder-foreground-alert:${reminder.id}:${todayKey}`;
      if (window.localStorage.getItem(marker)) continue;

      const overdue = due.getTime() <= now.getTime();
      new Notification(overdue ? `Overdue: ${reminder.name}` : `Due Soon: ${reminder.name}`, {
        body: `${reminder.payer} owes ${formatCurrency(reminder.amount, reminder.currency)} (${reminder.category})`,
        tag: `foreground-${reminder.id}-${todayKey}`,
      });

      window.localStorage.setItem(marker, now.toISOString());
    }
  }, [pushEnabled, reminders, tick]);

  const handleAdd = async () => {
    if (!name.trim() || !payer.trim() || !category || !amount || !startDate) {
      addToast({ title: t("reminders.fill_fields"), color: "warning" });
      return;
    }

    if (alertBrowser) {
      const granted = await requestBrowserNotificationPermission();
      if (!granted) {
        addToast({ title: t("reminders.browser_permission_denied"), color: "warning" });
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/reminders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          payer: payer.trim(),
          amount: parseFloat(amount),
          category,
          intervalAmount: parseInt(intervalAmount) || 1,
          intervalType,
          startDate: new Date(startDate).toISOString(),
          alerts: {
            browser: alertBrowser,
            email: alertEmail,
            emailAddress: emailAddress.trim(),
            discord: alertDiscord,
            discordWebhookUrl: discordWebhookUrl.trim(),
            discordUsername: discordUsername.trim(),
            discordAvatarUrl: discordAvatarUrl.trim(),
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      addToast({ title: t("reminders.created"), color: "success" });
      setName("");
      setPayer("");
      setAmount("");
      setIntervalAmount("1");
      setAlertBrowser(false);
      setAlertEmail(false);
      setEmailAddress("");
      setAlertDiscord(false);
      setDiscordWebhookUrl("");
      setDiscordUsername("");
      setDiscordAvatarUrl("");
      fetchData();
    } catch (err: unknown) {
      addToast({ title: String(err instanceof Error ? err.message : t("reminders.failed_load")), color: "danger" });
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = (id: string) => {
    setDeleteId(id);
    onOpen();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/reminders?id=${encodeURIComponent(deleteId)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      addToast({ title: t("reminders.deleted"), color: "success" });
      onClose();
      fetchData();
    } catch {
      addToast({ title: t("reminders.delete_failed"), color: "danger" });
    }
  };

  const handleConfirmPayment = async (id: string) => {
    try {
      const res = await fetch("/api/reminders/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error();
      addToast({ title: t("reminders.payment_confirmed"), color: "success" });
      fetchData();
    } catch {
      addToast({ title: t("reminders.confirm_failed"), color: "danger" });
    }
  };

  if (loading || !config)
    return (
      <div className="flex items-center justify-center h-96">
        <Icon icon="solar:loading-bold-duotone" className="animate-spin text-primary" width={48} />
      </div>
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("reminders.title")}</h1>
        <p className="text-default-400 text-sm">{t("reminders.subtitle")}</p>
      </div>

      {/* Add Form */}
      <Card>
        <CardHeader className="font-semibold text-lg">{t("reminders.add_title")}</CardHeader>
        <CardBody className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label={t("common.name")}
              placeholder={t("reminders.name_placeholder")}
              value={name}
              onValueChange={setName}
            />
            <Input
              label={t("reminders.payer")}
              placeholder={t("reminders.payer_placeholder")}
              value={payer}
              onValueChange={setPayer}
            />
            <Select
              label={t("common.category")}
              placeholder={t("reminders.select_category")}
              selectedKeys={category ? [category] : []}
              onSelectionChange={(keys) => setCategory(Array.from(keys)[0] as string)}
            >
              {config.categories.map((c) => (
                <SelectItem key={c}>{c}</SelectItem>
              ))}
            </Select>
            <Input
              label={t("common.amount")}
              type="number"
              placeholder={t("reminders.amount_placeholder")}
              value={amount}
              onValueChange={setAmount}
            />
            <div className="flex gap-2">
              <Input
                label={t("reminders.interval_every")}
                type="number"
                min={1}
                value={intervalAmount}
                onValueChange={setIntervalAmount}
                className="w-28"
              />
              <Select
                label={t("reminders.interval_type")}
                selectedKeys={[intervalType]}
                onSelectionChange={(keys) => setIntervalType(Array.from(keys)[0] as string)}
                className="flex-1"
              >
                {VALID_INTERVALS.map((i) => (
                  <SelectItem key={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</SelectItem>
                ))}
              </Select>
            </div>
            <Input
              label={t("reminders.start_date")}
              type="datetime-local"
              placeholder="YYYY-MM-DDThh:mm"
              value={startDate}
              onValueChange={setStartDate}
            />
          </div>

          {/* Alert Configuration */}
          <div className="space-y-3 pt-2">
            <p className="text-sm font-semibold text-default-600">{t("reminders.alert_types")}</p>

            <div className="space-y-1 rounded-medium border border-divider px-3 py-2">
              <Checkbox isSelected={pushEnabled} isDisabled={pushToggleLoading} onValueChange={handlePushToggle}>
                <div className="flex items-center gap-1.5">
                  <Icon icon="solar:bell-bing-bold-duotone" width={16} />
                  {t("reminders.push_background")}
                </div>
              </Checkbox>
              <p className="text-xs text-default-500 ml-7">{t("reminders.push_background_hint")}</p>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox isSelected={alertBrowser} onValueChange={setAlertBrowser}>
                <div className="flex items-center gap-1.5">
                  <Icon icon="solar:bell-bold-duotone" width={16} />
                  {t("reminders.browser_notification")}
                </div>
              </Checkbox>
            </div>

            <div className="space-y-2">
              <Checkbox isSelected={alertEmail} onValueChange={setAlertEmail}>
                <div className="flex items-center gap-1.5">
                  <Icon icon="solar:letter-bold-duotone" width={16} />
                  {t("reminders.email_notification")}
                </div>
              </Checkbox>
              {alertEmail && (
                <Input
                  label={t("reminders.email_address")}
                  type="email"
                  placeholder="user@example.com"
                  value={emailAddress}
                  onValueChange={setEmailAddress}
                  className="ml-7"
                />
              )}
            </div>

            <div className="space-y-2">
              <Checkbox isSelected={alertDiscord} onValueChange={setAlertDiscord}>
                <div className="flex items-center gap-1.5">
                  <Icon icon="ic:baseline-discord" width={16} />
                  {t("reminders.discord_webhook")}
                </div>
              </Checkbox>
              {alertDiscord && (
                <div className="ml-7 space-y-2">
                  <Input
                    label={t("reminders.discord_url")}
                    placeholder="https://discord.com/api/webhooks/..."
                    value={discordWebhookUrl}
                    onValueChange={setDiscordWebhookUrl}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <Input
                      label={t("reminders.discord_username")}
                      placeholder={t("reminders.discord_username_placeholder")}
                      value={discordUsername}
                      onValueChange={setDiscordUsername}
                    />
                    <Input
                      label={t("reminders.discord_avatar")}
                      placeholder="https://example.com/avatar.png"
                      value={discordAvatarUrl}
                      onValueChange={setDiscordAvatarUrl}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button color="primary" isLoading={submitting} onPress={handleAdd}>
              <Icon icon="solar:add-circle-bold" width={18} />
              {t("reminders.add_reminder")}
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Active Reminders List */}
      <Card>
        <CardHeader className="font-semibold text-lg flex items-center justify-between">
          <span>{t("reminders.active_reminders")}</span>
          <Chip size="sm" variant="flat">{reminders.length}</Chip>
        </CardHeader>
        <CardBody className="p-0">
          {reminders.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-default-400">
              <Icon icon="solar:bell-off-line-duotone" width={48} />
              <p>{t("reminders.no_reminders")}</p>
            </div>
          ) : (
            <div className="divide-y divide-divider">
              {reminders.map((r) => {
                const status = getStatus(r);
                const timeDisplay = getTimeDisplay(r);

                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between px-4 py-4 hover:bg-default-50 transition-colors"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{r.name}</span>
                        <Chip size="sm" variant="flat" color="secondary">
                            <Icon icon="solar:user-bold" width={12} className="mr-1 inline" />
                            {r.payer}
                        </Chip>
                        <Chip size="sm" variant="flat" color="primary">
                          {r.intervalAmount > 1 ? `${r.intervalAmount}x ` : ""}{r.intervalType}
                        </Chip>
                        <Chip size="sm" variant="flat">{r.category}</Chip>
                        <Chip size="sm" variant="flat" color={getStatusColor(status)}>
                          {status === "paid" ? t("reminders.status_paid") : status === "unpaid" ? t("reminders.status_unpaid") : t("reminders.status_overdue")}
                        </Chip>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-default-400 flex-wrap">
                        <span>{t("reminders.due")}: {formatDate(r.nextDueDate)}</span>
                        {timeDisplay && (
                          <>
                            <span>&middot;</span>
                            <span className={status === "overdue" ? "text-danger font-medium" : status === "unpaid" ? "text-warning font-medium" : ""}>
                              {status === "overdue" ? `${t("reminders.overdue_by")}: ${timeDisplay.replace(" overdue", "")}` : timeDisplay}
                            </span>
                          </>
                        )}
                        {/* Alert icons */}
                        <span>&middot;</span>
                        <span className="flex items-center gap-1">
                          {r.alerts.browser && <Icon icon="solar:bell-bold-duotone" width={12} className="text-primary" />}
                          {r.alerts.email && <Icon icon="solar:letter-bold-duotone" width={12} className="text-primary" />}
                          {r.alerts.discord && <Icon icon="ic:baseline-discord" width={12} className="text-primary" />}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-4 shrink-0">
                      <span className="font-semibold text-success">
                        {formatCurrency(r.amount, r.currency || currency)}
                      </span>
                      {!r.paid && (
                        <Button
                          size="sm"
                          color="success"
                          variant="flat"
                          onPress={() => handleConfirmPayment(r.id)}
                        >
                          <Icon icon="solar:check-circle-bold" width={16} />
                          {t("reminders.confirm_payment")}
                        </Button>
                      )}
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        onPress={() => confirmDelete(r.id)}
                      >
                        <Icon icon="solar:trash-bin-minimalistic-bold" width={16} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader>{t("reminders.delete_title")}</ModalHeader>
          <ModalBody>
            <p className="text-default-500">{t("reminders.delete_question")}</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onClose}>{t("common.cancel")}</Button>
            <Button color="danger" onPress={handleDelete}>{t("common.delete")}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
