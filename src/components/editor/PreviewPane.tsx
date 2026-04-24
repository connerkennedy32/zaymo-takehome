"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { applyAltTexts } from "@/lib/utils"
import { ElementEditor, type SelectedElement } from "./ElementEditor"

const RESIZE_SCRIPT = `<script>(function(){function report(){var h=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight,document.body.offsetHeight,document.documentElement.offsetHeight);window.parent.postMessage({type:'mailcraft-height',height:h},'*');}if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',report);}else{report();}window.addEventListener('load',report);if(window.ResizeObserver){new ResizeObserver(report).observe(document.body);}})()</script>`

const EDIT_SCRIPT = `<script>(function(){
if(window.__mcEdit)return;window.__mcEdit=true;
var s=document.createElement('style');
s.textContent='[data-eid]{cursor:pointer!important;}[data-eid]:hover{outline:2px solid #6366f1!important;outline-offset:2px!important;}[data-eid].mc-sel{outline:2px solid #ec4899!important;outline-offset:2px!important;}';
document.head.appendChild(s);
var c=0;
['img','a','button','p','h1','h2','h3','h4','h5','h6','span','td','th'].forEach(function(t){
  document.querySelectorAll(t).forEach(function(el){
    if(!el.getAttribute('data-eid'))el.setAttribute('data-eid','e'+(++c));
  });
});
var priority=['img','a','button','h1','h2','h3','h4','h5','h6','p','span','td','th'];
document.body.addEventListener('click',function(e){
  var cur=e.target,candidates=[];
  while(cur&&cur!==document.body){
    if(cur.getAttribute&&cur.getAttribute('data-eid'))candidates.push(cur);
    cur=cur.parentElement;
  }
  var el=null;
  for(var i=0;i<priority.length&&!el;i++)for(var j=0;j<candidates.length&&!el;j++)if(candidates[j].tagName.toLowerCase()===priority[i])el=candidates[j];
  if(!el)return;
  e.preventDefault();e.stopPropagation();
  document.querySelectorAll('.mc-sel').forEach(function(x){x.classList.remove('mc-sel');});
  el.classList.add('mc-sel');
  var cs=window.getComputedStyle(el),r=el.getBoundingClientRect();
  window.parent.postMessage({
    type:'mc:select',
    eid:el.getAttribute('data-eid'),
    tag:el.tagName.toLowerCase(),
    innerText:el.innerText||'',
    innerHTML:el.innerHTML||'',
    href:el.getAttribute('href')||'',
    src:el.getAttribute('src')||'',
    alt:el.getAttribute('alt')||'',
    styles:{
      color:el.style.color||cs.color,
      backgroundColor:el.style.backgroundColor||cs.backgroundColor,
      fontSize:el.style.fontSize||cs.fontSize,
      fontWeight:el.style.fontWeight||cs.fontWeight,
      textAlign:el.style.textAlign||cs.textAlign,
      padding:el.style.padding||'',
      margin:el.style.margin||'',
      borderRadius:el.style.borderRadius||'',
      border:el.style.border||'',
      width:el.style.width||''
    }
  },'*');
},true);
window.addEventListener('message',function(e){
  var d=e.data;if(!d||!d.type)return;
  if(d.type==='mc:deselect'){document.querySelectorAll('.mc-sel').forEach(function(x){x.classList.remove('mc-sel');});return;}
  if((!d.type.startsWith('mc:apply')&&d.type!=='mc:remove')||!d.eid)return;
  var el=document.querySelector('[data-eid="'+d.eid+'"]');if(!el)return;
  if(d.type==='mc:remove'){el.parentNode&&el.parentNode.removeChild(el);window.parent.postMessage({type:'mc:updated',html:document.documentElement.outerHTML},'*');return;}
  if(d.type==='mc:apply:batch'){
    if(d.text!==undefined)el.innerText=d.text;
    if(d.src!==undefined)el.setAttribute('src',d.src);
    if(d.alt!==undefined)el.setAttribute('alt',d.alt);
    if(d.href!==undefined)el.setAttribute('href',d.href);
    if(d.styles)Object.keys(d.styles).forEach(function(k){el.style[k]=d.styles[k];});
  } else if(d.type==='mc:apply:text'){el.innerText=d.value;}
  else if(d.type==='mc:apply:src'){el.setAttribute('src',d.src);if(d.alt!==undefined)el.setAttribute('alt',d.alt);}
  else if(d.type==='mc:apply:href'){el.setAttribute('href',d.href);}
  else if(d.type==='mc:apply:styles'){Object.keys(d.styles).forEach(function(k){el.style[k]=d.styles[k];});}
  window.parent.postMessage({type:'mc:updated',html:document.documentElement.outerHTML},'*');
});
})()</script>`

const NO_SCROLL_STYLE = `<style>html,body{margin:0!important;}body>table,body>center>table{max-width:600px!important;width:600px!important;}img{max-width:100%!important;height:auto!important;}</style>`

function injectScripts(html: string): string {
  const scripts = RESIZE_SCRIPT + EDIT_SCRIPT
  let result = html.includes("</head>")
    ? html.replace("</head>", NO_SCROLL_STYLE + "</head>")
    : NO_SCROLL_STYLE + html
  if (result.includes("</body>")) {
    return result.replace("</body>", scripts + "</body>")
  } else if (result.includes("</html>")) {
    return result.replace("</html>", scripts + "</html>")
  }
  return result + scripts
}

type Props = {
  html: string
  isGenerating: boolean
  subject: string
  previewText: string
  onSubjectChange: (v: string) => void
  onPreviewTextChange: (v: string) => void
  onHtmlChange: (html: string) => void
}

