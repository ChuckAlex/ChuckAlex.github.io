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
        location.replace(portfolioRedirectURL(languages.find(a => a.dataset.lang === "zh").href));
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

  function portfolioCampaignQuery() {
    const params = new URLSearchParams(location.search);
    const source = params.get("utm_source");
    if (params.get("utm_campaign") !== "portfolio" ||
        !["cv", "faculty-email", "github-profile"].includes(source)) return "";
    // Rebuild from known values so unrelated or identifying parameters never leave the site.
    return "?utm_campaign=portfolio&utm_source=" + source;
  }

  function portfolioRedirectURL(destination) {
    const url = new URL(destination, location.href);
    url.search = portfolioCampaignQuery();
    if (location.hash === "#stats-off" || location.hash === "#stats-on") url.hash = location.hash;
    return url.href;
  }

  const analyticsExclusionKey = "portfolio-stats-excluded";
  let managingStatsHere = false;

  function statsPreference() {
    if (!["#stats-off", "#stats-on"].includes(location.hash)) return false;
    managingStatsHere = true;
    const exclude = location.hash === "#stats-off";
    const zh = document.documentElement.lang.startsWith("zh");
    let message;
    try {
      if (exclude) localStorage.setItem(analyticsExclusionKey, "1");
      else localStorage.removeItem(analyticsExclusionKey);
      if (exclude) {
        message = zh ? "已在此浏览器排除自己的访问。" : "Visits from this browser are now excluded.";
      } else {
        message = zh ? "已取消此浏览器的自访排除。下次访问起仍会遵守浏览器隐私设置。"
                     : "Browser exclusion cleared. Your browser’s privacy settings still apply on future visits.";
      }
    } catch {
      message = zh ? "浏览器未能保存设置，本页已暂停统计。"
                   : "Your browser could not save the preference. Counting is paused on this page.";
    }
    let status = document.getElementById("portfolio-stats-status");
    if (!status) {
      status = document.createElement("p");
      status.id = "portfolio-stats-status";
      status.setAttribute("role", "status");
      status.className = "wrap";
      document.querySelector("main").prepend(status);
    }
    status.textContent = message;
    status.scrollIntoView({block: "center"});
    return true;
  }

  function statsAllowed() {
    if (managingStatsHere || document.prerendering || location.origin !== "https://chuckalex.github.io" ||
        navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true) return false;
    // Check on every send so an exclusion set in another tab takes effect immediately.
    try { return localStorage.getItem(analyticsExclusionKey) !== "1"; }
    catch { return false; }
  }

  function sendPortfolioCount(params) {
    if (!statsAllowed()) return;
    const url = new URL("https://calibration.goatcounter.com/count");
    url.search = new URLSearchParams(params).toString();
    fetch(url, {
      mode: "no-cors",
      credentials: "omit",
      referrerPolicy: "origin",
      cache: "no-store",
      keepalive: true,
    }).catch(() => {}); // A blocked request must not affect the site.
  }

  const portfolioEventNames = new Set([
    "video-vla-desk-start", "video-vla-desk-30s", "video-vla-fruit-start", "video-irc-real-start",
    "video-compare-crossing-start", "video-compare-headon-start", "video-compare-diagonal-start",
    "detail-vla-method", "detail-irc-method", "detail-work-deepfake", "detail-work-arm",
    "detail-work-flight", "link-id3-paper", "link-contact-email",
  ]);

  function countPortfolioEvent(name) {
    if (portfolioEventNames.has(name)) sendPortfolioCount({p: name, e: "1"});
  }

  function countPageview() {
    if (statsPreference()) return;
    // Retain the historical shared paths for English and Chinese.
    const pages = {
      "page-home": "/",
      "page-vla": "/projects/heterogeneous-vla/",
      "page-rl": "/projects/rl-navigation/",
    };
    const pageClass = [...document.body.classList].find(name => Object.hasOwn(pages, name));
    if (!pageClass) return;
    const params = {p: pages[pageClass]};
    const campaign = portfolioCampaignQuery();
    if (campaign) params.q = campaign;
    sendPortfolioCount(params);
  }

  addEventListener("hashchange", () => {
    if (!document.prerendering && !statsPreference()) document.getElementById("portfolio-stats-status")?.remove();
  });
  if (document.prerendering) {
    document.addEventListener("prerenderingchange", countPageview, {once: true});
  } else {
    countPageview();
  }

  // These names describe deliberate visitor actions. They are shared across
  // languages and do not include page text, link targets, or visitor data.
  const reportedActions = new Set();
  function reportOnce(action) {
    if (reportedActions.has(action)) return;
    reportedActions.add(action);
    countPortfolioEvent(action);
  }

  const recordingActions = new Map([
    ["DEMO-DESK", "video-vla-desk-start"],
    ["DEMO-FRUIT", "video-vla-fruit-start"],
    ["RL-REAL", "video-irc-real-start"],
  ]);
  const trialScenes = new Set(["crossing", "headon", "diagonal"]);
  const workSections = new Map([
    ["work-deepfake-details", "detail-work-deepfake"],
    ["work-arm-details", "detail-work-arm"],
    ["work-flight-details", "detail-work-flight"],
  ]);
  function detailAction(details) {
    if (details.matches("#method [data-stage-technical]")) return "detail-vla-method";
    if (details.matches("#method .irc-math-details")) return "detail-irc-method";
    return workSections.get(details.id);
  }

  // A 'play' event alone is also fired by script. Record a recent trusted
  // gesture on the relevant player or button, then wait for actual playback.
  const playbackIntent = new WeakMap();
  const deliberatePlayers = new WeakSet();
  // A start may finish buffering while the tab is hidden. Keep it pending
  // until actual playback is observed in the foreground.
  const pendingForegroundStart = new WeakMap();
  function markIntent(target) {
    playbackIntent.set(target, performance.now());
  }
  function markNativeControl(event) {
    if (!event.isTrusted || document.hidden) return;
    if (event.type === "keydown" && ![" ", "Enter", "MediaPlayPause", "MediaPlay"].includes(event.key)) return;
    if (event.target instanceof HTMLVideoElement) markIntent(event.target);
  }
  document.addEventListener("pointerdown", markNativeControl, true);
  document.addEventListener("keydown", markNativeControl, true);

  document.addEventListener("click", event => {
    if (!event.isTrusted || document.hidden || !(event.target instanceof Element)) return;
    const button = event.target.closest("button");
    if (button?.matches(".recording .frame button")) {
      markIntent(button.closest(".recording"));
    } else if (button?.matches('[data-trial-action="start"]')) {
      const panel = button.closest("[data-trial-panel]");
      for (const video of panel.querySelectorAll("video")) markIntent(video);
    } else if (event.target instanceof HTMLVideoElement) {
      markIntent(event.target);
    }

    const details = event.target.closest("summary")?.parentElement;
    if (details instanceof HTMLDetailsElement && !details.open) {
      const action = detailAction(details);
      // The native summary action runs after click dispatch. Deep links and
      // scripted restoration of an open section never pass through this path.
      if (action) setTimeout(() => { if (details.open) reportOnce(action); }, 0);
    }

    const link = event.target.closest("a");
    if (!link) return;
    if (link.matches("#method [data-mv2-viewer]")) reportOnce("detail-vla-method");
    if (link.matches('#work-deepfake a[href="https://doi.org/10.1049/bme2/3764746"]')) reportOnce("link-id3-paper");
    if (link.protocol === "mailto:") reportOnce("link-contact-email");
  }, true);

  function videoAction(video) {
    const recording = video.closest(".recording");
    if (recording) return recordingActions.get(recording.dataset.media);
    const panel = video.closest("[data-trial-panel]");
    if (panel && !panel.hidden && trialScenes.has(panel.dataset.trialPanel)) {
      // The pair button starts two independent recordings of one scenario.
      return "video-compare-" + panel.dataset.trialPanel + "-start";
    }
  }

  document.addEventListener("play", event => {
    const video = event.target;
    if (!(video instanceof HTMLVideoElement) || !videoAction(video)) return;
    const trigger = playbackIntent.has(video) ? video : video.closest(".recording");
    const intent = playbackIntent.get(trigger);
    playbackIntent.delete(trigger);
    if (intent !== undefined && performance.now() - intent < 5000) deliberatePlayers.add(video);
  }, true);

  document.addEventListener("playing", event => {
    const video = event.target;
    if (!deliberatePlayers.has(video)) return;
    const action = videoAction(video);
    if (!action) return;
    if (document.hidden) pendingForegroundStart.set(video, action);
    else reportOnce(action);
  }, true);

  // Sample visible foreground playback, in elapsed seconds. Capping each
  // increment by media progress at the current speed excludes stalls and
  // prevents a seek or changes in playback rate from jumping the threshold.
  let deskSeconds = 0;
  let deskSample = null;
  function sampleDeskPlayback(event) {
    const video = event.target;
    if (!document.hidden && !video.paused && !video.seeking && video.currentTime > 0 &&
        pendingForegroundStart.has(video)) {
      reportOnce(pendingForegroundStart.get(video));
      pendingForegroundStart.delete(video);
    }
    if (reportedActions.has("video-vla-desk-30s") || !deliberatePlayers.has(video) ||
        !reportedActions.has("video-vla-desk-start") || !video.closest('.recording[data-media="DEMO-DESK"]')) return;
    const rect = video.getBoundingClientRect();
    const visibleWidth = Math.min(rect.right, innerWidth) - Math.max(rect.left, 0);
    const visibleHeight = Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0);
    if (video.paused || video.seeking || document.hidden || rect.width === 0 || rect.height === 0 ||
        visibleWidth < rect.width / 4 || visibleHeight < rect.height / 4) {
      deskSample = null;
      return;
    }
    const sample = {video, wall: performance.now(), media: video.currentTime, rate: video.playbackRate};
    if (deskSample?.video === video && deskSample.rate === sample.rate && sample.rate > 0) {
      const wall = (sample.wall - deskSample.wall) / 1000;
      const media = (sample.media - deskSample.media) / sample.rate;
      if (wall < 2 && media > 0) deskSeconds += Math.min(wall, media);
    }
    deskSample = sample;
    if (deskSeconds >= 30) {
      reportOnce("video-vla-desk-30s");
      deskSample = null;
    }
  }
  document.addEventListener("timeupdate", sampleDeskPlayback, true);
  function resetDeskSample(event) {
    if (deskSample?.video === event.target) deskSample = null;
  }
  for (const type of ["seeking", "seeked", "waiting", "ratechange", "emptied", "ended"]) {
    document.addEventListener(type, resetDeskSample, true);
  }
  document.addEventListener("pause", event => {
    resetDeskSample(event);
    deliberatePlayers.delete(event.target);
    pendingForegroundStart.delete(event.target);
  }, true);
  document.addEventListener("visibilitychange", () => { deskSample = null; });

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
