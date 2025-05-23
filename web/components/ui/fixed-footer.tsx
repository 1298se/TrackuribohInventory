import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface FixedFooterProps {
  children: ReactNode;
  className?: string;
}

export function FixedFooter({ children, className }: FixedFooterProps) {
  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 md:left-64 py-4 px-4 bg-background border-t shadow-sm z-10",
        className,
      )}
    >
      <div className="flex justify-end pr-2">{children}</div>
    </div>
  );
}
