"use client";

import { useTranslation, LOCALES, Locale } from "@/lib/i18n";
import { Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/react";
import { Icon } from "@iconify/react";

export function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();
  const current = LOCALES.find((l) => l.code === locale) || LOCALES[0];

  return (
    <Dropdown placement="bottom-end">
      <DropdownTrigger>
        <Button variant="flat" size="sm" className="gap-1.5 px-2.5 min-w-0">
          <Icon icon={current.flag} width={16} height={16} style={{ borderRadius: "30%" }} />
          <span className="text-sm hidden sm:inline">{current.label}</span>
          <Icon icon="solar:alt-arrow-down-bold" width={14} className="text-default-400" />
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Language"
        selectionMode="single"
        selectedKeys={new Set([locale])}
        onSelectionChange={(keys) => {
          const selected = Array.from(keys)[0] as Locale;
          if (selected) setLocale(selected);
        }}
      >
        {LOCALES.map((l) => (
          <DropdownItem key={l.code} startContent={<Icon icon={l.flag} width={16} height={16} style={{ borderRadius: "30%" }} />}>
            {l.label}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}
