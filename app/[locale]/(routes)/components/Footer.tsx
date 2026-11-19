import { version } from "@/package.json";

const Footer = () => {
  return (
    <footer className="flex h-10 w-full items-center justify-between px-6 text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">TILO</span>
      <span>v{version}</span>
    </footer>
  );
};

export default Footer;
