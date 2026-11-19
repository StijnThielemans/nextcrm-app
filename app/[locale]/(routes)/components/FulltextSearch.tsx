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
    <div className="flex w-full max-w-sm items-center space-x-2">
      <Input
        type="text"
        placeholder={t("searchPlaceholder")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <Button type="submit" className="gap-2" onClick={handleSearch}>
        <span className="hidden sm:flex">{t("searchButton")}</span>
        <SearchIcon />
      </Button>
    </div>
  );
};

export default FulltextSearch;
