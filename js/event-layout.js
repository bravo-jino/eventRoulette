(() => {
  const page = document.querySelector(".event-page");
  if (!page) return;

  function fitPage() {
    const viewport = window.visualViewport;
    const width = viewport ? viewport.width : window.innerWidth;
    const height = viewport ? viewport.height : window.innerHeight;
    const scale = Math.min(width / 1080, height / 1920);
    page.style.setProperty("--event-scale", scale);
    page.style.setProperty("--event-left", `${(viewport?.offsetLeft || 0) + width / 2}px`);
    page.style.setProperty("--event-top", `${(viewport?.offsetTop || 0) + height / 2}px`);
    window.dispatchEvent(new Event("roulette-layout"));
  }

  window.addEventListener("resize", fitPage);
  window.visualViewport?.addEventListener("resize", fitPage);
  window.visualViewport?.addEventListener("scroll", fitPage);
  fitPage();
})();