export function PreviewPane({
  html,
  isGenerating,
  subject,
  previewText,
  onSubjectChange,
  onPreviewTextChange,
  onHtmlChange,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeHeight, setIframeHeight] = useState(600)
  const [isGeneratingMeta, setIsGeneratingMeta] = useState(false)
  const [metaError, setMetaError] = useState("")

  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null)
  // Prevents re-injecting iframe when HTML update came from iframe edits
  const skipNextInjectionRef = useRef(false)

  async function handleGenerate() {
    if (!html || isGeneratingMeta) return
    setIsGeneratingMeta(true)
    setMetaError("")
    try {
      const res = await fetch("/api/meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html }),
      })
      if (!res.ok) throw new Error("Generation failed")
      const data = await res.json()
      if (data.subject) onSubjectChange(data.subject)
      if (data.previewText) onPreviewTextChange(data.previewText)
      if (Array.isArray(data.altTexts) && data.altTexts.length > 0) {
        onHtmlChange(applyAltTexts(html, data.altTexts))
      }
    } catch {
      setMetaError("Failed to generate — try again")
      setTimeout(() => setMetaError(""), 3000)
    } finally {
      setIsGeneratingMeta(false)
    }
  }

  function handleApply(type: string, eid: string, payload: Record<string, string>) {
    const msg =
      type === "mc:apply:styles"
        ? { type, eid, styles: payload }
        : { type, eid, ...payload }
    iframeRef.current?.contentWindow?.postMessage(msg, "*")
  }

  function handleBatch(eid: string, payload: Record<string, unknown>) {
    iframeRef.current?.contentWindow?.postMessage({ type: "mc:apply:batch", eid, ...payload }, "*")
  }

  function handleClose() {
    setSelectedElement(null)
    iframeRef.current?.contentWindow?.postMessage({ type: "mc:deselect" }, "*")
  }

  function handleRemove(eid: string) {
    iframeRef.current?.contentWindow?.postMessage({ type: "mc:remove", eid }, "*")
    setSelectedElement(null)
  }

  useEffect(() => {
    if (iframeRef.current && html) {
      if (skipNextInjectionRef.current) {
        skipNextInjectionRef.current = false
        return
      }
      setIframeHeight(600)
      iframeRef.current.srcdoc = injectScripts(html)
    }
  }, [html])

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === "mailcraft-height" && typeof e.data.height === "number") {
        setIframeHeight(Math.max(600, e.data.height))
      } else if (e.data?.type === "mc:select") {
        const d = e.data
        setSelectedElement({
          eid: d.eid,
          tag: d.tag,
          innerText: d.innerText,
          innerHTML: d.innerHTML,
          href: d.href,
          src: d.src,
          alt: d.alt,
          styles: d.styles,
        })
      } else if (e.data?.type === "mc:updated") {
        skipNextInjectionRef.current = true
        onHtmlChange(e.data.html)
      }
    }
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [onHtmlChange])

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background gap-3">
        <span className="text-xs font-medium text-muted-foreground shrink-0">Preview</span>
        <div className="flex items-center gap-2">
          {isGenerating && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Generating...
            </div>
          )}
          <span className="text-xs text-muted-foreground">600px</span>
        </div>
      </div>

      {/* Email metadata */}
      <div className="border-b bg-background px-6 py-2.5">
        <div className="w-[600px] mx-auto flex items-center gap-2">
          <div className="flex-1 min-w-0 space-y-1">
            <MetaField
              label="Subject"
              value={subject}
              onChange={onSubjectChange}
              placeholder="Add subject line…"
              disabled={!html}
            />
            <MetaField
              label="Preview"
              value={previewText}
              onChange={onPreviewTextChange}
              placeholder="Add preview text…"
              disabled={!html}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={handleGenerate}
            disabled={!html || isGeneratingMeta}
            title="Auto-generate subject, preview text, and alt text"
          >
            {isGeneratingMeta ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        {metaError && (
          <div className="w-[600px] mx-auto">
            <span className="text-xs text-destructive">{metaError}</span>
          </div>
        )}
      </div>

      {/* Preview + side editor */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 overflow-auto bg-muted/30">
          <div className="min-h-full flex justify-center p-6">
          {html ? (
            <div className="w-[600px] shrink-0 shadow-md rounded overflow-hidden bg-white">
              <iframe
                ref={iframeRef}
                title="Email preview"
                className="w-full border-0"
                style={{ height: iframeHeight }}
                sandbox="allow-scripts"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              {isGenerating ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Building your email...</span>
                </div>
              ) : (
                "Your email preview will appear here"
              )}
            </div>
          )}
          </div>
        </div>

        {selectedElement && (
          <ElementEditor
            element={selectedElement}
            onApply={handleApply}
            onBatch={handleBatch}
            onClose={handleClose}
            onRemove={handleRemove}
          />
        )}
      </div>
    </div>
  )
}

type MetaFieldProps = {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  disabled?: boolean
}

function MetaField({ label, value, onChange, placeholder, disabled }: MetaFieldProps) {
  const [focused, setFocused] = useState(false)

  return (
    <div className="flex items-baseline gap-2 min-w-0">
      <span className="text-xs text-muted-foreground shrink-0 w-12 leading-none pt-px">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={disabled ? "" : placeholder}
        disabled={disabled}
        className={[
          "flex-1 min-w-0 text-xs bg-transparent outline-none rounded px-1.5 py-0.5 -ml-1.5 transition-colors",
          "placeholder:text-muted-foreground/40",
          disabled ? "cursor-default" : "cursor-text hover:bg-muted/50",
          focused ? "bg-muted/60 ring-1 ring-ring/30" : "",
        ].join(" ")}
      />
    </div>
  )
}
