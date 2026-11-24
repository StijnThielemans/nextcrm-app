import { getSessionAnyStatus } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import Header from "./components/Header";
import Footer from "./components/Footer";

import { Metadata } from "next";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/app-sidebar";
import { getTranslations } from "next-intl/server";
import { AvatarProvider } from "@/context/avatar-context";
import { CurrencyProvider } from "@/context/currency-context";
import { getEnabledCurrencies, getDefaultCurrency } from "@/lib/currency";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL! || "http://localhost:3000"
  ),
  title: "TILO",
  description: "",
  openGraph: {
    images: [
      {
        url: "/images/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "TILO",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [
      {
        url: "/images/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "TILO",
      },
    ],
  },
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionAnyStatus();

  //console.log(session, "session");

  if (!session) {
    return redirect("/sign-in");
  }

  const user = session?.user;

  if (user?.userStatus === "PENDING") {
    return redirect("/pending");
  }

  if (user?.userStatus === "INACTIVE") {
    return redirect("/inactive");
  }

  // Fetch localization dictionary
  const dict = await getTranslations("ModuleMenu");

  // Extract translations as plain object for client component
  const translations = {
    navigation: dict("navigation"),
    dashboard: dict("dashboard"),
    crm: {
      title: dict("crm.title"),
      dashboard: dict("dashboard"),
      customers: dict("crm.customers"),
      dossiers: dict("crm.dossiers"),
      quotes: dict("crm.quotes"),
      offertebox: dict("crm.offertebox"),
      accounts: dict("crm.accounts"),
      opportunities: dict("crm.opportunities"),
      contacts: dict("crm.contacts"),
      leads: dict("crm.leads"),
      contracts: dict("crm.contracts"),
      products: dict("crm.products"),
      priceLists: dict("crm.priceLists"),
      orders: dict("crm.orders"),
      targets: dict("crm.targets"),
      targetLists: dict("crm.targetLists"),
    },
    projects: dict("projects"),
    emails: dict("emails"),
    reports: dict("reports"),
    documents: dict("documents"),
    invoices: dict("invoices"),
    settings: dict("settings"),
    plugins: dict("plugins"),
  };

  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  const enabledCurrencies = await getEnabledCurrencies();
  const defaultCurrency = await getDefaultCurrency();
  const cookieCurrency = cookieStore.get("display_currency")?.value;
  const displayCurrency = cookieCurrency && enabledCurrencies.some((c: { code: string }) => c.code === cookieCurrency)
    ? cookieCurrency
    : defaultCurrency;
  const currencyList = enabledCurrencies.map((c: { code: string; name: string; symbol: string }) => ({ code: c.code, name: c.name, symbol: c.symbol }));

  const { getPluginNavItems } = await import("@/lib/plugins/nav");
  const { mapLegacyRole } = await import("@/lib/authz/roles");
  const { getLocale } = await import("next-intl/server");
  const requestedLocale = await getLocale();
  const pluginLocale =
    requestedLocale === "cz" || requestedLocale === "de" || requestedLocale === "uk"
      ? requestedLocale
      : "en";
  const pluginNav = await getPluginNavItems(mapLegacyRole(user?.role), pluginLocale);

  //console.log(typeof build, "build");
  return (
    <AvatarProvider initialAvatar={user?.image}>
    <CurrencyProvider initialCurrency={displayCurrency} currencies={currencyList}>
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar
        dict={translations}
        session={session}
        pluginNav={pluginNav}
        appName="TILO"
      />
      <SidebarInset className="bg-[hsl(210_16%_97%)] dark:bg-[hsl(210_12%_7%)]">
        <Header
          id={session.user.id as string}
          lang={session.user.userLanguage as string}
        />
        <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto">
          <div className="w-full min-w-0 flex-1 px-6 py-8 lg:px-10 lg:py-10">
            {children}
          </div>
          <Footer />
        </div>
      </SidebarInset>
    </SidebarProvider>
    </CurrencyProvider>
    </AvatarProvider>
  );
}
