"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { usePanelRef } from "react-resizable-panels";
import { ChatSidebar, type EmailMeta } from "@/components/editor/ChatSidebar";
import { EditorPane } from "@/components/editor/EditorPane";
import { PreviewPane } from "@/components/editor/PreviewPane";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Moon,
  Sun,
  Code2,
  Save,
  Send,
  Check,
  Loader2,
  X,
  ChevronDown,
  LayoutGrid,
} from "lucide-react";
import { applyAltTexts } from "@/lib/utils";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: string[];
  isHtml?: boolean;
};

type TemplateSummary = {
  id: string;
  name: string;
  updatedAt: string;
};

type TemplateLoaderProps = {
  onLoad: (data: { id: string; name: string; html: string; subject: string | null; previewText: string | null; messages: Message[] }) => void;
};

function TemplateLoader({ onLoad }: TemplateLoaderProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    const id = searchParams.get("id");
    if (!id) return;
    fetch(`/api/templates/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        onLoad(data);
        router.replace("/", { scroll: false });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export default function Home() {
  const router = useRouter();
  const [html, setHtml] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const editorPanelRef = usePanelRef();

  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");

  const [templateId, setTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [pendingName, setPendingName] = useState("");

  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const [sendOpen, setSendOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState("");

  const templatesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const dark = savedTheme ? savedTheme === "dark" : true;
    setIsDark(dark);
    document.documentElement.classList.toggle("dark", dark);

    const editorOpen = localStorage.getItem("editorOpen") === "true";
    if (editorOpen) editorPanelRef.current?.expand();
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        templatesRef.current &&
        !templatesRef.current.contains(e.target as Node)
      ) {
        setShowTemplates(false);
      }
    }
    if (showTemplates) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showTemplates]);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  function handleMetaGenerated(meta: EmailMeta) {
    if (meta.subject) setSubject(meta.subject);
    if (meta.previewText) setPreviewText(meta.previewText);
    if (meta.altTexts?.length)
      setHtml((current) => applyAltTexts(current, meta.altTexts));
  }

  function toggleEditor() {
    if (isEditorOpen) {
      editorPanelRef.current?.collapse();
    } else {
      editorPanelRef.current?.expand();
    }
    setIsEditorOpen(!isEditorOpen);
  }

  async function saveTemplate(nameOverride?: string) {
    const name = nameOverride ?? templateName;
    if (!name.trim() || !html) return;
    setIsSaving(true);
    try {
      if (templateId) {
        await fetch(`/api/templates/${templateId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, html, messages, subject, previewText }),
        });
      } else {
        const res = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, html, messages, subject, previewText }),
        });
        const data = await res.json();
        setTemplateId(data.id);
        setTemplateName(data.name);
      }
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2000);
    } finally {
      setIsSaving(false);
      setShowSaveInput(false);
      setPendingName("");
    }
  }

  function handleSaveClick() {
    if (!html) return;
    if (templateId) {
      saveTemplate();
    } else {
      setPendingName("");
      setShowSaveInput(true);
    }
  }

  function handleSaveConfirm() {
    const name = pendingName.trim();
    if (!name) return;
    setTemplateName(name);
    saveTemplate(name);
  }

  async function openTemplates() {
    setShowTemplates((prev) => !prev);
    if (!showTemplates) {
      setLoadingTemplates(true);
      try {
        const res = await fetch("/api/templates");
        const data = await res.json();
        setTemplates(data);
      } finally {
        setLoadingTemplates(false);
      }
    }
  }

  async function loadTemplate(id: string) {
    setShowTemplates(false);
    const res = await fetch(`/api/templates/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setTemplateId(data.id);
    setTemplateName(data.name);
    setHtml(data.html);
    setSubject(data.subject ?? "");
    setPreviewText(data.previewText ?? "");
    setMessages((data.messages as Message[]) ?? []);
  }

  async function handleSend() {
    if (!emailTo || !html) return;
    setSending(true);
    setSendError("");
    try {
      const res = await fetch("/api/send-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: emailTo, html, subject: subject || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSendError(data.error || "Failed to send");
      } else {
        setSent(true);
        setTimeout(() => { setSent(false); setSendOpen(false); setEmailTo(""); }, 2000);
      }
    } finally {
      setSending(false);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function handleTemplateLoad(data: { id: string; name: string; html: string; subject: string | null; previewText: string | null; messages: Message[] }) {
    setTemplateId(data.id);
    setTemplateName(data.name);
    setHtml(data.html);
    setSubject(data.subject ?? "");
    setPreviewText(data.previewText ?? "");
    setMessages(data.messages ?? []);
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-background">
      <Suspense>
        <TemplateLoader onLoad={handleTemplateLoad} />
      </Suspense>
      <header className="h-12 border-b flex items-center justify-between px-4 shrink-0 gap-3">
        {/* Left: logo + gallery link */}
        <div className="flex items-center gap-3 shrink-0">
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
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => router.push("/templates")}
            title="Browse templates"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Templates
          </Button>
        </div>

        {/* Center: template identity */}
        <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
          {showSaveInput ? (
            <div className="flex items-center gap-1.5">
              <Input
                autoFocus
                value={pendingName}
                onChange={(e) => setPendingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveConfirm();
                  if (e.key === "Escape") {
                    setShowSaveInput(false);
                    setPendingName("");
                  }
                }}
                placeholder="Template name…"
                className="h-7 text-xs w-48"
              />
              <Button
                size="sm"
                className="h-7 text-xs px-2"
                onClick={handleSaveConfirm}
                disabled={!pendingName.trim()}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => {
                  setShowSaveInput(false);
                  setPendingName("");
                }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div ref={templatesRef} className="relative">
                <button
                  onClick={openTemplates}
                  className="flex items-center gap-1 text-xs transition-colors group hover:text-foreground"
                >
                  <span className={templateName ? "text-foreground font-medium" : "text-muted-foreground"}>
                    {templateName || "Untitled"}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                </button>
                {showTemplates && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-64 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden">
                    {loadingTemplates ? (
                      <div className="flex items-center justify-center p-4">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : templates.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center p-4">
                        No saved templates yet.
                      </p>
                    ) : (
                      <div className="max-h-64 overflow-y-auto py-1">
                        {templates.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => loadTemplate(t.id)}
                            className={`w-full text-left px-3 py-2 hover:bg-muted transition-colors flex flex-col gap-0.5 ${t.id === templateId ? "bg-muted/60" : ""}`}
                          >
                            <span className="text-xs font-medium truncate">
                              {t.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(t.updatedAt)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {html && (
                <button
                  onClick={handleSaveClick}
                  disabled={isSaving}
                  className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  title={templateId ? "Save changes" : "Save template"}
                >
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : savedOk ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: send test + view controls */}
        <div className="flex items-center gap-1 shrink-0">
          {sendOpen ? (
            <div className="flex items-center gap-1.5">
              <Input
                value={emailTo}
                onChange={(e) => { setEmailTo(e.target.value); setSendError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="you@example.com"
                className="h-7 text-xs w-44"
                autoFocus
                disabled={sending}
              />
              <Button
                size="icon"
                className="h-7 w-7"
                onClick={handleSend}
                disabled={sending || !emailTo || !html}
              >
                {sending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : sent ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => { setSendOpen(false); setEmailTo(""); setSendError(""); }}
              >
                <X className="h-3 w-3" />
              </Button>
              {sendError && (
                <span className="text-xs text-destructive">{sendError}</span>
              )}
            </div>
          ) : (
            <Button
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setSendOpen(true)}
              disabled={!html}
            >
              <Send className="h-3 w-3" />
              Send test
            </Button>
          )}

          <div className="w-px h-4 bg-border mx-0.5" />

          <Button
            variant={isEditorOpen ? "secondary" : "ghost"}
            size="icon"
            onClick={toggleEditor}
            className="h-8 w-8"
            title="Toggle HTML editor"
          >
            <Code2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-8 w-8"
          >
            {isDark ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </header>

      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0">
          <ResizablePanelGroup orientation="horizontal" className="h-full">
            <ResizablePanel defaultSize="28%" minSize="18%" maxSize="40%">
              <ChatSidebar
                onHtmlChange={setHtml}
                hasHtml={!!html}
                isGenerating={isGenerating}
                setIsGenerating={setIsGenerating}
                currentHtml={html}
                messages={messages}
                setMessages={setMessages}
                onMetaGenerated={handleMetaGenerated}
              />
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize="72%" minSize="30%">
              <ResizablePanelGroup orientation="vertical" className="h-full">
                <ResizablePanel defaultSize="100%" minSize="30%">
                  <PreviewPane
                    html={html}
                    isGenerating={isGenerating}
                    onHtmlChange={setHtml}
                    subject={subject}
                    previewText={previewText}
                    onSubjectChange={setSubject}
                    onPreviewTextChange={setPreviewText}
                  />
                </ResizablePanel>

                {isEditorOpen && <ResizableHandle withHandle />}

                <ResizablePanel
                  panelRef={editorPanelRef}
                  defaultSize="0%"
                  minSize="20%"
                  collapsible
                  collapsedSize="0%"
                  onResize={(size) => {
                    const open = size.inPixels > 0;
                    setIsEditorOpen(open);
                    localStorage.setItem("editorOpen", String(open));
                  }}
                >
                  <EditorPane value={html} onChange={setHtml} />
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </div>
  );
}
