/**
 * Deck navigation: one screen at a time, optional steps inside a screen,
 * hash routing (#/screen/step), keyboard control and a fullscreen present mode.
 */
interface Pos {
  screen: string;
  step: string | null;
}

interface ScreenInfo {
  el: HTMLElement;
  key: string;
  label: string;
  no: string | null;
  steps: { key: string; label: string; el: HTMLElement }[];
}

export class Deck {
  private screens: ScreenInfo[];
  private flat: Pos[];
  private cur: Pos = { screen: "cover", step: null };
  private drawer = document.getElementById("drawer")!;
  private drawerBody = document.getElementById("drawer-body")!;
  private drawerTitle = document.getElementById("drawer-title")!;
  private notesBtn = document.getElementById("notes-btn")!;

  constructor(private onNotes: (root: HTMLElement) => void) {
    this.screens = [...document.querySelectorAll<HTMLElement>(".screen")].map((el) => ({
      el,
      key: el.dataset.screen!,
      label: el.dataset.label!,
      no: el.dataset.no ?? null,
      steps: [...el.querySelectorAll<HTMLElement>(".step")].map((s) => ({ key: s.dataset.step!, label: s.dataset.label!, el: s })),
    }));
    this.flat = this.screens.flatMap((s): Pos[] => (s.steps.length ? s.steps.map((st) => ({ screen: s.key, step: st.key })) : [{ screen: s.key, step: null }]));
    this.buildTabs();
    this.buildSteps();
    this.bind();
    this.fromHash();
  }

