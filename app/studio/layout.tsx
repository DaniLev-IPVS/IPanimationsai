import type { Metadata } from "next";
import "./studio.css";

export const metadata: Metadata = {
  title: "Studio · IP Animations",
  robots: { index: false, follow: false },
};

export default function StudioRoot({ children }: { children: React.ReactNode }) {
  return <div className="st">{children}</div>;
}
