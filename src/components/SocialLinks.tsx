import { useSocialSettings } from "@/hooks/useSiteSettings";
import { Send, Twitter } from "lucide-react";

interface Props {
  variant?: "card" | "inline";
  className?: string;
}

/**
 * Renders Telegram + Twitter/X links pulled from site_settings.
 * Hidden entirely if neither URL is configured.
 */
export default function SocialLinks({ variant = "card", className = "" }: Props) {
  const { data } = useSocialSettings();
  const normalize = (u?: string) => {
    const v = (u || "").trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) return v;
    return `https://${v.replace(/^\/+/, "")}`;
  };
  const telegram = normalize(data?.telegram_url);
  const twitter = normalize(data?.twitter_url);
  if (!telegram && !twitter) return null;

  if (variant === "inline") {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        {telegram && (
          <a
            href={telegram}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 font-mono text-xs text-primary hover:text-primary-glow"
          >
            <Send className="h-3.5 w-3.5" /> Telegram
          </a>
        )}
        {twitter && (
          <a
            href={twitter}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 font-mono text-xs text-primary hover:text-primary-glow"
          >
            <Twitter className="h-3.5 w-3.5" /> Twitter / X
          </a>
        )}
      </div>
    );
  }

  return (
    <section className={`rounded-xl glass p-4 ${className}`}>
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
        Follow the Tracker
      </p>
      <div className="flex flex-wrap gap-2">
        {telegram && (
          <a
            href={telegram}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-xs text-primary hover:bg-primary/20 transition-colors"
          >
            <Send className="h-3.5 w-3.5" /> Join on Telegram
          </a>
        )}
        {twitter && (
          <a
            href={twitter}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-xs text-primary hover:bg-primary/20 transition-colors"
          >
            <Twitter className="h-3.5 w-3.5" /> Follow on X
          </a>
        )}
      </div>
      <p className="mt-3 font-mono text-[10px] leading-relaxed text-foreground/80">
        <span className="text-amber-500">Disclaimer:</span> External links are independent public sources. This project is not affiliated with or responsible for their content.
      </p>
    </section>
  );
}
