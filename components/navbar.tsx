"use client";

import { useEffect, useState, useCallback } from "react";
import { Icon } from "@iconify/react";
import {
  Navbar as HeroNavbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenuToggle,
  NavbarMenu,
  NavbarMenuItem,
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/sign-in");
    router.refresh();
  }, [router]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <HeroNavbar
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={setIsMenuOpen}
      isBordered
      maxWidth="full"
      classNames={{
        wrapper: "px-4 md:px-8",
      }}
    >
      <NavbarContent justify="start">
        <NavbarMenuToggle className="md:hidden" aria-label={isMenuOpen ? "Close menu" : "Open menu"} />
        <NavbarBrand className="gap-3">
          <Icon icon="solar:wallet-money-bold-duotone" className="text-primary" width={28} />
          <span className="font-bold text-lg hidden sm:block">{siteConfig.name}</span>
        </NavbarBrand>
      </NavbarContent>

      {/* Desktop nav */}
      <NavbarContent className="hidden md:flex gap-2" justify="center">
        {navKeys.map((item) => (
          <NavbarItem key={item.href} isActive={isActive(item.href)}>
            <Link
              href={item.href}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-primary/10 text-primary"
                  : "text-default-500 hover:text-foreground hover:bg-default-100"
              }`}
            >
              <Icon icon={item.icon} width={18} />
              <span>{t(item.key)}</span>
            </Link>
          </NavbarItem>
        ))}
        {user?.isAdmin && (
          <NavbarItem isActive={pathname.startsWith("/admin")}>
            <Link
              href="/admin"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname.startsWith("/admin")
                  ? "bg-warning/10 text-warning"
                  : "text-default-500 hover:text-foreground hover:bg-default-100"
              }`}
            >
              <Icon icon="solar:shield-user-bold-duotone" width={18} />
              <span>{t("nav.admin")}</span>
            </Link>
          </NavbarItem>
        )}
      </NavbarContent>

      <NavbarContent justify="end" className="gap-2">
        <NavbarItem>
          <LanguageSwitcher />
        </NavbarItem>
        <NavbarItem>
          <ThemeSwitch />
        </NavbarItem>
        {user && (
          <NavbarItem>
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
                  key="activity"
                  startContent={<Icon icon="solar:history-bold" width={16} />}
                  onPress={() => router.push("/activity")}
                >
                  {t("nav.activity")}
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
          </NavbarItem>
        )}
      </NavbarContent>

      {/* Mobile menu */}
      <NavbarMenu>
        {navKeys.map((item) => (
          <NavbarMenuItem key={item.href} isActive={isActive(item.href)}>
            <Link
              href={item.href}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-primary/10 text-primary"
                  : "text-default-500 hover:text-foreground hover:bg-default-100"
              }`}
            >
              <Icon icon={item.icon} width={20} />
              <span>{t(item.key)}</span>
            </Link>
          </NavbarMenuItem>
        ))}
        {user?.isAdmin && (
          <NavbarMenuItem isActive={pathname.startsWith("/admin")}>
            <Link
              href="/admin"
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                pathname.startsWith("/admin")
                  ? "bg-warning/10 text-warning"
                  : "text-default-500 hover:text-foreground hover:bg-default-100"
              }`}
            >
              <Icon icon="solar:shield-user-bold-duotone" width={20} />
              <span>{t("nav.admin")}</span>
            </Link>
          </NavbarMenuItem>
        )}
      </NavbarMenu>
    </HeroNavbar>
  );
}
