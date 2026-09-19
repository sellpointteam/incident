import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}

function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < total - 1) out.push("…");
  out.push(total);
  return out;
}

export default function BlogPagination({ page, totalPages, onChange }: Props) {
  if (totalPages <= 1) return null;
  const pages = pageWindow(page, totalPages);
  return (
    <nav aria-label="Blog pagination" className="flex items-center justify-center gap-1 mt-10">
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="px-2 font-mono text-sm text-muted-foreground">…</span>
        ) : (
          <Button
            key={p}
            variant={p === page ? "default" : "outline"}
            size="icon"
            className={`h-9 w-9 font-mono text-xs ${p === page ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}`}
            onClick={() => onChange(p)}
            aria-current={p === page ? "page" : undefined}
            aria-label={`Page ${p}`}
          >
            {p}
          </Button>
        ),
      )}
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9"
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}
