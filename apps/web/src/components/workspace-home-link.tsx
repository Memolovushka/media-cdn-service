"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";

export const WorkspaceHomeLink = ({
  children,
  className,
  workspaceId,
}: {
  children: string;
  className?: string;
  workspaceId: string;
}) => {
  const router = useRouter();
  const href = `/?workspace=${encodeURIComponent(workspaceId)}` as Route;

  const returnToMain = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    router.push(href);
    router.refresh();
  };

  return (
    <a className={className} href={href} onClick={returnToMain}>
      {children}
    </a>
  );
};
