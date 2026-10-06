if (location.hostname === "ytkgeo.github.io" && location.pathname.startsWith("/yutianke/")) {
  const counter = document.querySelector("[data-visitor-count]") || new Image();
  counter.referrerPolicy = "no-referrer";
  counter.addEventListener("load", () => { counter.hidden = false; });
  counter.src = "https://hits.sh/ytkgeo.github.io/yutianke.svg?view=total&style=flat-square&label=%20&color=transparent&labelColor=transparent";
}