  private buildTabs(): void {
    const nav = document.getElementById("tabs")!;
    nav.innerHTML = this.screens
      .filter((s) => s.no)
      .map((s) => `<button class="tab" type="button" data-screen="${s.key}"><b>${s.no}</b>${s.label}</button>`)
      .join("");
    nav.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-screen]");
      if (b) this.go({ screen: b.dataset.screen!, step: null });
    });
  }

  private buildSteps(): void {
    this.screens
      .filter((s) => s.steps.length)
      .forEach((s) => {
        const nav = s.el.querySelector<HTMLElement>(".steps")!;
        nav.innerHTML = s.steps.map((st, i) => `<button class="step-tab" type="button" data-step="${st.key}"><b>${i + 1}</b>${st.label}</button>`).join("");
        nav.addEventListener("click", (e) => {
          const b = (e.target as HTMLElement).closest<HTMLElement>("[data-step]");
          if (b) this.go({ screen: s.key, step: b.dataset.step! });
        });
      });
  }

  private bind(): void {
    window.addEventListener("hashchange", () => this.fromHash());
    document.getElementById("prev")!.addEventListener("click", () => this.move(-1));
    document.getElementById("next")!.addEventListener("click", () => this.move(1));
    document.getElementById("present-btn")!.addEventListener("click", () => this.togglePresent());
    this.notesBtn.addEventListener("click", () => this.toggleNotes());
    document.getElementById("drawer-close")!.addEventListener("click", () => this.toggleNotes(false));
    document.addEventListener("fullscreenchange", () => {
      if (!document.fullscreenElement) {
        document.documentElement.classList.remove("presenting");
        this.setPresentLabel(false);
      }
    });
    document.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("a.cite[data-ref]");
      if (!a) return;
      e.preventDefault();
      this.go({ screen: "conclusion", step: "limits" });
      requestAnimationFrame(() => {
        const li = document.getElementById(`ref-${a.dataset.ref}`);
        li?.scrollIntoView({ block: "center" });
        li?.animate([{ background: "#f1df9f" }, { background: "transparent" }], { duration: 1600 });
      });
    });
    document.addEventListener("keydown", (e) => this.onKey(e));
  }

  private onKey(e: KeyboardEvent): void {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target instanceof HTMLElement ? e.target : document.body;
    const typing = t.matches("input, textarea, select");
    if (typing && t.matches("input[type=range]") && (e.key === "ArrowLeft" || e.key === "ArrowRight")) return;
    if (typing && !t.matches("input[type=range]")) return;
    switch (e.key) {
      case "ArrowRight":
      case "PageDown":
        e.preventDefault();
        this.move(1);
        break;
      case "ArrowLeft":
      case "PageUp":
        e.preventDefault();
        this.move(-1);
        break;
      case " ":
        if (t.matches("button, a")) return;
        e.preventDefault();
        this.move(e.shiftKey ? -1 : 1);
        break;
      case "Home":
        this.go(this.flat[0]);
        break;
      case "End":
        this.go(this.flat[this.flat.length - 1]);
        break;
      case "p":
      case "P":
        this.togglePresent();
        break;
      case "n":
      case "N":
        this.toggleNotes();
        break;
      case "Escape":
        this.toggleNotes(false);
        break;
      default:
        if (/^[0-9]$/.test(e.key)) {
          const s = e.key === "0" ? this.screens[0] : this.screens.find((x) => x.no === `0${e.key}`);
          if (s) this.go({ screen: s.key, step: null });
        }
    }
  }

  private index(p: Pos): number {
    return this.flat.findIndex((f) => f.screen === p.screen && f.step === p.step);
  }

  move(d: number): void {
    const i = this.index(this.cur) + d;
    if (i >= 0 && i < this.flat.length) this.go(this.flat[i]);
  }

  private fromHash(): void {
    const [, screen, step] = location.hash.match(/^#\/([\w-]+)(?:\/([\w-]+))?/) ?? [];
    const s = this.screens.find((x) => x.key === screen) ?? this.screens[0];
    const st = s.steps.find((x) => x.key === step) ?? s.steps[0];
    this.show({ screen: s.key, step: st ? st.key : null });
  }

  go(p: Pos): void {
    const s = this.screens.find((x) => x.key === p.screen)!;
    const step = p.step ?? (s.steps[0]?.key || null);
    const hash = `#/${s.key}${step ? `/${step}` : ""}`;
    if (location.hash !== hash) history.replaceState(null, "", hash);
    this.show({ screen: s.key, step });
  }

  private show(p: Pos): void {
    this.cur = p;
    this.screens.forEach((s) => {
      const on = s.key === p.screen;
      s.el.classList.toggle("is-active", on);
      s.steps.forEach((st) => st.el.classList.toggle("is-active", on && st.key === p.step));
      s.el.querySelectorAll<HTMLElement>(".step-tab").forEach((b) => b.classList.toggle("is-active", on && b.dataset.step === p.step));
      if (on) s.el.scrollTop = 0;
    });
    document.querySelectorAll<HTMLElement>(".tab").forEach((b) => b.classList.toggle("is-active", b.dataset.screen === p.screen));
    document.querySelector(".tab.is-active")?.scrollIntoView({ block: "nearest", inline: "nearest" });

    const i = this.index(p);
    const s = this.screens.find((x) => x.key === p.screen)!;
    const st = s.steps.find((x) => x.key === p.step);
    const head = s.no ? `§${s.no} ${s.label}` : s.label;
    document.getElementById("pg-label")!.textContent = st ? `${head} · ${s.steps.indexOf(st) + 1}/${s.steps.length} ${st.label}` : head;
    (document.getElementById("pg-fill") as HTMLElement).style.width = `${(i / (this.flat.length - 1)) * 100}%`;
    (document.getElementById("prev") as HTMLButtonElement).disabled = i <= 0;
    (document.getElementById("next") as HTMLButtonElement).disabled = i >= this.flat.length - 1;
    document.title = `${st ? st.label : s.label} · From Audit to Accountability`;
    this.renderNotes();
  }

  private notesFor(): HTMLTemplateElement | null {
    const s = this.screens.find((x) => x.key === this.cur.screen)!;
    const st = s.steps.find((x) => x.key === this.cur.step);
    return (st?.el.querySelector<HTMLTemplateElement>(":scope > template.notes") ?? s.el.querySelector<HTMLTemplateElement>(":scope > template.notes")) || null;
  }

  private renderNotes(): void {
    const tpl = this.notesFor();
    this.notesBtn.toggleAttribute("disabled", !tpl);
    this.notesBtn.style.opacity = tpl ? "" : "0.4";
    if (!this.drawer.classList.contains("is-open")) return;
    const s = this.screens.find((x) => x.key === this.cur.screen)!;
    this.drawerTitle.textContent = `Details · ${s.label}`;
    this.drawerBody.innerHTML = "";
    if (tpl) {
      this.drawerBody.appendChild(tpl.content.cloneNode(true));
      this.onNotes(this.drawerBody);
    } else {
      this.drawerBody.innerHTML = "<p>No extra details for this view.</p>";
    }
  }

  toggleNotes(force?: boolean): void {
    const open = force ?? !this.drawer.classList.contains("is-open");
    this.drawer.classList.toggle("is-open", open);
    this.drawer.setAttribute("aria-hidden", String(!open));
    this.notesBtn.setAttribute("aria-pressed", String(open));
    this.renderNotes();
  }

  private setPresentLabel(on: boolean): void {
    document.getElementById("present-btn")!.innerHTML = on ? "Exit <kbd>P</kbd>" : "Present <kbd>P</kbd>";
  }

  togglePresent(): void {
    const html = document.documentElement;
    const on = !html.classList.contains("presenting");
    html.classList.toggle("presenting", on);
    this.setPresentLabel(on);
    if (on && !document.fullscreenElement) html.requestFullscreen?.().catch(() => undefined);
    if (!on && document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
  }
}
