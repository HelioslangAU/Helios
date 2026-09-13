// Helios Settings — readiness board
// Reports whether each link of the study loop (look up, mark, mine, watch) actually works,
// and sends the learner straight to the one control that fixes a broken link.

class HeliosReadinessBoard {
  constructor(manager) {
    this.manager = manager;
    this.rowsElement = document.getElementById("readiness-rows");
    this.summaryElement = document.getElementById("readiness-summary");
    this.badgeElement = document.getElementById("rail-attention-count");
    this.toggleElement = document.getElementById("readiness-toggle");
    this.expanded = false;

    this.toggleElement?.addEventListener("click", () => {
      this.expanded = !this.expanded;
      this.render();
    });
  }

  get settings() {
    return this.manager.settings || {};
  }

  static prefersReducedMotion() {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }

  languageName(code) {
    return (
      {
        zh: "Chinese",
        en: "English",
        es: "Spanish",
        fr: "French",
      }[code] || null
    );
  }

  describeHotkey(hotkey) {
    if (!hotkey) return null;
    if (typeof hotkey === "string") return hotkey.toUpperCase();
    if (!hotkey.key) return null;

    const parts = [];
    if (hotkey.ctrl) parts.push("Ctrl");
    if (hotkey.shift) parts.push("Shift");
    if (hotkey.alt) parts.push("Alt");
    parts.push(hotkey.key.toUpperCase());
    return parts.join("+");
  }

  hasExpressionMapping() {
    const mappings = this.settings.ankiFieldMappings || {};
    return Object.values(mappings).some(
      (value) => value === "expression" || value === "expressionRubyTxt"
    );
  }

  /**
   * One entry per link in the loop, in the order the loop runs.
   *
   * status is one of:
   *   ok        working
   *   attention broken, and the learner can act on it here
   *   blocked   cannot be judged until an upstream row is fixed
   *   checking  still being probed
   *   off       switched off deliberately
   *
   * Only `attention` rows are counted, so one failure upstream does not get
   * reported three times over.
   */
  buildChecks() {
    const settings = this.settings;
    const language = this.languageName(settings.targetLanguage);
    const probed = Boolean(this.manager.anki?.connectionChecked);
    const connected = Boolean(this.manager.anki?.isConnected);
    const deck = settings.ankiDeck;
    const noteType = settings.ankiNoteType;
    const videoPlayer = settings.videoPlayer || {};
    const videoKeys = videoPlayer.hotkeys || {};

    const downstream = (check) => {
      if (!probed) {
        return { ...check, status: "checking", value: "Waiting for Anki", control: null };
      }
      if (!connected) {
        return {
          ...check,
          status: "blocked",
          value: "Needs the Anki connection first",
          control: null,
        };
      }
      return check;
    };

    return [
      {
        group: "Look up",
        label: "Language",
        status: language ? "ok" : "attention",
        value: language
          ? `Learning ${language}`
          : "No language chosen, so nothing is looked up",
        control: "target-language",
        section: "section-general",
      },
      {
        group: "Look up",
        label: "Lookup",
        status: settings.extensionEnabled ? "ok" : "off",
        value: settings.extensionEnabled
          ? `Hold ${settings.activationKey || "Shift"} and hover a word`
          : "Helios is turned off on every page",
        control: "extension-enabled",
        section: "section-general",
      },
      {
        group: "Mark",
        label: "Unknown words",
        status: settings.autoHighlight ? "ok" : "off",
        value: settings.autoHighlight
          ? "Underlined as each page loads"
          : "Not underlined, so nothing is marked for you",
        control: "auto-highlight",
        section: "section-general",
      },
      {
        group: "Mine",
        label: "Anki",
        status: !probed ? "checking" : connected ? "ok" : "attention",
        value: !probed
          ? "Checking localhost:8765"
          : connected
          ? "Connected on localhost:8765"
          : "Not reachable — open Anki and check the AnkiConnect add-on",
        control: probed && !connected ? "test-anki-connection" : null,
        section: "section-anki",
      },
      downstream({
        group: "Mine",
        label: "Card destination",
        status: deck && noteType ? "ok" : "attention",
        value:
          deck && noteType
            ? `${deck} · ${noteType}`
            : deck
            ? "Deck chosen, note type still missing"
            : "No deck chosen, so mining has nowhere to go",
        control: deck ? "anki-note-type-select" : "anki-deck-select",
        section: "section-anki",
      }),
      downstream({
        group: "Mine",
        label: "Field mapping",
        status: this.hasExpressionMapping() ? "ok" : "attention",
        value: this.hasExpressionMapping()
          ? "Expression is mapped, so cards and imports work"
          : "Nothing maps to Expression, so cards arrive empty",
        control: "anki-field-mapping-body",
        section: "section-anki",
      }),
      {
        group: "Watch",
        label: "Video keys",
        status: videoPlayer.hotkeysEnabled === false ? "off" : "ok",
        value:
          videoPlayer.hotkeysEnabled === false
            ? "Subtitle navigation keys are turned off"
            : `${this.describeHotkey(videoKeys.previous) || "A"} and ${
                this.describeHotkey(videoKeys.next) || "D"
              } move between subtitles`,
        control: "video-hotkeys-enabled",
        section: "section-video-player",
      },
    ];
  }

