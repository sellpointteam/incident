import { useSocialSettings } from "@/hooks/useSiteSettings";
import { Send, Twitter } from "lucide-react";
import { Link } from "react-router-dom";

export default function Footer() {
  const year = new Date().getFullYear();
  const { data } = useSocialSettings();
  const normalize = (u?: string) => {
    const v = (u || "").trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) return v;
    return `https://${v.replace(/^\/+/, "")}`;
  };
  const telegram = normalize(data?.telegram_url);
  const twitter = normalize(data?.twitter_url);

  return (
    <footer className="mt-6 border-t border-border/60 bg-background/80">
      <div className="mx-auto max-w-7xl px-4 lg:px-6 py-8 flex flex-col items-center gap-5">
        {/* Primary CTA — Telegram */}
        {telegram && (
          <a
            href={telegram}
            target="_blank"
            rel="noreferrer noopener"
            className="group inline-flex items-center gap-3 rounded-lg border border-primary/50 bg-primary/15 px-6 py-3 font-display text-base sm:text-lg font-bold tracking-wide text-primary shadow-[0_0_30px_-8px_hsl(var(--primary)/0.6)] hover:bg-primary/25 hover:border-primary transition-all"
          >
            <Send className="h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
            Stay Updated With Incidents
          </a>
        )}

        <div className="flex items-center gap-5">
          {telegram && (
            <a
              href={telegram}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-primary"
            >
              <Send className="h-3.5 w-3.5" /> Telegram
            </a>
          )}
          {twitter && (
            <a
              href={twitter}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-primary"
            >
              <Twitter className="h-3.5 w-3.5" /> Twitter / X
            </a>
          )}
        </div>

        {(telegram || twitter) && (
          <p className="max-w-2xl text-center font-mono text-[10px] leading-relaxed text-foreground/80">
            <span className="text-amber-500">Disclaimer:</span> External links are independent public sources. This project is not affiliated with or responsible for their content.{" "}
            <Link to="/about" className="underline hover:text-primary">Read more</Link>.
          </p>
        )}

        <div className="text-center space-y-1">
          <p className="font-display text-sm font-bold tracking-wide text-foreground">
            Pakistan Casualty Tracker
          </p>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            © {year} · Independent OSINT project ·{" "}
            <Link to="/about" className="hover:text-primary">About</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
