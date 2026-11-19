"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NewAccountForm } from "../accounts/components/NewAccountForm";

export function NewCustomerButton({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="h-9 rounded-full px-4" variant="outline" data-testid="dashboard-new-customer">{label}</Button>
      </SheetTrigger>
      <SheetContent
        data-testid="new-customer-screen"
        className="!inset-0 !h-dvh !w-screen !max-w-none overflow-y-auto border-0 p-8 sm:!max-w-none"
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="mt-8">
          <NewAccountForm
            onFinish={() => {
              setOpen(false);
              router.refresh();
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
