import { version } from "@/package.json";

const Footer = () => {
  return (
    <footer className="flex h-12 w-full items-center justify-between px-6 text-[0.7rem] tracking-wide text-muted-foreground">
      <span>TILO</span>
      <span>v{version}</span>
    </footer>
  );
};

export default Footer;