  render() {
    if (!this.rowsElement) return;

    const checks = this.buildChecks();
    const quiet = checks.every((check) => check.status === "ok");

    // Once every step is green the list is dead weight at the top of the page,
    // so it stands down to a single line until asked for.
    const showRows = !quiet || this.expanded;
    this.rowsElement.hidden = !showRows;
    if (showRows) {
      this.rowsElement.replaceChildren(
        ...checks.map((check) => this.renderRow(check))
      );
    } else {
      this.rowsElement.replaceChildren();
    }

    if (this.toggleElement) {
      this.toggleElement.hidden = !quiet;
      this.toggleElement.textContent = this.expanded
        ? "Hide the steps"
        : `Show all ${checks.length} steps`;
      this.toggleElement.setAttribute("aria-expanded", String(this.expanded));
    }

    this.renderSummary(checks);
  }

  statusMeta(status) {
    return {
      ok: { icon: "i-check", word: "Working" },
      attention: { icon: "i-alert", word: "Needs attention" },
      blocked: { icon: "i-off", word: "Blocked" },
      checking: { icon: "i-pending", word: "Checking" },
      off: { icon: "i-off", word: "Turned off" },
    }[status];
  }

  renderRow(check) {
    const row = document.createElement("li");
    row.className = "board__row";
    row.dataset.status = check.status;

    const meta = this.statusMeta(check.status);

    const status = document.createElement("span");
    status.className = "board__status";
    status.innerHTML = `<svg aria-hidden="true"><use href="#${meta.icon}" /></svg>`;
    status.setAttribute("role", "img");
    status.setAttribute("aria-label", meta.word);

    const text = document.createElement("div");
    const label = document.createElement("span");
    label.className = "board__label";
    label.textContent = check.label;
    const value = document.createElement("span");
    value.className = "board__value";
    value.textContent = check.value;
    text.append(label, value);

    row.append(status, text);

    const actionable = check.status === "attention" || check.status === "off";
    if (actionable && check.control) {
      const verb = check.status === "attention" ? "Fix" : "Change";
      const fix = document.createElement("button");
      fix.type = "button";
      fix.className = "btn btn-secondary btn--compact board__fix";
      fix.innerHTML = `${verb}<svg class="btn__icon" aria-hidden="true"><use href="#i-arrow" /></svg>`;
      fix.setAttribute("aria-label", `${verb} ${check.label.toLowerCase()}`);
      fix.addEventListener("click", () => this.reveal(check));
      row.append(fix);
    }

    return row;
  }

  /**
   * The signature move: jump to the exact control behind a failing row,
   * focus it, and mark its group once so the eye lands in the right place.
   */
  reveal(check) {
    const control = document.getElementById(check.control);
    const section = document.getElementById(check.section);
    const target = control || section;
    if (!target) return;

    const reduced = HeliosReadinessBoard.prefersReducedMotion();
    const group = control?.closest(".field, .section-card") || section;
    (group || target).scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "center",
    });

    if (control) {
      const focusTarget = control.matches("input, select, textarea, button")
        ? control
        : control.querySelector("input, select, textarea, button");
      focusTarget?.focus({ preventScroll: true });
    }

    if (!group || !group.classList) return;

    // Without motion the pulse would be invisible, so hold a static mark instead.
    if (reduced) {
      document
        .querySelectorAll(".is-marked")
        .forEach((node) => node.classList.remove("is-marked"));
      group.classList.add("is-marked");
      clearTimeout(this.markTimer);
      this.markTimer = setTimeout(
        () => group.classList.remove("is-marked"),
        4000
      );
      return;
    }

    group.classList.remove("is-flashed");
    void group.offsetWidth;
    group.classList.add("is-flashed");
    group.addEventListener(
      "animationend",
      () => group.classList.remove("is-flashed"),
      { once: true }
    );
  }

  renderSummary(checks) {
    const attention = checks.filter((c) => c.status === "attention").length;
    const blocked = checks.filter((c) => c.status === "blocked").length;
    const checking = checks.filter((c) => c.status === "checking").length;
    const off = checks.filter((c) => c.status === "off").length;

    if (this.summaryElement) {
      let message;
      if (attention === 1) {
        message =
          blocked > 0
            ? `One step is blocking the loop, and ${blocked} more cannot be checked yet.`
            : "One step is blocking the loop. Everything else is working.";
      } else if (attention > 1) {
        message =
          blocked > 0
            ? `${attention} steps are blocking the loop, and ${blocked} more cannot be checked yet.`
            : `${attention} steps are blocking the loop.`;
      } else if (checking > 0) {
        message = "Checking the steps that depend on Anki…";
      } else if (off > 0) {
        message = `Every step is working. ${off} ${
          off === 1 ? "is" : "are"
        } switched off on purpose.`;
      } else {
        message = "Look up, mark, mine, and watch are all working.";
      }

      this.summaryElement.textContent = message;
      this.summaryElement.dataset.tone = attention > 0 ? "attention" : "ok";
    }

    if (this.badgeElement) {
      this.badgeElement.textContent = attention;
      this.badgeElement.hidden = attention === 0;
      this.badgeElement.setAttribute(
        "aria-label",
        `${attention} steps need attention`
      );
    }
  }
}

window.HeliosReadinessBoard = HeliosReadinessBoard;
