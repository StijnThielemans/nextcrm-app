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
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="flex items-center gap-4 bg-[hsl(183_53%_61%)] px-6 py-4 text-black">
        <div className="flex h-14 items-center rounded-md bg-white px-3">
          <Image
            src="/images/tilo-logo.png"
            alt="TILO"
            width={1024}
            height={341}
            priority
            className="h-9 w-auto"
          />
        </div>
        <p className="text-sm font-medium text-black/80">Thielemans · ramen en deuren</p>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-10">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
};

export default AuthLayout;
