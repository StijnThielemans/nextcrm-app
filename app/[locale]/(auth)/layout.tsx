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
      <header className="flex items-center gap-3 bg-[hsl(183_53%_61%)] px-6 py-4 text-black">
        <Image
          src="/brand/thielemans-mark.png"
          alt=""
          width={80}
          height={80}
          priority
          className="size-12 shrink-0"
        />
        <div className="leading-none">
          <p className="text-2xl font-bold tracking-tight">TILO</p>
          <p className="mt-1 text-xs font-medium text-black/70">Thielemans · ramen en deuren</p>
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-10">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
};

export default AuthLayout;
