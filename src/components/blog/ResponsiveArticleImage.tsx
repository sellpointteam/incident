import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export type ImageFit = "contain" | "cover";

interface Props {
  src?: string | null;
  alt: string;
  imageFit?: ImageFit | null;
  focalX?: number | null;
  focalY?: number | null;
  aspect?: string; // e.g. "16 / 9", "4 / 3"
  priority?: boolean;
  className?: string;
  rounded?: string; // e.g. "rounded-lg"
}

/**
 * Frame that always shows the full image by default (contain), with a
 * blurred copy of the same image behind it so contained portraits/screenshots
 * don't sit on harsh empty rectangles.
 */
export default function ResponsiveArticleImage({
  src,
  alt,
  imageFit,
  focalX,
  focalY,
  aspect = "16 / 9",
  priority = false,
  className,
  rounded = "rounded-lg",
}: Props) {
  const fit: ImageFit = imageFit ?? "contain";
  const fx = typeof focalX === "number" ? focalX : 50;
  const fy = typeof focalY === "number" ? focalY : 50;

  if (!src) {
    return (
      <div
        className={cn(
          "relative w-full overflow-hidden bg-[#0b111b] flex items-center justify-center border border-border/40",
          rounded,
          className,
        )}
        style={{ aspectRatio: aspect }}
        aria-hidden="true"
      >
        <BookOpen className="h-8 w-8 text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden bg-[#0b111b] isolate",
        rounded,
        className,
      )}
      style={{ aspectRatio: aspect }}
    >
      {fit === "contain" && (
        <>
          <div
            aria-hidden="true"
            className="absolute -inset-6 bg-center bg-cover blur-2xl opacity-25 scale-110"
            style={{ backgroundImage: `url(${src})` }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[#080D16]/40 pointer-events-none"
          />
        </>
      )}
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="relative z-[1] block w-full h-full"
        style={{
          objectFit: fit,
          objectPosition: fit === "cover" ? `${fx}% ${fy}%` : "center",
        }}
      />
    </div>
  );
}
