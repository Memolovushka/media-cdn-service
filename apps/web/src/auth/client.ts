"use client";

import { sentinelClient } from "@better-auth/infra/client";
import { polarClient } from "@polar-sh/better-auth/client";
import { createAuthClient } from "better-auth/react";

export const authClient: ReturnType<typeof createAuthClient> = createAuthClient(
  {
    plugins: [sentinelClient(), polarClient()],
  }
);
