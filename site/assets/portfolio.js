(() => {
  const languages = [...document.querySelectorAll("a[data-lang]")];
  const storageKey = "wenhao-portfolio-language";
  const pageLanguage = document.documentElement.lang === "zh-CN" ? "zh" : "en";
  const sections = [...document.querySelectorAll("main section[id], main #additional-work, main [data-work-entry][id], main [data-controlled-trials][id], main [data-trial-panel][id]")];
  function activeSection() {
    const threshold = document.querySelector("header").getBoundingClientRect().height + 32;
    const visible = sections.filter(section => section.getClientRects().length);
    // A short final chapter cannot always reach the header threshold before
    // the document hits its maximum scroll position.
    const atEnd = scrollY + innerHeight >= document.documentElement.scrollHeight - 3;
    if (atEnd) {
      const last = visible.filter(section => {
        const rect = section.getBoundingClientRect();
        return rect.bottom > threshold && rect.top < innerHeight;
      }).at(-1);
      if (last) return last.id;
    }
    const current = visible.filter(section => section.getBoundingClientRect().top <= threshold).at(-1);
    const gallery = document.querySelector("main [data-gallery]");
    if (gallery?.dataset.explicitScene === gallery?.dataset.selectedScene && gallery?.dataset.explicitScene) {
      const panel = gallery.querySelector(".gallery-stage").getBoundingClientRect();
      if (panel.bottom > threshold && panel.top < innerHeight)
        return "clip-" + gallery.dataset.selectedScene;
    }
    if (current?.matches("[data-work-entry]")) {
      const details = current.querySelector("details[open][id]");
      if (details && details.getBoundingClientRect().top < innerHeight) return details.id;
      return current.id;
    }
    for (const root of document.querySelectorAll("main [data-controlled-trials]")) {
      const rect = root.getBoundingClientRect();
      if (rect.bottom <= threshold || rect.top >= innerHeight) continue;
      const withinTrials = current && root.contains(current);
      const controls = root.querySelector(".irc-trials__selector")?.getBoundingClientRect();
      // The controls can be visible just below the header while the preceding
      // chapter still owns the scroll threshold. An explicit choice there is
      // the user's current context, even before the panel crosses that line.
      const explicitChoiceOnScreen = root.dataset.sceneExplicit === "true" && controls &&
        controls.bottom > threshold && controls.top < innerHeight;
      if (!withinTrials && !explicitChoiceOnScreen) continue;
      const button = root.querySelector('[data-trial-scene][aria-pressed="true"]');
      const panel = document.getElementById(button?.getAttribute("aria-controls"));
      if (panel && !panel.hidden) return panel.id;
    }
    return current?.id || location.hash.slice(1);
  }
  if (location.protocol !== "file:" && pageLanguage === "en" && document.body.classList.contains("page-home") &&
      location.pathname.endsWith("/") && !location.hash) {
    try {
      if (localStorage.getItem(storageKey) === "zh") {
        location.replace(languages.find(a => a.dataset.lang === "zh").href);
        return;
      }
    } catch {}
  }
  function syncAnchors() {
    const id = activeSection();
    for (const link of languages) {
      const href = new URL(link.href);
      href.hash = id || "";
      link.href = href.href;
    }
  }
  for (const link of languages) {
    link.addEventListener("click", () => {
      try { localStorage.setItem(storageKey, link.dataset.lang); } catch {}
      syncAnchors();
    });
  }
  addEventListener("scroll", syncAnchors, {passive: true});
  addEventListener("hashchange", syncAnchors);
  addEventListener("resize", syncAnchors);
  addEventListener("portfolio:trialscenechange", syncAnchors);
  addEventListener("portfolio:gallerychange", syncAnchors);
  function restoreWorkDetails() {
    const target = document.getElementById(location.hash.slice(1));
    if (target?.matches("[data-work-entry] details")) target.open = true;
  }
  addEventListener("hashchange", restoreWorkDetails);
  document.addEventListener("toggle", event => {
    if (event.target.matches?.("[data-work-entry] details")) syncAnchors();
  }, true);
  restoreWorkDetails();
  syncAnchors();

  const recordings = [...document.querySelectorAll(".recording[data-media]")];
  if (!recordings.length) return;
  let currentPlayer = null;

  function enableRecording(figure, sourceURL) {
    const frame = figure.querySelector(".frame");
    const img = frame?.querySelector("img");
    const button = frame?.querySelector("button");
    if (!frame || !img || !button) return;
    button.hidden = false;
    button.addEventListener("click", async () => {
      if (currentPlayer) currentPlayer.close(false);
      const video = document.createElement("video");
      video.controls = true;
      video.playsInline = true;
      video.preload = "none";
      video.poster = img.src;
      video.tabIndex = 0;
      video.style.objectFit = "contain";
      video.setAttribute("aria-label", img.alt);
      video.src = sourceURL;
      let restored = false;
      const player = {close};
      function close(focusButton = true, unavailable = false) {
        if (restored) return;
        restored = true;
        if (currentPlayer === player) currentPlayer = null;
        video.pause();
        video.removeAttribute("src");
        video.load();
        frame.replaceChildren(img, button);
        button.hidden = unavailable;
        if (focusButton && !unavailable) button.focus();
      }
      currentPlayer = player;
      // Missing or unsupported media returns to a clean poster, not a broken video.
      video.addEventListener("error", () => close(false, true), {once: true});
      frame.replaceChildren(video);
      video.focus();
      try {
        await video.play();
      } catch (error) {
        // If browser policy blocks play, native controls remain available.
        if (error.name !== "AbortError" && error.name !== "NotAllowedError") close(false, true);
      }
    });
  }

  for (const figure of recordings) {
    if (figure.dataset.source) enableRecording(figure, figure.dataset.source);
  }
})();
