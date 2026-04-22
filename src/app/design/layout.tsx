import "@/components/launch-ui/launch-ui.css";

import type { ReactNode } from "react";

export const metadata = {
  title: "VidClaw — Design variants",
  description: "Browse 10 landing page design directions",
};

export default function DesignLayout({ children }: { children: ReactNode }) {
  return <div className="launch-ui-root">{children}</div>;
}
