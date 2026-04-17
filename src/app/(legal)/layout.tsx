import Link from "next/link";
import { Film } from "lucide-react";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--vc-bg-root)] text-white">
      <header className="sticky top-0 z-50 border-b border-[var(--vc-accent)]/10 bg-[var(--vc-bg-root)]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2" aria-label="VidClaw 首页">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--vc-accent)]">
              <Film className="h-4 w-4 text-[var(--vc-bg-root)]" aria-hidden="true" />
            </div>
            <span className="font-heading text-lg font-bold">VidClaw</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm text-[var(--vc-text-secondary)]">
            <Link href="/privacy" className="hover:text-white">隐私</Link>
            <Link href="/terms" className="hover:text-white">条款</Link>
            <Link href="/refund" className="hover:text-white">退款</Link>
            <Link href="/contact" className="hover:text-white">联系</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-16 leading-relaxed">{children}</main>
      <footer className="border-t border-white/5 px-6 py-8 text-center text-xs text-slate-600">
        <p>
          &copy; {new Date().getFullYear()} VidClaw &middot; support@yeadon.top
        </p>
      </footer>
    </div>
  );
}
