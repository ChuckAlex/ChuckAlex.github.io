/* Method V2 viewer, restricted to the Level 1/2 catalog emitted by the renderer. */
(() => {
  "use strict";
  const viewer = document.querySelector("#mv2-diagram-viewer");
  const catalogNode = document.querySelector("#mv2-diagram-catalog");
  const copyNode = document.querySelector("#mv2-viewer-copy");
  if (!viewer || !catalogNode || !copyNode || viewer.dataset.ready) return;
  viewer.dataset.ready = "true";
  const catalog = JSON.parse(catalogNode.textContent);
  const ui = JSON.parse(copyNode.textContent);
  const shell = viewer.querySelector(".mv2-viewer-shell");
  const image = viewer.querySelector(".mv2-viewer-image");
  const scroll = viewer.querySelector(".mv2-viewer-scroll");
  const status = viewer.querySelector("[data-mv2-zoom-status]");
  const error = viewer.querySelector(".mv2-viewer-error");
  const pageLanguage = document.querySelector(".mv2-public").dataset.methodLanguage;
  let currentId, opener, zoom = 1, naturalWidth = 1, naturalHeight = 1, loadToken = 0;

  function size(value) {
    zoom = Math.max(0.08, Math.min(4, value));
    image.style.width = Math.round(naturalWidth * zoom) + "px";
    image.style.height = "auto";
    status.textContent = Math.round(zoom * 100) + "%";
  }
  function fit() {
    size(Math.min(1, Math.max(1, scroll.clientWidth - 40) / naturalWidth,
      Math.max(1, scroll.clientHeight - 40) / naturalHeight));
    scroll.scrollTo(0, 0);
  }
  function translate(language) {
    const item = catalog[currentId];
    if (!item || !item.sources[language]) return;
    const token = ++loadToken;
    viewer.querySelector("#mv2-viewer-heading").textContent = item.title[language];
    image.alt = item.title[language];
    error.hidden = true;
    viewer.querySelectorAll("[data-mv2-image-language]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.mv2ImageLanguage === language));
    });
    image.onload = () => {
      if (token !== loadToken) return;
      naturalWidth = image.naturalWidth;
      naturalHeight = image.naturalHeight;
      fit();
    };
    image.onerror = () => { if (token === loadToken) error.hidden = false; };
    image.src = item.sources[language];
  }
  document.querySelectorAll("[data-mv2-viewer]").forEach(link => {
    link.addEventListener("click", event => {
      if (!viewer.showModal || !catalog[link.dataset.mv2Viewer] || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      currentId = link.dataset.mv2Viewer;
      opener = link;
      if (!viewer.open) viewer.showModal();
      document.documentElement.classList.add("mv2-viewer-open");
      translate(pageLanguage);
    });
  });
  async function leaveFullscreen() {
    if (document.fullscreenElement === shell && document.exitFullscreen) {
      try { await document.exitFullscreen(); } catch (_) { /* Native Escape may have exited already. */ }
    }
  }
  async function closeViewer() {
    await leaveFullscreen();
    if (viewer.open) viewer.close();
  }
  viewer.querySelector("[data-mv2-close]").addEventListener("click", closeViewer);
  viewer.addEventListener("cancel", event => { event.preventDefault(); closeViewer(); });
  viewer.addEventListener("close", async () => {
    if (viewer.open) return;
    const returnFocus = opener;
    await leaveFullscreen();
    if (viewer.open) return;
    document.documentElement.classList.remove("mv2-viewer-open");
    if (returnFocus && returnFocus.isConnected) returnFocus.focus({preventScroll:true});
  });
  viewer.querySelector("[data-mv2-fit]").addEventListener("click", fit);
  viewer.querySelector("[data-mv2-actual]").addEventListener("click", () => size(1));
  viewer.querySelector("[data-mv2-zoom-in]").addEventListener("click", () => size(zoom * 1.25));
  viewer.querySelector("[data-mv2-zoom-out]").addEventListener("click", () => size(zoom / 1.25));
  viewer.querySelectorAll("[data-mv2-image-language]").forEach(button => {
    button.addEventListener("click", () => translate(button.dataset.mv2ImageLanguage));
  });
  const fullscreen = viewer.querySelector("[data-mv2-fullscreen]");
  if (!shell.requestFullscreen) fullscreen.hidden = true;
  fullscreen.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement === shell) await document.exitFullscreen();
      else await shell.requestFullscreen();
      fit();
    } catch (_) { /* The dialog remains scrollable when native fullscreen is unavailable. */ }
  });
  document.addEventListener("fullscreenchange", () => {
    fullscreen.textContent = document.fullscreenElement === shell ? ui.exit_fullscreen : ui.fullscreen;
    if (viewer.open) requestAnimationFrame(fit);
  });
  window.addEventListener("resize", () => { if (viewer.open) fit(); });
})();
