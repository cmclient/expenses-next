"use client";

import { useTranslation } from "@/lib/i18n";

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-divider py-4 text-center text-xs text-default-400">
      &copy; Spacehost 2026. {t("footer.rights")}
    </footer>
  );
}
