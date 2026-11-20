import { getTranslations } from "next-intl/server";
import Image from "next/image";

import "@/app/[locale]/globals.css";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: Props) {
  const params = await props.params;
  const { locale } = params;

  const t = await getTranslations({ locale, namespace: "RootLayout" });

  return {
    title: "TILO",
    description: t("description"),
  };
}

const AuthLayout = async ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex min-h-screen w-full flex-col bg-[hsl(210_16%_97%)]">
      <header className="flex items-center gap-4 border-b border-[hsl(215_16%_84%)] bg-white px-6 py-4">
        <div className="flex h-14 items-center rounded-lg border border-[hsl(215_16%_82%)] bg-white px-3">
          <Image
            src="/images/tilo-logo.png"
            alt="TILO"
            width={1024}
            height={341}
            priority
            className="h-9 w-auto"
          />
        </div>
        <p className="text-sm text-black/55">Thielemans · ramen en deuren</p>
        <span aria-hidden className="ml-auto h-1.5 w-10 rounded-full bg-[hsl(183_53%_61%)]" />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-10">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
};

export default AuthLayout;
