"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Switch } from "@heroui/react";
import { Icon } from "@iconify/react";

export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <Switch
      isSelected={theme === "dark"}
      onValueChange={(v) => setTheme(v ? "dark" : "light")}
      size="sm"
      thumbIcon={({ isSelected }) =>
        isSelected ? (
          <Icon icon="solar:moon-bold" className="text-default-500" width={14} />
        ) : (
          <Icon icon="solar:sun-bold" className="text-warning" width={14} />
        )
      }
    />
  );
}
