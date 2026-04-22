import "@/components/launch-ui/launch-ui.css";

import type { ReactNode } from "react";

export const metadata = {
  title: "VidClaw — Landing preview",
  description: "Launch UI Pro landing preview for VidClaw",
};

export default function LandingPreviewLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="launch-ui-root">{children}</div>;
}
