/**
 * Copy text to the clipboard, restoring focus when possible (needed after `await` or if a
 * dialog will open next — otherwise `writeText` can throw NotAllowedError).
 */
export async function copyTextToClipboard (text: string): Promise<boolean> {
  if (typeof window === "undefined") {
    return false
  }
  try {
    window.focus()
  } catch {
    // ignore
  }
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement("textarea")
      ta.value = text
      ta.setAttribute("readonly", "readonly")
      ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0"
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      const ok = document.execCommand("copy")
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}
