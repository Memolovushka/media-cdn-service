"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import type { ComponentProps, ReactElement, ReactNode } from "react";

export const TooltipHint = ({
  children,
  content,
  side,
}: {
  children: ReactElement;
  content: ReactNode;
  side?: ComponentProps<typeof TooltipContent>["side"];
}) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{content}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);
