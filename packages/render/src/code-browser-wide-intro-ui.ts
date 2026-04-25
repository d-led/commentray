export type WideIntroElements = {
  bubble: HTMLElement;
  arrowLayer: HTMLElement;
  titleEl: HTMLElement;
  bodyEl: HTMLElement;
  stepActionBtn: HTMLButtonElement;
  progressEl: HTMLElement;
  backBtn: HTMLButtonElement;
  nextBtn: HTMLButtonElement;
  skipBtn: HTMLButtonElement;
};

export function clearOpenWideModeIntroTourUi(): void {
  for (const el of Array.from(document.querySelectorAll(".commentray-wide-intro-target"))) {
    if (el instanceof HTMLElement) el.classList.remove("commentray-wide-intro-target");
  }
  const open = document.getElementById("commentray-wide-intro");
  if (open instanceof HTMLElement) open.remove();
  const arrows = document.getElementById("commentray-wide-intro-arrows");
  if (arrows instanceof HTMLElement) arrows.remove();
}

export function createWideIntroElements(): WideIntroElements | null {
  const arrowLayer = document.createElement("div");
  arrowLayer.id = "commentray-wide-intro-arrows";
  arrowLayer.setAttribute("aria-hidden", "true");
  document.body.appendChild(arrowLayer);

  const bubble = document.createElement("section");
  bubble.id = "commentray-wide-intro";
  bubble.setAttribute("role", "dialog");
  bubble.setAttribute("aria-live", "polite");
  bubble.innerHTML = `
    <span class="commentray-wide-intro-pointer" aria-hidden="true"></span>
    <p class="commentray-wide-intro-title"></p>
    <p class="commentray-wide-intro-body"></p>
    <button type="button" class="commentray-wide-intro-step-action" hidden></button>
    <div class="commentray-wide-intro-footer">
      <span class="commentray-wide-intro-progress"></span>
      <div class="commentray-wide-intro-actions">
        <button type="button" data-wide-intro="back">Back</button>
        <button type="button" data-wide-intro="next">Next</button>
        <button type="button" data-wide-intro="skip">Skip</button>
      </div>
    </div>
  `;
  document.body.appendChild(bubble);

  const titleEl = bubble.querySelector(".commentray-wide-intro-title");
  const bodyEl = bubble.querySelector(".commentray-wide-intro-body");
  const stepActionBtn = bubble.querySelector(".commentray-wide-intro-step-action");
  const progressEl = bubble.querySelector(".commentray-wide-intro-progress");
  const backBtn = bubble.querySelector('button[data-wide-intro="back"]');
  const nextBtn = bubble.querySelector('button[data-wide-intro="next"]');
  const skipBtn = bubble.querySelector('button[data-wide-intro="skip"]');
  if (
    !(titleEl instanceof HTMLElement) ||
    !(bodyEl instanceof HTMLElement) ||
    !(stepActionBtn instanceof HTMLButtonElement) ||
    !(progressEl instanceof HTMLElement) ||
    !(backBtn instanceof HTMLButtonElement) ||
    !(nextBtn instanceof HTMLButtonElement) ||
    !(skipBtn instanceof HTMLButtonElement)
  ) {
    arrowLayer.remove();
    bubble.remove();
    return null;
  }
  return {
    bubble,
    arrowLayer,
    titleEl,
    bodyEl,
    stepActionBtn,
    progressEl,
    backBtn,
    nextBtn,
    skipBtn,
  };
}
