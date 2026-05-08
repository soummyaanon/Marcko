/*!
 * Marcko Feedback Widget
 * Drop into any web app or Electron renderer with:
 *   <script src="https://marcko.bixai.dev/widget.js" data-key="fb_…"></script>
 * Or initialize manually:
 *   MarckoFeedback.init({ key: "fb_…" })
 */
(function () {
  "use strict"
  if (typeof window === "undefined") return
  if (window.__marckoFeedbackInitialized) return
  window.__marckoFeedbackInitialized = true

  var script = document.currentScript
  var defaultBase = "https://marcko.bixai.dev"
  var scriptBase = (function () {
    if (!script || !script.src) return defaultBase
    try {
      var u = new URL(script.src)
      return u.origin
    } catch (e) {
      return defaultBase
    }
  })()

  function $(tag, attrs, children) {
    var el = document.createElement(tag)
    if (attrs)
      for (var k in attrs) {
        if (k === "style" && typeof attrs[k] === "object") {
          for (var s in attrs[k]) el.style[s] = attrs[k][s]
        } else if (k === "className") {
          el.className = attrs[k]
        } else if (k === "dataset" && typeof attrs[k] === "object") {
          for (var d in attrs[k]) el.dataset[d] = attrs[k][d]
        } else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") {
          el.addEventListener(k.slice(2).toLowerCase(), attrs[k])
        } else if (attrs[k] !== false && attrs[k] != null) {
          el.setAttribute(k, attrs[k])
        }
      }
    if (children != null) {
      if (!Array.isArray(children)) children = [children]
      for (var i = 0; i < children.length; i++) {
        var c = children[i]
        if (c == null) continue
        if (typeof c === "string") el.appendChild(document.createTextNode(c))
        else el.appendChild(c)
      }
    }
    return el
  }

  function injectStyles(accent) {
    var existing = document.getElementById("marcko-feedback-styles")
    if (existing) {
      existing.parentNode.removeChild(existing)
    }
    var css = `
.marcko-fb-root, .marcko-fb-root * { box-sizing: border-box; }
.marcko-fb-trigger {
  position: fixed; right: 20px; bottom: 20px; z-index: 2147483646;
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 14px; border-radius: 9999px;
  font: 500 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #fff; background: ${accent}; border: none; cursor: pointer;
  box-shadow: 0 8px 24px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.08);
  transition: transform 120ms ease, box-shadow 120ms ease;
}
.marcko-fb-trigger:hover { transform: translateY(-1px); box-shadow: 0 10px 28px rgba(0,0,0,0.22); }
.marcko-fb-trigger svg { width: 14px; height: 14px; }
.marcko-fb-overlay {
  position: fixed; inset: 0; z-index: 2147483647;
  background: rgba(15,15,15,0.45); backdrop-filter: blur(2px);
  display: flex; align-items: flex-end; justify-content: flex-end;
  padding: 0 20px 20px 20px;
  font: 400 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #111;
}
@media (min-width: 480px) {
  .marcko-fb-overlay { padding: 24px; }
}
.marcko-fb-card {
  width: 100%; max-width: 380px; max-height: calc(100dvh - 40px);
  background: #fff; border-radius: 16px;
  box-shadow: 0 24px 48px rgba(0,0,0,0.24), 0 4px 12px rgba(0,0,0,0.08);
  display: flex; flex-direction: column; overflow: hidden;
  animation: marcko-fb-pop 180ms ease-out;
}
@keyframes marcko-fb-pop {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to { opacity: 1; transform: none; }
}
.marcko-fb-header { padding: 16px 18px 4px 18px; }
.marcko-fb-title { font-size: 16px; font-weight: 600; margin: 0; color: #111; }
.marcko-fb-subtitle { font-size: 12px; color: #6b7280; margin: 4px 0 0 0; }
.marcko-fb-close {
  position: absolute; top: 10px; right: 10px;
  width: 28px; height: 28px; border-radius: 8px; border: none;
  background: transparent; cursor: pointer; color: #6b7280;
  display: inline-flex; align-items: center; justify-content: center;
}
.marcko-fb-close:hover { background: #f3f4f6; color: #111; }
.marcko-fb-body { padding: 12px 18px 4px 18px; overflow-y: auto; flex: 1; }
.marcko-fb-q { margin: 12px 0; }
.marcko-fb-label { font-size: 12px; font-weight: 600; color: #111; display: block; margin-bottom: 6px; }
.marcko-fb-required { color: #ef4444; margin-left: 2px; }
.marcko-fb-input, .marcko-fb-textarea {
  width: 100%; padding: 9px 10px; font: inherit; font-size: 13px;
  border: 1px solid #e5e7eb; border-radius: 8px; background: #fafafa; color: #111;
  outline: none; transition: border-color 100ms ease, background 100ms ease;
}
.marcko-fb-input:focus, .marcko-fb-textarea:focus {
  border-color: ${accent}; background: #fff;
  box-shadow: 0 0 0 3px ${accent}1f;
}
.marcko-fb-textarea { resize: vertical; min-height: 72px; max-height: 200px; }
.marcko-fb-rating { display: flex; gap: 6px; }
.marcko-fb-star {
  width: 32px; height: 32px; border-radius: 8px; border: 1px solid #e5e7eb;
  background: #fafafa; cursor: pointer; display: inline-flex;
  align-items: center; justify-content: center; color: #9ca3af;
  transition: all 100ms ease; font-weight: 600; font-size: 13px;
}
.marcko-fb-star.is-active, .marcko-fb-star:hover { border-color: ${accent}; color: ${accent}; background: ${accent}10; }
.marcko-fb-choice { display: flex; flex-direction: column; gap: 6px; }
.marcko-fb-choice label {
  display: flex; align-items: center; gap: 8px; padding: 8px 10px;
  border: 1px solid #e5e7eb; border-radius: 8px; background: #fafafa;
  cursor: pointer; font-size: 13px;
}
.marcko-fb-choice label:hover { border-color: ${accent}; }
.marcko-fb-choice input[type="radio"] { accent-color: ${accent}; }
.marcko-fb-error {
  font-size: 12px; color: #b91c1c; background: #fef2f2;
  padding: 8px 10px; border-radius: 8px; margin: 8px 18px;
}
.marcko-fb-footer {
  padding: 12px 18px 16px 18px;
  display: flex; align-items: center; justify-content: space-between;
}
.marcko-fb-brand {
  font-size: 11px; color: #9ca3af; text-decoration: none;
}
.marcko-fb-brand:hover { color: #6b7280; }
.marcko-fb-submit {
  appearance: none; border: none; cursor: pointer;
  font: 600 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #fff; background: ${accent}; padding: 9px 16px; border-radius: 9999px;
  transition: opacity 120ms ease;
}
.marcko-fb-submit:disabled { opacity: 0.6; cursor: progress; }
.marcko-fb-success {
  padding: 28px 22px; text-align: center;
}
.marcko-fb-success-icon {
  width: 44px; height: 44px; border-radius: 9999px;
  background: ${accent}; color: #fff;
  display: inline-flex; align-items: center; justify-content: center;
  margin-bottom: 8px;
}
`
    var style = $("style", { id: "marcko-feedback-styles" })
    style.appendChild(document.createTextNode(css))
    document.head.appendChild(style)
  }

  function svgIcon(d) {
    var ns = "http://www.w3.org/2000/svg"
    var svg = document.createElementNS(ns, "svg")
    svg.setAttribute("viewBox", "0 0 24 24")
    svg.setAttribute("fill", "none")
    svg.setAttribute("stroke", "currentColor")
    svg.setAttribute("stroke-width", "2")
    svg.setAttribute("stroke-linecap", "round")
    svg.setAttribute("stroke-linejoin", "round")
    var path = document.createElementNS(ns, "path")
    path.setAttribute("d", d)
    svg.appendChild(path)
    return svg
  }

  function MarckoFeedback() {}

  // Tracks every initialized instance so the public API can target the right one
  var _instances = Object.create(null)
  var _defaultKey = null

  MarckoFeedback.init = function (options) {
    options = options || {}
    var key = options.key || (script ? script.getAttribute("data-key") : null)
    if (!key) {
      console.warn("[marcko-feedback] missing widget key")
      return
    }
    if (_instances[key]) return _instances[key].api
    if (!_defaultKey) _defaultKey = key
    var base = options.base || scriptBase || defaultBase
    var configUrl = base.replace(/\/$/, "") + "/api/feedback/public/" + encodeURIComponent(key)
    var submitUrl = configUrl + "/submit"

    // If true, suppress the auto-injected floating trigger; user attaches
    // their own via [data-marcko-feedback] or MarckoFeedback.open().
    var suppressTrigger =
      options.trigger === false ||
      (script &&
        (script.getAttribute("data-trigger") === "false" ||
          script.getAttribute("data-trigger") === "custom"))

    var state = {
      open: false,
      submitting: false,
      submitted: false,
      error: null,
      config: null,
      values: {},
    }

    var trigger = null
    var overlay = null

    fetch(configUrl, { method: "GET" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status)
        return r.json()
      })
      .then(function (config) {
        state.config = config
        injectStyles(config.accent || "#111111")
        if (!suppressTrigger) renderTrigger()
      })
      .catch(function (err) {
        console.warn("[marcko-feedback] failed to load widget config", err)
      })

    function renderTrigger() {
      if (trigger) trigger.remove()
      var icon = svgIcon("M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z")
      trigger = $(
        "button",
        {
          className: "marcko-fb-trigger marcko-fb-root",
          type: "button",
          "aria-label": state.config.triggerLabel || "Feedback",
          onclick: openDialog,
        },
        [icon, state.config.triggerLabel || "Feedback"],
      )
      document.body.appendChild(trigger)
    }

    function openDialog() {
      if (state.open) return
      state.open = true
      state.error = null
      state.submitted = false
      state.values = {}
      renderDialog()
    }

    function closeDialog() {
      state.open = false
      if (overlay) {
        overlay.remove()
        overlay = null
      }
    }

    function setValue(qid, value) {
      state.values[qid] = value
      // update DOM-bound rating buttons without re-render churn
      if (state.config) {
        var q = state.config.questions.find(function (x) {
          return x.id === qid
        })
        if (q && q.type === "rating") {
          var stars = overlay.querySelectorAll('.marcko-fb-rating[data-qid="' + qid + '"] .marcko-fb-star')
          for (var i = 0; i < stars.length; i++) {
            var n = Number(stars[i].dataset.value)
            if (n <= value) stars[i].classList.add("is-active")
            else stars[i].classList.remove("is-active")
          }
        }
      }
    }

    function renderQuestion(q) {
      var children = []
      var label = $("label", { className: "marcko-fb-label", for: "marcko-q-" + q.id }, q.label)
      if (q.required) label.appendChild($("span", { className: "marcko-fb-required" }, "*"))
      children.push(label)

      if (q.type === "rating") {
        var rating = $("div", { className: "marcko-fb-rating", dataset: { qid: q.id } })
        for (var i = 1; i <= 5; i++) {
          ;(function (n) {
            var star = $(
              "button",
              {
                className: "marcko-fb-star",
                type: "button",
                dataset: { value: String(n) },
                "aria-label": n + " star" + (n === 1 ? "" : "s"),
                onclick: function () {
                  setValue(q.id, n)
                },
              },
              String(n),
            )
            rating.appendChild(star)
          })(i)
        }
        children.push(rating)
      } else if (q.type === "long_text") {
        var ta = $("textarea", {
          className: "marcko-fb-textarea",
          id: "marcko-q-" + q.id,
          placeholder: q.placeholder || "",
          oninput: function (e) {
            setValue(q.id, e.target.value)
          },
        })
        children.push(ta)
      } else if (q.type === "single_choice") {
        var group = $("div", { className: "marcko-fb-choice" })
        var opts = Array.isArray(q.options) ? q.options : []
        for (var j = 0; j < opts.length; j++) {
          ;(function (option) {
            var radio = $("input", {
              type: "radio",
              name: "marcko-q-" + q.id,
              value: option,
              onchange: function (e) {
                setValue(q.id, e.target.value)
              },
            })
            var lbl = $("label", null, [radio, option])
            group.appendChild(lbl)
          })(opts[j])
        }
        children.push(group)
      } else {
        var input = $("input", {
          type: "text",
          className: "marcko-fb-input",
          id: "marcko-q-" + q.id,
          placeholder: q.placeholder || "",
          maxlength: 600,
          oninput: function (e) {
            setValue(q.id, e.target.value)
          },
        })
        children.push(input)
      }
      return $("div", { className: "marcko-fb-q" }, children)
    }

    function renderDialog() {
      if (overlay) overlay.remove()
      var config = state.config
      var card = $("div", { className: "marcko-fb-card", role: "dialog", "aria-modal": "true" })

      // close button (positioned absolute relative to card)
      card.style.position = "relative"
      var closeBtn = $(
        "button",
        {
          className: "marcko-fb-close",
          type: "button",
          "aria-label": "Close",
          onclick: closeDialog,
        },
        svgIcon("M18 6L6 18M6 6l12 12"),
      )
      card.appendChild(closeBtn)

      if (state.submitted) {
        var success = $("div", { className: "marcko-fb-success" }, [
          $(
            "div",
            { className: "marcko-fb-success-icon" },
            svgIcon("M5 13l4 4L19 7"),
          ),
          $("h3", { className: "marcko-fb-title" }, "Thanks for your feedback"),
          $("p", { className: "marcko-fb-subtitle" }, "We'll use this to improve."),
        ])
        card.appendChild(success)
      } else {
        var header = $("div", { className: "marcko-fb-header" }, [
          $("h3", { className: "marcko-fb-title" }, config.name || "Send feedback"),
          $(
            "p",
            { className: "marcko-fb-subtitle" },
            "Your response helps us improve.",
          ),
        ])
        card.appendChild(header)

        var body = $("div", { className: "marcko-fb-body" })
        var qs = Array.isArray(config.questions) ? config.questions : []
        for (var i = 0; i < qs.length; i++) {
          body.appendChild(renderQuestion(qs[i]))
        }
        card.appendChild(body)

        if (state.error) {
          card.appendChild($("div", { className: "marcko-fb-error" }, state.error))
        }

        var submitBtn = $(
          "button",
          {
            className: "marcko-fb-submit",
            type: "button",
            disabled: state.submitting ? "disabled" : false,
            onclick: handleSubmit,
          },
          state.submitting ? "Sending…" : "Send feedback",
        )
        var brand = $(
          "a",
          {
            className: "marcko-fb-brand",
            href: "https://marcko.bixai.dev",
            target: "_blank",
            rel: "noopener noreferrer",
          },
          "Powered by Marcko",
        )
        card.appendChild($("div", { className: "marcko-fb-footer" }, [brand, submitBtn]))
      }

      overlay = $(
        "div",
        {
          className: "marcko-fb-overlay marcko-fb-root",
          onclick: function (e) {
            if (e.target === overlay) closeDialog()
          },
        },
        card,
      )
      document.body.appendChild(overlay)
    }

    function handleSubmit() {
      if (state.submitting) return
      state.error = null

      // Client-side required check (server enforces too)
      var qs = state.config.questions || []
      for (var i = 0; i < qs.length; i++) {
        var q = qs[i]
        var v = state.values[q.id]
        if (q.required && (v === undefined || v === null || v === "")) {
          state.error = "Please answer: " + q.label
          renderDialog()
          return
        }
      }
      if (Object.keys(state.values).length === 0) {
        state.error = "Please answer at least one question."
        renderDialog()
        return
      }

      state.submitting = true
      renderDialog()

      var pageUrl
      try {
        pageUrl = window.location ? String(window.location.href).slice(0, 500) : null
      } catch (e) {
        pageUrl = null
      }

      var sentAnswers = state.values
      fetch(submitUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: sentAnswers, pageUrl: pageUrl }),
      })
        .then(function (r) {
          return r.json().then(
            function (j) {
              return { ok: r.ok, body: j }
            },
            function () {
              return { ok: r.ok, body: {} }
            },
          )
        })
        .then(function (out) {
          state.submitting = false
          if (out.ok) {
            state.submitted = true
            renderDialog()
            try {
              window.dispatchEvent(
                new CustomEvent("marcko:submit", {
                  detail: { key: key, answers: sentAnswers },
                }),
              )
            } catch (e) {
              /* legacy browsers: ignore */
            }
            setTimeout(function () {
              if (state.submitted) closeDialog()
            }, 2200)
          } else {
            state.error = (out.body && out.body.message) || "Failed to send. Try again."
            renderDialog()
          }
        })
        .catch(function () {
          state.submitting = false
          state.error = "Network error. Check your connection and try again."
          renderDialog()
        })
    }

    var api = {
      key: key,
      open: openDialog,
      close: closeDialog,
    }
    _instances[key] = { api: api, openDialog: openDialog, closeDialog: closeDialog }
    return api
  }

  // Public programmatic API: MarckoFeedback.open() / .close()
  // Optional first arg is the widget key; defaults to the first-initialized instance.
  MarckoFeedback.open = function (maybeKey) {
    var k = typeof maybeKey === "string" ? maybeKey : _defaultKey
    var inst = k && _instances[k]
    if (!inst) {
      console.warn("[marcko-feedback] open() called before init or unknown key")
      return
    }
    inst.openDialog()
  }
  MarckoFeedback.close = function (maybeKey) {
    var k = typeof maybeKey === "string" ? maybeKey : _defaultKey
    var inst = k && _instances[k]
    if (!inst) return
    inst.closeDialog()
  }

  // Click-to-open: any element with [data-marcko-feedback] (or
  // [data-marcko-feedback="OPEN_KEY"]) opens the matching widget. Lets users
  // attach their own button or menu item without writing any JS.
  function attachClickDelegation() {
    if (window.__marckoFeedbackDelegated) return
    window.__marckoFeedbackDelegated = true
    document.addEventListener("click", function (event) {
      var target = event.target
      if (!target || !target.closest) return
      var el = target.closest("[data-marcko-feedback]")
      if (!el) return
      event.preventDefault()
      var attr = el.getAttribute("data-marcko-feedback")
      var k = attr && attr !== "" && attr !== "trigger" ? attr : null
      MarckoFeedback.open(k || undefined)
    })
  }

  // Auto-init from script tag
  if (script && script.getAttribute("data-key")) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        MarckoFeedback.init()
        attachClickDelegation()
      })
    } else {
      MarckoFeedback.init()
      attachClickDelegation()
    }
  } else {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", attachClickDelegation)
    } else {
      attachClickDelegation()
    }
  }

  window.MarckoFeedback = MarckoFeedback
})()
