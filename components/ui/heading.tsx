import { Lock } from "lucide-react";

interface HeadingProps {
  title: string;
  description: string;
  visibility?: string;
}

const Heading = ({ title, description, visibility }: HeadingProps) => {
  return (
    <div className="max-w-2xl">
      <h2 className="flex items-center gap-3 text-[1.7rem] font-medium leading-none tracking-[-0.035em]">
        <span aria-hidden className="h-6 w-[3px] shrink-0 rounded-full bg-[hsl(var(--tilo))]" />
        {title}
        {visibility === "private" ? <Lock className="size-4 text-muted-foreground" /> : null}
      </h2>
      {description ? (
        <p className="mt-2 pl-[15px] text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
};

export default Heading;
