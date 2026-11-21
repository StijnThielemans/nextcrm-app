"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import React, { useState } from "react";

const FulltextSearch = () => {
  const [search, setSearch] = useState("");
  const router = useRouter();
  const t = useTranslations("Header");

  const handleSearch = async () => {
    router.push(`/fulltext-search?q=${encodeURIComponent(search)}`);
    setSearch("");
  };

  return (
    <div className="relative w-full max-w-md">
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        placeholder={t("searchPlaceholder")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSearch();
        }}
        className="h-10 rounded-full border-black/[0.08] bg-[hsl(var(--canvas))] pl-9 pr-24 shadow-none dark:border-white/10"
      />
      <Button
        type="button"
        variant="ghost"
        className="absolute right-1 top-1/2 h-8 -translate-y-1/2 rounded-full px-3 text-muted-foreground"
        onClick={handleSearch}
      >
        <span className="hidden sm:inline">{t("searchButton")}</span>
        <SearchIcon className="sm:hidden" />
      </Button>
    </div>
  );
};

export default FulltextSearch;
