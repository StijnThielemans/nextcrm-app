import Heading from "@/components/ui/heading";
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
    <div className="flex h-full w-full flex-1 flex-col">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Heading
          title={title}
          description={description}
          visibility={visibility}
        />
        {actions}
      </div>
      <div className="mt-8 min-h-0 w-full flex-1">
        {children}
      </div>
    </div>
  );
};

export default Container;
