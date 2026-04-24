"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { ArrowUp, Loader2, Zap, Pencil, ImagePlus, X, MessageSquare, Palette, Plus, Check, ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { StyleModal, type StyleSummary } from "./StyleModal"
import { sanitizeEmailHtml } from "@/lib/sanitizeEmailHtml"

type ImageAttachment = {
  url: string
  base64: string
  mimeType: string
  previewUrl: string
  name: string
  blob: Blob
}

type LibraryImage = {
  id: string
  url: string
  filename: string
  contentType: string
  size: number
  createdAt: string
}

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  images?: string[]
  isHtml?: boolean
}

export type EmailMeta = {
  subject: string
  previewText: string
  altTexts: string[]
}

type Props = {
  onHtmlChange: (html: string) => void
  hasHtml: boolean
  isGenerating: boolean
  setIsGenerating: (v: boolean) => void
  currentHtml: string
  messages: Message[]
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  onMetaGenerated?: (meta: EmailMeta) => void
}

export function ChatSidebar({ onHtmlChange, hasHtml, isGenerating, setIsGenerating, currentHtml, messages, setMessages, onMetaGenerated }: Props) {
  const [input, setInput] = useState("")
  const [images, setImages] = useState<ImageAttachment[]>([])
  const [uploadingImages, setUploadingImages] = useState(false)
  const [showImageLibrary, setShowImageLibrary] = useState(false)
  const [libraryImages, setLibraryImages] = useState<LibraryImage[]>([])
  const [loadingLibrary, setLoadingLibrary] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageLibraryRef = useRef<HTMLDivElement>(null)

  const [showStyleModal, setShowStyleModal] = useState(false)
  const [showStylePicker, setShowStylePicker] = useState(false)
  const [styles, setStyles] = useState<StyleSummary[]>([])
  const [loadingStyles, setLoadingStyles] = useState(false)
  const [activeStyle, setActiveStyle] = useState<StyleSummary | null>(null)
  const stylePickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (imageLibraryRef.current && !imageLibraryRef.current.contains(e.target as Node)) {
        setShowImageLibrary(false)
      }
    }
    if (showImageLibrary) document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [showImageLibrary])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (stylePickerRef.current && !stylePickerRef.current.contains(e.target as Node)) {
        setShowStylePicker(false)
      }
    }
    if (showStylePicker) document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [showStylePicker])

  async function openStylePicker() {
    const next = !showStylePicker
    setShowStylePicker(next)
    if (next) {
      setLoadingStyles(true)
      try {
        const res = await fetch("/api/styles")
        setStyles(await res.json())
      } finally {
        setLoadingStyles(false)
      }
    }
  }

  function handleStyleCreated(style: StyleSummary) {
    setStyles((prev) => [style, ...prev])
    setActiveStyle(style)
    setShowStyleModal(false)
    setShowStylePicker(false)
  }

  async function openImageLibrary() {
    const next = !showImageLibrary
    setShowImageLibrary(next)
    if (next) {
      setLoadingLibrary(true)
      try {
        const res = await fetch("/api/images")
        setLibraryImages(await res.json())
      } finally {
        setLoadingLibrary(false)
      }
    }
  }

  async function selectLibraryImage(img: LibraryImage) {
    setShowImageLibrary(false)
    const res = await fetch(`/api/images/${img.id}`)
    const blob = await res.blob()
    const previewUrl = URL.createObjectURL(blob)
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(",")[1])
      reader.readAsDataURL(blob)
    })
    setImages((prev) => [...prev, { url: img.url, base64, mimeType: img.contentType, previewUrl, name: img.filename, blob }])
  }

  function compressImage(
    file: File,
    maxDimension = 1200,
    quality = 0.85
  ): Promise<{ blob: Blob; base64: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const objectUrl = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(objectUrl)
        let { width, height } = img
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width)
            width = maxDimension
          } else {
            width = Math.round((width * maxDimension) / height)
            height = maxDimension
          }
        }
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height)
        // preserve PNG for transparency; also rasterize SVG to PNG to preserve its transparency
        const outType = (file.type === "image/png" || file.type === "image/svg+xml") ? "image/png" : "image/jpeg"
        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error("Compression failed")); return }
            const reader = new FileReader()
            reader.onload = () => {
              const base64 = (reader.result as string).split(",")[1]
              resolve({ blob, base64, mimeType: outType })
            }
            reader.onerror = reject
            reader.readAsDataURL(blob)
          },
          outType,
          quality
        )
      }
      img.onerror = reject
      img.src = objectUrl
    })
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    const added: ImageAttachment[] = await Promise.all(
      files.map(async (file) => {
        const { blob, base64, mimeType } = await compressImage(file)
        const previewUrl = URL.createObjectURL(blob)
        return { url: "", base64, mimeType, previewUrl, name: file.name, blob }
      })
    )
    setImages((prev) => [...prev, ...added])
    e.target.value = ""
  }

  function removeImage(index: number) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  async function uploadImages(pending: ImageAttachment[]): Promise<ImageAttachment[]> {
    return Promise.all(
      pending.map(async (img) => {
        if (img.url) return img
        const form = new FormData()
        form.append("file", new File([img.blob], img.name, { type: img.mimeType }))
        const res = await fetch("/api/upload", { method: "POST", body: form })
        if (!res.ok) throw new Error(`Upload failed: ${await res.text()}`)
        const { url } = await res.json()
        return { ...img, url }
      })
    )
  }

  async function handleSubmit() {
    if ((!input.trim() && images.length === 0) || isGenerating) return

    const mode = hasHtml ? "edit" : "generate"
    const prompt = input || "Incorporate the attached image(s) into the email appropriately."
    setInput("")
    setIsGenerating(true)

    let uploadedImages: ImageAttachment[] = []
    if (images.length > 0) {
      setUploadingImages(true)
      try {
        uploadedImages = await uploadImages(images)
        setImages([])
      } catch {
        setIsGenerating(false)
        setUploadingImages(false)
        return
      }
      setUploadingImages(false)
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
      images: uploadedImages.map((img) => img.url || img.previewUrl),
    }
    setMessages((prev) => [...prev, userMessage])

    const assistantId = crypto.randomUUID()
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", isHtml: true }])

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          currentHtml: currentHtml || null,
          mode,
          images: uploadedImages.map(({ url, base64, mimeType }) => ({ url, base64, mimeType })),
          styleContext: activeStyle ? { name: activeStyle.name, stylePrompt: activeStyle.stylePrompt } : undefined,
        }),
      })

      if (!res.ok) throw new Error("Generation failed")

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let accumulated = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m))
        )
      }

      const html = sanitizeEmailHtml(
        accumulated
          .replace(/^```html\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/```\s*$/i, "")
          .trim()
      )
      onHtmlChange(html)

      if (onMetaGenerated) {
        fetch("/api/meta", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (data) onMetaGenerated(data)
          })
          .catch(() => {})
      }

      const fillerMatches = html.match(/https?:\/\/placehold\.co\/[^\s"')]+/gi)
      const fillerCount = fillerMatches ? new Set(fillerMatches).size : 0
      if (fillerCount > 0) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `I used ${fillerCount} placeholder image${fillerCount === 1 ? "" : "s"} in this email. Can you provide ${fillerCount === 1 ? "it" : "them"} so I can swap in the real ${fillerCount === 1 ? "one" : "ones"}? You can attach ${fillerCount === 1 ? "it" : "them"} using the image button below.`,
          },
        ])
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: "Something went wrong. Please try again." } : m
        )
      )
    } finally {
      setIsGenerating(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const canSubmit = (input.trim().length > 0 || images.length > 0) && !isGenerating

  return (
    <>
    <div className="flex flex-col h-full bg-background border-r">
      {/* Header */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Chat</span>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="h-4 w-4 rounded bg-primary/10 flex items-center justify-center">
              <Zap className="h-2.5 w-2.5 text-primary" />
            </div>
            <span className="text-xs text-muted-foreground">AI</span>
          </div>
        </div>
      </div>

      {/* Style selector */}
      <div className="px-4 py-3 border-b relative" ref={stylePickerRef}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Palette className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-medium">Visual style</span>
          </div>
          <button
            onClick={() => { setShowStylePicker(false); setShowStyleModal(true) }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3 w-3" />
            New
          </button>
        </div>

        <button
          onClick={openStylePicker}
          className={[
            "w-full flex items-center justify-between px-3 py-2 rounded-md border text-xs transition-colors",
            activeStyle
              ? "border-border bg-muted/40 hover:bg-muted/60"
              : "border-dashed border-border hover:border-muted-foreground/50 hover:bg-muted/20",
          ].join(" ")}
        >
          <div className="flex items-center gap-2 min-w-0">
            {activeStyle ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span className="font-medium truncate">{activeStyle.name}</span>
              </>
            ) : (
              <span className="text-muted-foreground">No style — click to pick</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {activeStyle && (
              <span
                role="button"
                onClick={(e) => { e.stopPropagation(); setActiveStyle(null) }}
                className="text-muted-foreground hover:text-foreground transition-colors p-0.5 -mr-0.5"
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${showStylePicker ? "rotate-180" : ""}`} />
          </div>
        </button>

        {activeStyle?.stylePrompt && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">{activeStyle.stylePrompt}</p>
        )}

        {showStylePicker && (
          <div className="absolute right-0 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
            {loadingStyles ? (
              <div className="flex items-center justify-center p-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : styles.length === 0 ? (
              <div className="p-4 flex flex-col items-center gap-3">
                <div className="text-center space-y-1">
                  <p className="text-xs font-medium">No styles yet</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">Create a style to give every email a consistent look — upload screenshots or describe the aesthetic.</p>
                </div>
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1.5 w-full"
                  onClick={() => { setShowStylePicker(false); setShowStyleModal(true) }}
                >
                  <Palette className="h-3 w-3" />
                  Create a style
                </Button>
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto py-1">
                <button
                  onClick={() => { setActiveStyle(null); setShowStylePicker(false) }}
                  className={`w-full text-left px-3 py-2 hover:bg-muted transition-colors flex items-center gap-2 ${!activeStyle ? "bg-muted/60" : ""}`}
                >
                  {!activeStyle
                    ? <Check className="h-3 w-3 text-primary shrink-0" />
                    : <span className="h-3 w-3 shrink-0" />
                  }
                  <span className="text-xs text-muted-foreground">No style</span>
                </button>
                {styles.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setActiveStyle(s); setShowStylePicker(false) }}
                    className={`w-full text-left px-3 py-2 hover:bg-muted transition-colors flex items-center gap-2 ${activeStyle?.id === s.id ? "bg-muted/60" : ""}`}
                  >
                    {activeStyle?.id === s.id
                      ? <Check className="h-3 w-3 text-primary shrink-0" />
                      : <span className="h-3 w-3 shrink-0" />
                    }
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{s.name}</p>
                      {s.description && (
                        <p className="text-xs text-muted-foreground truncate">{s.description}</p>
                      )}
                    </div>
                    {s.images?.length > 0 && (
                      <div className="flex -space-x-1 shrink-0">
                        {(s.images as string[]).slice(0, 2).map((url, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={i} src={url} alt="" className="h-6 w-6 rounded object-cover border border-border" />
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-3 py-8">
            <p className="text-sm text-muted-foreground text-center">
              Describe the email you want to create.
            </p>
            <div className="flex flex-col gap-2">
              {EXAMPLE_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => setInput(p)}
                  className="text-left text-xs text-muted-foreground bg-muted hover:bg-muted/80 rounded-lg p-3 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m) => (
              <div key={m.id} className={`flex flex-col gap-1 ${m.role === "user" ? "items-end" : "items-start"}`}>
                {m.images && m.images.length > 0 && (
                  <div className="flex flex-wrap gap-1 justify-end">
                    {m.images.map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={src}
                        alt={`attachment ${i + 1}`}
                        className="h-16 w-16 object-cover rounded border"
                      />
                    ))}
                  </div>
                )}
                {m.role === "user" ? (
                  <div className="rounded-lg px-3 py-2 text-sm max-w-[85%] bg-secondary text-secondary-foreground">
                    {m.content}
                  </div>
                ) : (
                  <div className="text-sm text-foreground w-full">
                    {m.content === "" ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      m.isHtml ? `HTML generated (${m.content.length} chars)` : m.content
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Image previews */}
      {images.length > 0 && (
        <div className="px-4 pt-3 flex flex-wrap gap-2">
          {images.map((img, i) => (
            <div key={i} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.previewUrl}
                alt={img.name}
                className="h-14 w-14 object-cover rounded border"
              />
              <button
                onClick={() => removeImage(i)}
                className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-4 flex flex-col gap-2">
        {hasHtml && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Pencil className="h-3 w-3" />
            <span>Editing existing email</span>
          </div>
        )}
        <div className="relative">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasHtml ? "Describe a change..." : "Describe your email..."}
            className="pr-10 resize-none text-sm min-h-[80px]"
            disabled={isGenerating}
          />
          <Button
            size="icon"
            className="absolute bottom-2 right-2 h-6 w-6"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isGenerating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ArrowUp className="h-3 w-3" />
            )}
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">⏎ to send, ⇧⏎ for new line</p>
          <div className="flex items-center gap-1">
            {uploadingImages && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
              </span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { setShowImageLibrary(false); handleFileSelect(e) }}
            />
            <div className="relative" ref={imageLibraryRef}>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={openImageLibrary}
                disabled={isGenerating}
                title="Images"
              >
                <ImagePlus className="h-3.5 w-3.5" />
              </Button>

              {showImageLibrary && (
                <div className="absolute bottom-8 right-0 w-72 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b">
                    <span className="text-xs font-medium">Image Library</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs gap-1"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImagePlus className="h-3 w-3" />
                      Upload new
                    </Button>
                  </div>

                  {loadingLibrary ? (
                    <div className="flex items-center justify-center p-6">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : libraryImages.length === 0 ? (
                    <div className="p-6 text-center space-y-2">
                      <p className="text-xs text-muted-foreground">No images yet.</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <ImagePlus className="h-3 w-3" />
                        Upload your first image
                      </Button>
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto p-2 grid grid-cols-3 gap-1.5">
                      {libraryImages.map((img) => (
                        <button
                          key={img.id}
                          onClick={() => selectLibraryImage(img)}
                          className="relative aspect-square rounded overflow-hidden border hover:border-primary transition-colors group"
                          title={img.filename}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.url} alt={img.filename} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white text-xs font-medium">Select</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

    {showStyleModal && (
      <StyleModal
        onClose={() => setShowStyleModal(false)}
        onCreated={handleStyleCreated}
      />
    )}
    </>
  )
}

const EXAMPLE_PROMPTS = [
  "Spring sale announcement for a DTC skincare brand with a hero image and two product blocks",
  "Welcome email for a SaaS product with a CTA to start a free trial",
  "Abandoned cart reminder with urgency and a discount code",
]
