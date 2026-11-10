"use client";

import { Toaster as Sonner, toast } from "sonner";

export { toast };

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: "!rounded-xl !border !border-border !bg-surface !text-foreground !shadow-float !font-sans",
          title: "!text-sm !font-medium",
          description: "!text-xs !text-muted-foreground",
          success: "[&_[data-icon]]:!text-success-text",
          error: "[&_[data-icon]]:!text-danger-text",
        },
      }}
    />
  );
}
