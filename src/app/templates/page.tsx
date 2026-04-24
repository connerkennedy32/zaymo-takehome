"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Clock, Search, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

type TemplateSummary = {
  id: string;
  name: string;
  updatedAt: string;
  html: string;
  subject: string | null;
};

function TemplatePreview({ html }: { html: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);

  useEffect(() => {
    if (containerRef.current) {
      const w = containerRef.current.offsetWidth;
      setScale(w / 600);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden bg-white"
      style={{ height: 220 }}
    >
      <iframe
        srcDoc={html}
        sandbox="allow-same-origin"
        scrolling="no"
        style={{
          width: 600,
          height: 550,
          border: "none",
          transformOrigin: "top left",
          transform: `scale(${scale})`,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const dark = savedTheme ? savedTheme === "dark" : true;
    setIsDark(dark);
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  useEffect(() => {
    fetch("/api/templates?preview=true")
      .then((r) => r.json())
      .then((data) => setTemplates(data))
      .finally(() => setLoading(false));
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  const filtered = templates.filter((t) =>
    t.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="h-12 border-b border-border flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/zaymo-lockup.png"
            alt="Zaymo"
            className="h-4 dark:invert"
          />
          <span className="font-medium text-sm tracking-tight text-muted-foreground">
            autopilot
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => router.push("/")}
          >
            <Plus className="h-3 w-3" />
            New template
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-8 w-8"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        {/* Page title + search */}
        <div className="flex items-center justify-between mb-6 gap-4">
          <h1 className="text-lg font-medium tracking-tight">Templates</h1>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="h-8 pl-8 pr-3 text-xs bg-input border border-border rounded-md outline-none focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground w-48"
            />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-card overflow-hidden animate-pulse"
              >
                <div className="h-[220px] bg-muted" />
                <div className="p-3 space-y-1.5">
                  <div className="h-3 bg-muted rounded w-3/4" />
                  <div className="h-2.5 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            {templates.length === 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  No templates yet. Create your first one.
                </p>
                <Button
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => router.push("/")}
                >
                  <Plus className="h-3 w-3" />
                  New template
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No templates match &ldquo;{query}&rdquo;
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* New template card */}
            <button
              onClick={() => router.push("/")}
              className="rounded-lg border border-dashed border-border bg-card hover:border-primary hover:bg-muted transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
              style={{ minHeight: 280 }}
            >
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <Plus className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium">New template</span>
            </button>

            {filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => router.push(`/?id=${t.id}`)}
                className="rounded-lg border border-border bg-card overflow-hidden text-left hover:border-primary transition-colors group"
              >
                <div className="relative overflow-hidden border-b border-border">
                  {t.html ? (
                    <TemplatePreview html={t.html} />
                  ) : (
                    <div className="h-[220px] bg-muted flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">No preview</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors" />
                </div>
                <div className="p-3 space-y-0.5">
                  <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">
                    {t.name}
                  </p>
                  {t.subject && (
                    <p className="text-xs text-muted-foreground truncate">{t.subject}</p>
                  )}
                  <p className="text-xs text-muted-foreground flex items-center gap-1 pt-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    {formatDate(t.updatedAt)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
