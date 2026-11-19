"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setLanguage } from "@/actions/user/set-language";
import { toast } from "sonner";

const LANGUAGES = [
  { label: "NL", value: "nl" },
  { label: "FR", value: "fr" },
  { label: "ENG", value: "en" },
] as const;

type Props = {
  userId: string;
};

export function SetLanguage({ userId }: Props) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const current = LANGUAGES.some((language) => language.value === locale) ? locale : "en";

  async function onChange(language: string) {
    if (language === locale || pending) return;
    setPending(true);
    try {
      const result = await setLanguage({ userId, language });
      if (result.error) toast.error(result.error);
      router.replace(pathname, { locale: language });
    } catch {
      toast.error("Error changing language");
      setPending(false);
    }
  }

  return (
    <Select value={current} onValueChange={onChange} disabled={pending}>
      <SelectTrigger aria-label="NL FR ENG" className="h-9 w-[5.75rem]" data-testid="language-switch">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LANGUAGES.map((language) => (
          <SelectItem key={language.value} value={language.value}>
            {language.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
