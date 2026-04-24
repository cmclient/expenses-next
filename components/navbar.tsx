"use client";

import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Button,
} from "@heroui/react";
import { ThemeSwitch } from "@/components/theme-switch";
import { LanguageSwitcher } from "@/components/language-switcher";
import { siteConfig } from "@/config/site";
import { useTranslation } from "@/lib/i18n";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const navKeys = [
  { key: "nav.dashboard", href: "/dashboard", icon: "solar:chart-2-bold-duotone" },
  { key: "nav.transactions", href: "/transactions", icon: "solar:document-text-bold-duotone" },
  { key: "nav.recurring", href: "/recurring", icon: "solar:refresh-circle-bold-duotone" },
  { key: "nav.reminders", href: "/reminders", icon: "solar:bell-bold-duotone" },
  { key: "nav.stats", href: "/stats", icon: "solar:graph-up-bold-duotone" },
  { key: "nav.settings", href: "/settings", icon: "solar:settings-bold-duotone" },
];

interface UserSession {
  userId: string;
  username: string;
  isAdmin: boolean;
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const [user, setUser] = useState<UserSession | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {});
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.avatar) setAvatar(data.avatar);
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/sign-in");
    router.refresh();
  };

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-divider bg-background/80 backdrop-blur-lg px-4 md:px-8 h-16">
      <div className="flex items-center gap-3">
        <Icon icon="solar:wallet-money-bold-duotone" className="text-primary" width={28} />
        <span className="font-bold text-lg hidden sm:block">{siteConfig.name}</span>
      </div>
      <div className="flex items-center gap-1 md:gap-2">
        {navKeys.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname === item.href || pathname.startsWith(item.href + "/")
                ? "bg-primary/10 text-primary"
                : "text-default-500 hover:text-foreground hover:bg-default-100"
            }`}
          >
            <Icon icon={item.icon} width={18} />
            <span className="hidden md:inline">{t(item.key)}</span>
          </Link>
        ))}
        {user?.isAdmin && (
          <Link
            href="/admin"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname === "/admin"
                ? "bg-warning/10 text-warning"
                : "text-default-500 hover:text-foreground hover:bg-default-100"
            }`}
          >
            <Icon icon="solar:shield-user-bold-duotone" width={18} />
            <span className="hidden md:inline">{t("nav.admin")}</span>
          </Link>
        )}
      </div>
      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeSwitch />
        {user && (
          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <Button variant="light" size="sm" className="gap-1.5">
                <Icon icon={avatar || "solar:user-circle-bold"} width={20} />
                <span className="hidden sm:inline text-sm">{user.username}</span>
              </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="User menu">
              <DropdownItem key="info" isReadOnly className="opacity-100">
                <p className="text-xs text-default-400">{t("user_menu.signed_in_as")}</p>
                <p className="font-medium">{user.username}</p>
              </DropdownItem>
              <DropdownItem
                key="profile"
                startContent={<Icon icon="solar:user-id-bold" width={16} />}
                onPress={() => router.push("/profile")}
              >
                {t("profile.title")}
              </DropdownItem>
              <DropdownItem
                key="logout"
                color="danger"
                startContent={<Icon icon="solar:logout-2-bold" width={16} />}
                onPress={handleLogout}
              >
                {t("user_menu.sign_out")}
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        )}
      </div>
    </nav>
  );
}
