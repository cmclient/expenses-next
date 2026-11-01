"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Divider,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/react";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { useTranslation } from "@/lib/i18n";

const AVATAR_OPTIONS = [
  "solar:user-circle-bold-duotone",
  "solar:cat-bold-duotone",
  "solar:ghost-bold-duotone",
  "solar:star-bold-duotone",
  "solar:heart-bold-duotone",
  "solar:crown-bold-duotone",
  "solar:fire-bold-duotone",
  "solar:rocket-bold-duotone",
  "solar:music-note-bold-duotone",
  "solar:gamepad-bold-duotone",
  "solar:cup-hot-bold-duotone",
  "solar:leaf-bold-duotone",
  "solar:palette-bold-duotone",
  "solar:bolt-circle-bold-duotone",
  "solar:planet-bold-duotone",
  "solar:shield-user-bold-duotone",
  "solar:compass-bold-duotone",
  "solar:camera-bold-duotone",
  "solar:headphones-round-bold-duotone",
  "solar:skateboarding-bold-duotone",
];

interface UserProfile {
  id: string;
  username: string;
  isAdmin: boolean;
  avatar: string | null;
  has2fa: boolean;
  backupCodesRemaining: number;
  createdAt: string;
  updatedAt: string;
}

export default function ProfileContent() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Avatar
  const [savingAvatar, setSavingAvatar] = useState(false);

  // 2FA
  const [show2faModal, setShow2faModal] = useState(false);
  const [twoFaStep, setTwoFaStep] = useState<"start" | "verify" | "done">("start");
  const [twoFaQr, setTwoFaQr] = useState("");
  const [twoFaSecret, setTwoFaSecret] = useState("");
  const [twoFaCode, setTwoFaCode] = useState("");
  const [twoFaBackupCodes, setTwoFaBackupCodes] = useState<string[]>([]);
  const [twoFaLoading, setTwoFaLoading] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProfile(data);
    } catch {
      addToast({ title: t("profile.failed_load"), color: "danger" });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleAvatarChange = async (icon: string) => {
    setSavingAvatar(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: icon }),
      });
      if (!res.ok) throw new Error();
      setProfile((p) => (p ? { ...p, avatar: icon } : p));
      addToast({ title: t("profile.avatar_updated"), color: "success" });
    } catch {
      addToast({ title: t("profile.avatar_update_failed"), color: "danger" });
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      addToast({ title: t("profile.fill_password_fields"), color: "warning" });
      return;
    }
    if (newPassword.length < 6) {
      addToast({ title: t("profile.password_min_length"), color: "warning" });
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast({ title: t("profile.passwords_dont_match"), color: "warning" });
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t("profile.password_change_failed"));
      }
      addToast({ title: t("profile.password_changed"), color: "success" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      addToast({
        title: String(err instanceof Error ? err.message : t("profile.password_change_failed")),
        color: "danger",
      });
    } finally {
      setChangingPassword(false);
    }
  };

  // 2FA handlers
  const handleStart2fa = async () => {
    setTwoFaLoading(true);
    try {
      const res = await fetch("/api/user/2fa", { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTwoFaQr(data.qr);
      setTwoFaSecret(data.secret);
      setTwoFaStep("verify");
    } catch {
      addToast({ title: t("profile.2fa_setup_failed"), color: "danger" });
    } finally {
      setTwoFaLoading(false);
    }
  };

  const handleVerify2fa = async () => {
    if (!twoFaCode || twoFaCode.length !== 6) {
      addToast({ title: t("profile.2fa_enter_code"), color: "warning" });
      return;
    }
    setTwoFaLoading(true);
    try {
      const res = await fetch("/api/user/2fa", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: twoFaCode }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t("profile.2fa_verify_failed"));
      }
      const data = await res.json();
      setTwoFaBackupCodes(data.backupCodes);
      setTwoFaStep("done");
      setProfile((p) => (p ? { ...p, has2fa: true, backupCodesRemaining: 10 } : p));
      addToast({ title: t("profile.2fa_enabled"), color: "success" });
    } catch (err: unknown) {
      addToast({
        title: String(err instanceof Error ? err.message : t("profile.2fa_verify_failed")),
        color: "danger",
      });
    } finally {
      setTwoFaLoading(false);
    }
  };

  const handleDisable2fa = async () => {
    setTwoFaLoading(true);
    try {
      const res = await fetch("/api/user/2fa", { method: "DELETE" });
      if (!res.ok) throw new Error();
      setProfile((p) => (p ? { ...p, has2fa: false, backupCodesRemaining: 0 } : p));
      addToast({ title: t("profile.2fa_disabled"), color: "success" });
    } catch {
      addToast({ title: t("profile.2fa_disable_failed"), color: "danger" });
    } finally {
      setTwoFaLoading(false);
    }
  };

  const close2faModal = () => {
    setShow2faModal(false);
    setTwoFaStep("start");
    setTwoFaQr("");
    setTwoFaSecret("");
    setTwoFaCode("");
    setTwoFaBackupCodes([]);
  };

  const handleDownloadBackupCodes = () => {
    const text = `Expenses - 2FA Backup Codes\n${"=".repeat(30)}\n\n${twoFaBackupCodes.join("\n")}\n\nKeep these codes safe. Each can only be used once.`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "expenses-2fa-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading || !profile)
    return (
      <div className="flex items-center justify-center h-96">
        <Icon icon="solar:loading-bold-duotone" className="animate-spin text-primary" width={48} />
      </div>
    );

  const currentAvatar = profile.avatar || "solar:user-circle-bold-duotone";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("profile.title")}</h1>
        <p className="text-default-400 text-sm">{t("profile.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Info */}
        <Card>
          <CardHeader className="font-semibold text-lg">
            <Icon icon="solar:user-id-bold-duotone" className="text-primary mr-2" width={20} />
            {t("profile.user_info")}
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-primary/10 p-4">
                <Icon icon={currentAvatar} className="text-primary" width={48} />
              </div>
              <div>
                <p className="text-xl font-bold">{profile.username}</p>
                <div className="flex items-center gap-2 mt-1">
                  {profile.isAdmin && (
                    <Chip size="sm" color="warning" variant="flat">
                      {t("profile.admin")}
                    </Chip>
                  )}
                </div>
              </div>
            </div>
            <Divider />
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Icon icon="solar:user-bold" width={16} className="text-default-400" />
                <span className="text-default-400">{t("profile.username")}:</span>
                <span className="font-medium">{profile.username}</span>
              </div>
              <div className="flex items-center gap-2">
                <Icon icon="solar:hashtag-bold" width={16} className="text-default-400" />
                <span className="text-default-400">{t("profile.user_id")}:</span>
                <span className="font-mono text-xs">{profile.id}</span>
              </div>
              <div className="flex items-center gap-2">
                <Icon icon="solar:calendar-bold" width={16} className="text-default-400" />
                <span className="text-default-400">{t("profile.created")}:</span>
                <span>{new Date(profile.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <Icon icon="solar:clock-circle-bold" width={16} className="text-default-400" />
                <span className="text-default-400">{t("profile.last_updated")}:</span>
                <span>{new Date(profile.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader className="font-semibold text-lg">
            <Icon icon="solar:lock-keyhole-bold-duotone" className="text-primary mr-2" width={20} />
            {t("profile.change_password")}
          </CardHeader>
          <CardBody className="space-y-3">
            <Input
              label={t("profile.current_password")}
              type={showCurrentPw ? "text" : "password"}
              value={currentPassword}
              onValueChange={setCurrentPassword}
              endContent={
                <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)}>
                  <Icon
                    icon={showCurrentPw ? "solar:eye-bold" : "solar:eye-closed-bold"}
                    className="text-default-400"
                    width={18}
                  />
                </button>
              }
            />
            <Input
              label={t("profile.new_password")}
              type={showNewPw ? "text" : "password"}
              value={newPassword}
              onValueChange={setNewPassword}
              description={t("profile.password_min_hint")}
              endContent={
                <button type="button" onClick={() => setShowNewPw(!showNewPw)}>
                  <Icon
                    icon={showNewPw ? "solar:eye-bold" : "solar:eye-closed-bold"}
                    className="text-default-400"
                    width={18}
                  />
                </button>
              }
            />
            <Input
              label={t("profile.confirm_password")}
              type="password"
              value={confirmPassword}
              onValueChange={setConfirmPassword}
            />
            <div className="flex justify-end">
              <Button
                color="primary"
                isLoading={changingPassword}
                onPress={handleChangePassword}
              >
                <Icon icon="solar:key-bold" width={16} />
                {t("profile.update_password")}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Two-Factor Authentication */}
      <Card>
        <CardHeader className="font-semibold text-lg">
          <Icon icon="solar:shield-keyhole-bold-duotone" className="text-primary mr-2" width={20} />
          {t("profile.2fa_title")}
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{t("profile.2fa_status")}:</span>
                <Chip
                  size="sm"
                  color={profile.has2fa ? "success" : "default"}
                  variant="flat"
                >
                  {profile.has2fa ? t("profile.2fa_enabled_label") : t("profile.2fa_disabled_label")}
                </Chip>
              </div>
              {profile.has2fa && (
                <p className="text-sm text-default-400">
                  {t("profile.2fa_backup_remaining", { count: profile.backupCodesRemaining })}
                </p>
              )}
            </div>
            <div>
              {profile.has2fa ? (
                <Button
                  color="danger"
                  variant="flat"
                  isLoading={twoFaLoading}
                  onPress={handleDisable2fa}
                >
                  <Icon icon="solar:shield-cross-bold" width={16} />
                  {t("profile.2fa_disable")}
                </Button>
              ) : (
                <Button
                  color="primary"
                  onPress={() => setShow2faModal(true)}
                >
                  <Icon icon="solar:shield-plus-bold" width={16} />
                  {t("profile.2fa_enable")}
                </Button>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Avatar Picker */}
      <Card>
        <CardHeader className="font-semibold text-lg">
          <Icon icon="solar:emoji-funny-circle-bold-duotone" className="text-primary mr-2" width={20} />
          {t("profile.choose_avatar")}
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
            {AVATAR_OPTIONS.map((icon) => (
              <button
                key={icon}
                type="button"
                disabled={savingAvatar}
                onClick={() => handleAvatarChange(icon)}
                className={`flex items-center justify-center p-3 rounded-xl transition-all ${
                  currentAvatar === icon
                    ? "bg-primary/20 ring-2 ring-primary scale-110"
                    : "bg-default-100 hover:bg-default-200 hover:scale-105"
                }`}
              >
                <Icon icon={icon} width={32} className={currentAvatar === icon ? "text-primary" : "text-default-600"} />
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* 2FA Setup Modal */}
      <Modal isOpen={show2faModal} onClose={close2faModal} size="lg">
        <ModalContent>
          <ModalHeader>
            <Icon icon="solar:shield-keyhole-bold-duotone" className="text-primary mr-2" width={24} />
            {t("profile.2fa_setup_title")}
          </ModalHeader>
          <ModalBody>
            {twoFaStep === "start" && (
              <div className="text-center space-y-4">
                <Icon icon="solar:shield-keyhole-bold-duotone" className="text-primary mx-auto" width={64} />
                <p className="text-default-600">{t("profile.2fa_setup_description")}</p>
                <Button
                  color="primary"
                  onPress={handleStart2fa}
                  isLoading={twoFaLoading}
                  size="lg"
                >
                  {t("profile.2fa_start_setup")}
                </Button>
              </div>
            )}

            {twoFaStep === "verify" && (
              <div className="space-y-4">
                <p className="text-sm text-default-600">{t("profile.2fa_scan_qr")}</p>
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={twoFaQr} alt="QR Code" className="w-48 h-48 rounded-lg" />
                </div>
                <Divider />
                <div className="space-y-2">
                  <p className="text-sm font-medium">{t("profile.2fa_manual_entry")}:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 bg-default-100 rounded text-xs font-mono break-all">
                      {twoFaSecret}
                    </code>
                    <Button
                      size="sm"
                      variant="flat"
                      onPress={() => {
                        navigator.clipboard.writeText(twoFaSecret);
                        addToast({ title: t("profile.2fa_secret_copied"), color: "success" });
                      }}
                    >
                      <Icon icon="solar:copy-bold" width={16} />
                    </Button>
                  </div>
                </div>
                <Divider />
                <Input
                  label={t("profile.2fa_verification_code")}
                  placeholder="000000"
                  value={twoFaCode}
                  onValueChange={setTwoFaCode}
                  maxLength={6}
                  autoFocus
                />
                <Button
                  color="primary"
                  className="w-full"
                  onPress={handleVerify2fa}
                  isLoading={twoFaLoading}
                >
                  {t("profile.2fa_verify_enable")}
                </Button>
              </div>
            )}

            {twoFaStep === "done" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-success">
                  <Icon icon="solar:check-circle-bold" width={24} />
                  <span className="font-medium">{t("profile.2fa_setup_complete")}</span>
                </div>
                <p className="text-sm text-default-600">{t("profile.2fa_backup_description")}</p>
                <div className="grid grid-cols-2 gap-2 p-4 bg-default-100 rounded-lg">
                  {twoFaBackupCodes.map((code, i) => (
                    <code key={i} className="text-sm font-mono text-center p-1">
                      {code}
                    </code>
                  ))}
                </div>
                <Button
                  variant="flat"
                  className="w-full"
                  onPress={handleDownloadBackupCodes}
                >
                  <Icon icon="solar:download-bold" width={16} />
                  {t("profile.2fa_download_codes")}
                </Button>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={close2faModal}>
              {t("common.cancel")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
