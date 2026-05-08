"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, Code2, Copy, Eye, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface LivePreviewSandboxProps {
  /** The author-provided source. Can be a full HTML document, an HTML snippet, pure CSS, or pure JS. */
  source: string
  /** Hint about what kind of source was provided. */
  language: "html" | "css" | "javascript"
}

const isFullHtmlDocument = (src: string) => /<!doctype\s+html|<html[\s>]/i.test(src)

const HEIGHT_MESSAGE_TYPE = "marcko-live-preview-height"

const buildSrcDoc = (source: string, language: LivePreviewSandboxProps["language"]) => {
  const reportHeightScript = `
<script>
(function(){
  var lastSent = -1;
  function measure(){
    var b = document.body;
    var d = document.documentElement;
    return Math.max(
      b ? b.scrollHeight : 0,
      b ? b.offsetHeight : 0,
      d ? d.scrollHeight : 0,
      d ? d.offsetHeight : 0
    );
  }
  function send(){
    try {
      var h = measure();
      if (h === lastSent) return;
      lastSent = h;
      parent.postMessage({ type: ${JSON.stringify(HEIGHT_MESSAGE_TYPE)}, height: h }, "*");
    } catch (e) {}
  }
  // Fire as early as possible
  send();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", send);
  }
  window.addEventListener("load", send);
  window.addEventListener("resize", send);
  if (typeof ResizeObserver !== "undefined") {
    try {
      var ro = new ResizeObserver(send);
      if (document.documentElement) ro.observe(document.documentElement);
      if (document.body) ro.observe(document.body);
    } catch (e) {}
  }
  if (document.body) {
    var mo = new MutationObserver(send);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
  }
  // Catch async layout shifts (fonts, images, late JS)
  if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === "function") {
    document.fonts.ready.then(send).catch(function(){});
  }
  requestAnimationFrame(send);
  setTimeout(send, 0);
  setTimeout(send, 120);
})();
<\/script>`

  const baseStyles = `
<style>
  html, body { margin: 0; padding: 0; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #111;
    background: #fff;
    padding: 12px;
    box-sizing: border-box;
  }
  *, *::before, *::after { box-sizing: border-box; }
  @media (prefers-color-scheme: dark) {
    body { background: #0b0b0b; color: #f5f5f5; }
  }
</style>`

  if (language === "html" && isFullHtmlDocument(source)) {
    // User provided a full document — only inject the height reporter.
    if (/<\/body>/i.test(source)) {
      return source.replace(/<\/body>/i, `${reportHeightScript}</body>`)
    }
    return source + reportHeightScript
  }

  let bodyContent = ""
  let inlineStyle = ""
  let inlineScript = ""

  if (language === "html") {
    bodyContent = source
  } else if (language === "css") {
    inlineStyle = `<style>${source}</style>`
    bodyContent = `<div class="marcko-css-demo">CSS preview — add HTML in an <code>html</code> block to see it applied here.</div>`
  } else {
    inlineScript = `<script>${source}<\/script>`
    bodyContent = `<div id="output"></div>`
  }

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${baseStyles}
${inlineStyle}
</head>
<body>
${bodyContent}
${inlineScript}
${reportHeightScript}
</body>
</html>`
}

export function LivePreviewSandbox({ source, language }: LivePreviewSandboxProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [view, setView] = useState<"preview" | "code">("preview")
  const initialHeight = useMemo(() => {
    const lines = source.split("\n").length
    // Rough guess so the frame doesn't pop in from tiny.
    return Math.min(Math.max(220, lines * 16 + 80), 600)
  }, [source])
  const [height, setHeight] = useState<number>(initialHeight)
  const [copied, setCopied] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const srcDoc = useMemo(() => buildSrcDoc(source, language), [source, language])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return
      const data = event.data as { type?: string; height?: number } | null
      if (!data || data.type !== HEIGHT_MESSAGE_TYPE) return
      const next = typeof data.height === "number" ? data.height : 0
      if (!Number.isFinite(next) || next <= 0) return
      const clamped = Math.min(Math.max(next + 8, 80), 1600)
      setHeight((prev) => (prev === clamped ? prev : clamped))
    }
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(source)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  const label =
    language === "html" ? "HTML" : language === "css" ? "CSS" : "JavaScript"

  return (
    <div className="my-4 overflow-hidden rounded-md border border-border bg-card">
      <div className="flex h-9 items-center justify-between border-b border-border bg-muted/40 px-2">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant={view === "preview" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={() => setView("preview")}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </Button>
          <Button
            type="button"
            variant={view === "code" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={() => setView("code")}
          >
            <Code2 className="h-3.5 w-3.5" />
            {label}
          </Button>
        </div>
        <div className="flex items-center gap-1">
          {view === "preview" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={() => setReloadKey((k) => k + 1)}
              aria-label="Reload preview"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reload
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy
                </>
              )}
            </Button>
          )}
        </div>
      </div>
      {view === "preview" ? (
        <iframe
          key={reloadKey}
          ref={iframeRef}
          title="Live preview"
          sandbox="allow-scripts allow-forms allow-popups allow-modals"
          srcDoc={srcDoc}
          loading="eager"
          referrerPolicy="no-referrer"
          className="block w-full border-0 bg-white dark:bg-neutral-950"
          style={{ height }}
        />
      ) : (
        <pre className="m-0 max-h-[480px] overflow-auto bg-muted/30 p-3 text-xs leading-relaxed">
          <code>{source}</code>
        </pre>
      )}
    </div>
  )
}
