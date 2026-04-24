"use client";

import { useState } from "react";
import { Card, CardBody, CardHeader, Button, Input } from "@heroui/react";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { siteConfig } from "@/config/site";
import { useTranslation } from "@/lib/i18n";

export default function SignInPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      addToast({ title: t("sign_in.fill_fields"), color: "warning" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t("sign_in.login_failed"));
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      addToast({
        title: String(err instanceof Error ? err.message : t("sign_in.login_failed")),
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col items-center gap-2 pt-8 pb-0">
          <Icon icon="solar:wallet-money-bold-duotone" className="text-primary" width={48} />
          <h1 className="text-2xl font-bold">{siteConfig.name}</h1>
          <p className="text-default-400 text-sm">{t("sign_in.title")}</p>
        </CardHeader>
        <CardBody className="px-8 py-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t("sign_in.username")}
              placeholder={t("sign_in.username_placeholder")}
              value={username}
              onValueChange={setUsername}
              startContent={<Icon icon="solar:user-bold" className="text-default-400" width={18} />}
              autoComplete="username"
            />
            <Input
              label={t("sign_in.password")}
              placeholder={t("sign_in.password_placeholder")}
              value={password}
              onValueChange={setPassword}
              type={isVisible ? "text" : "password"}
              startContent={<Icon icon="solar:lock-keyhole-bold" className="text-default-400" width={18} />}
              endContent={
                <button type="button" onClick={() => setIsVisible(!isVisible)}>
                  <Icon
                    icon={isVisible ? "solar:eye-bold" : "solar:eye-closed-bold"}
                    className="text-default-400"
                    width={18}
                  />
                </button>
              }
              autoComplete="current-password"
            />
            <Button
              type="submit"
              color="primary"
              className="w-full"
              isLoading={loading}
              size="lg"
            >
              {t("sign_in.submit")}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
