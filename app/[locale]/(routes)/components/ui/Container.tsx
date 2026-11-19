import Heading from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import React from "react";

interface ContainerProps {
  title: string;
  description: string;
  visibility?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

const Container = ({
  title,
  description,
  visibility,
  actions,
  children,
}: ContainerProps) => {
  return (
    <div className="flex flex-col flex-1 h-full w-full">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Heading
          title={title}
          description={description}
          visibility={visibility}
        />
        {actions}
      </div>
      <Separator className="my-3" />
      <div className="flex-1 min-h-0 w-full">
        {children}
      </div>
    </div>
  );
};

export default Container;
