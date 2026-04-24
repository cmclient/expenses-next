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
  "solar:bicycle-bold-duotone",
];

interface UserProfile {
  id: string;
  username: string;
  isAdmin: boolean;
  avatar: string | null;
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
                <Icon icon="solar:fingerprint-bold" width={16} className="text-default-400" />
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
    </div>
  );
}
