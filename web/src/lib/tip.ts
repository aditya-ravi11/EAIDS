/** A single floating readout per figure, positioned inside `.fig-body`. */
export class Tip {
  private el: HTMLDivElement;

  constructor(private host: HTMLElement) {
    this.el = document.createElement("div");
    this.el.className = "tip";
    this.el.setAttribute("aria-hidden", "true");
    host.appendChild(this.el);
  }

  show(html: string, x: number, y: number): void {
    this.el.innerHTML = html;
    this.el.classList.add("is-on");
    const hostW = this.host.clientWidth;
    const w = this.el.offsetWidth;
    const left = x + 16 + w > hostW ? x - w - 16 : x + 16;
    this.el.style.left = `${Math.max(0, left)}px`;
    this.el.style.top = `${Math.max(0, y - 20)}px`;
  }

  hide(): void {
    this.el.classList.remove("is-on");
  }
}

export function row(label: string, value: string, swatch?: "b" | "w"): string {
  const sw = swatch ? `<i class="sw ${swatch}"></i>` : "";
  return `<div class="row"><span>${sw}${label}</span><span>${value}</span></div>`;
}
