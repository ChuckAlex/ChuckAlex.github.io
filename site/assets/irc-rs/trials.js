(() => {
  "use strict";
  function initialize(root) {
    if (root.dataset.trialsReady === "true") return;
    root.dataset.trialsReady = "true";
    const media = root.querySelector(".irc-trials__media");
    if (!media) return;
    const selector = media.querySelector(".irc-trials__selector");
    const buttons = [...selector.querySelectorAll("[data-trial-scene]")];
    const panels = [...media.querySelectorAll("[data-trial-panel]")];
    const videos = [...media.querySelectorAll("video")];
    const status = media.querySelector(".irc-trials__status");
    // Read the duration only for players approaching the viewport.
    if ("IntersectionObserver" in window) {
      const nearby = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.preload = "metadata";
            nearby.unobserve(entry.target);
          }
        }
      }, {rootMargin: "200px"});
      for (const video of videos) nearby.observe(video);
    }
    function pauseAll() { for (const video of videos) if (!video.paused) video.pause(); }
    function selectScene(key, explicit = false) {
      const selectedPanel = panels.find(panel => panel.dataset.trialPanel === key);
      if (!selectedPanel) return;
      pauseAll();
      for (const panel of panels) panel.hidden = panel.dataset.trialPanel !== key;
      for (const button of buttons) button.setAttribute("aria-pressed", String(button.dataset.trialScene === key));
      status.textContent = "";
      if (explicit) {
        root.dataset.sceneExplicit = "true";
        // Preserve a useful deep link without jumping the controls or adding
        // one browser-history entry per scenario choice. This works for both
        // local file pages and the local HTTP preview.
        const url = new URL(location.href);
        url.hash = selectedPanel.id;
        try { history.replaceState(history.state, "", url.href); } catch (_) {}
        window.dispatchEvent(new CustomEvent("portfolio:trialscenechange"));
      }
    }
    function showUnavailable(video) {
      if (video.dataset.failed === "true") return;
      video.dataset.failed = "true";
      const figure = video.closest("figure");
      const panel = video.closest("[data-trial-panel]");
      const sourceURL = video.querySelector("source")?.getAttribute("src") || video.getAttribute("src");
      const image = document.createElement("img");
      image.className = "irc-trials__poster";
      image.src = video.poster;
      image.alt = video.getAttribute("aria-label") || "";
      const message = document.createElement("p");
      message.className = "irc-trials__error"; message.setAttribute("role", "status");
      message.append(document.createTextNode((root.dataset.unavailable || "") + " "));
      if (sourceURL) {
        const link = document.createElement("a");
        link.href = sourceURL; link.textContent = root.dataset.openLabel || ""; message.append(link);
      }
      video.pause(); video.removeAttribute("src");
      for (const source of video.querySelectorAll("source")) source.removeAttribute("src");
      video.load(); video.replaceWith(image);
      figure.append(message);
      panel.querySelector('[data-trial-action="start"]').disabled = true;
    }
    for (const video of videos) {
      video.addEventListener("error", () => showUnavailable(video), {once: true});
      const source = video.querySelector("source");
      if (source) source.addEventListener("error", () => showUnavailable(video), {once: true});
    }
    for (const button of buttons) {
      button.addEventListener("click", () => selectScene(button.dataset.trialScene, true));
      button.addEventListener("keydown", event => {
        const index = buttons.indexOf(button);
        let next;
        if (event.key === "ArrowRight") next = (index + 1) % buttons.length;
        else if (event.key === "ArrowLeft") next = (index - 1 + buttons.length) % buttons.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = buttons.length - 1;
        else return;
        event.preventDefault(); buttons[next].focus(); buttons[next].click();
      });
    }
    for (const panel of panels) {
      const actions = panel.querySelector(".irc-trials__pair-actions");
      const pair = [...panel.querySelectorAll("video")];
      actions.hidden = false;
      actions.querySelector('[data-trial-action="pause"]').addEventListener("click", () => {
        for (const video of pair) video.pause();
      });
      actions.querySelector('[data-trial-action="start"]').addEventListener("click", () => {
        // Same click, independent files: do not claim frame or trial synchronization.
        pauseAll(); status.textContent = "";
        for (const video of pair) { try { video.currentTime = 0; } catch (_) {} }
        Promise.allSettled(pair.map(video => video.play())).then(results => {
          if (pair.every(video => video.dataset.failed !== "true") && results.some(result => result.status === "rejected")) {
            status.textContent = root.dataset.playBlocked || "";
          }
        });
      });
    }
    selector.hidden = false;
    function linkedPanel() {
      return panels.find(panel => panel.id === location.hash.slice(1));
    }
    const initialPanel = linkedPanel();
    selectScene(initialPanel?.dataset.trialPanel || root.dataset.defaultScene || "crossing");
    if (initialPanel) root.dataset.sceneExplicit = "true";
    window.addEventListener("hashchange", () => {
      const panel = linkedPanel();
      if (panel) root.dataset.sceneExplicit = "true";
      if (panel?.hidden) {
        selectScene(panel.dataset.trialPanel);
        panel.scrollIntoView();
      }
    });
  }
  function start() { document.querySelectorAll("[data-controlled-trials]").forEach(initialize); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, {once:true});
  else start();
})();
