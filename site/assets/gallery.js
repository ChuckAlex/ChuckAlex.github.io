(() => {
  "use strict";
  const STORAGE_KEY = "wenhao-gallery-paused";
  function initialize(gallery) {
    if (gallery.dataset.galleryReady === "true") return;
    gallery.dataset.galleryReady = "true";
    const video = gallery.querySelector("video");
    const source = video.querySelector("source");
    const panel = gallery.querySelector(".gallery-stage");
    const poster = gallery.querySelector(".gallery-poster");
    const choices = [...gallery.querySelectorAll(".scene-choice")];
    const tabs = gallery.querySelector(".scene-choices");
    const toggle = gallery.querySelector(".scene-toggle");
    const status = gallery.querySelector(".gallery-status");
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
    let selected = 0, serial = 0, inView = false, blocked = false, optedIn = false;
    let userPaused = false;
    let singleClip = false, playClip = false;
    const failures = new Set();
    try { userPaused = localStorage.getItem(STORAGE_KEY) === "1"; } catch (_) {}
    function persist() { try { localStorage.setItem(STORAGE_KEY, userPaused ? "1" : "0"); } catch (_) {} }
    function wantsMotion() { return singleClip ? playClip : !userPaused && (!reduceMotion.matches || optedIn); }
    function otherPlaying() { return [...document.querySelectorAll("video")].some(item => item !== video && !item.paused && !item.ended); }
    function state() {
      const canPause = wantsMotion() && !blocked && !failures.has(selected) && inView && !document.hidden && !otherPlaying();
      const label = singleClip
        ? (canPause ? toggle.dataset.pauseClip : toggle.dataset.playClip)
        : (canPause ? toggle.dataset.pause : toggle.dataset.play);
      toggle.setAttribute("aria-label", label); toggle.title = label;
      toggle.querySelector(".scene-toggle-label").textContent = label;
      toggle.querySelector(".scene-toggle-icon").textContent = canPause ? "Ⅱ" : "▶";
      toggle.setAttribute("aria-pressed", String(canPause));
      gallery.dataset.playback = !video.paused && !video.ended ? "playing" : "paused";
      gallery.dataset.userPaused = String(userPaused);
    }
    function sync() {
      if (!wantsMotion() || !inView || document.hidden || failures.has(selected) || otherPlaying()) {
        video.pause(); state(); return;
      }
      video.muted = true;
      const request = serial;
      const pending = video.play();
      if (pending) pending.then(() => { if (request === serial) { blocked = false; state(); } }).catch(error => {
        if (request === serial && error.name !== "AbortError") { blocked = true; state(); }
      });
      state();
    }
    function nextIndex() {
      for (let step = 1; step <= choices.length; step++) {
        const index = (selected + step) % choices.length;
        if (!failures.has(index)) return index;
      }
      return null;
    }
    function select(index, explicit = false) {
      serial++; video.pause(); selected = index; blocked = false;
      const choice = choices[index];
      gallery.dataset.selectedScene = choice.dataset.key;
      gallery.dataset.orientation = choice.dataset.orientation;
      gallery.querySelector("[data-gallery-index]").textContent = index + 1;
      gallery.querySelector(".gallery-title").textContent = choice.dataset.title;
      if (choice.dataset.eyebrow) gallery.querySelector(".gallery-eyebrow").textContent = choice.dataset.eyebrow;
      gallery.querySelector(".gallery-scene").textContent = choice.dataset.description;
      const related = gallery.querySelector(".gallery-project");
      if (choice.dataset.action) related.textContent = choice.dataset.action;
      related.hidden = !choice.dataset.href;
      if (choice.dataset.href) related.setAttribute("href",choice.dataset.href); else related.removeAttribute("href");
      choices.forEach((item,i) => { item.setAttribute("aria-selected",String(i === index)); item.tabIndex = i === index ? 0 : -1; item.removeAttribute("data-active"); });
      panel.setAttribute("aria-labelledby",choice.id);
      video.setAttribute("aria-label",choice.dataset.title);
      video.poster = choice.dataset.poster; poster.src = choice.dataset.poster; poster.alt = choice.dataset.description;
      const failed = failures.has(index); video.hidden = failed; poster.hidden = !failed;
      status.textContent = failed ? status.dataset.unavailable : "";
      source.setAttribute("src",choice.dataset.clip); video.load();
      if (explicit && wantsMotion()) document.querySelectorAll("video").forEach(item => { if (item !== video) item.pause(); });
      sync();
      window.dispatchEvent(new Event("portfolio:gallerychange"));
    }
    function fail() {
      if (failures.has(selected)) return;
      failures.add(selected); video.pause(); video.hidden = true; poster.hidden = false;
      status.textContent = status.dataset.unavailable;
      const next = nextIndex();
      const failedSerial = serial;
      if (!singleClip && wantsMotion() && next !== null) setTimeout(() => {
        if (serial === failedSerial && !singleClip && failures.has(selected) && wantsMotion()) select(next);
      }, 180);
      state();
    }
    video.controls = false; video.loop = false; video.muted = true;
    toggle.hidden = false; panel.setAttribute("role","tabpanel"); tabs.setAttribute("role","tablist");
    function chooseTab(index) {
      singleClip = false;
      gallery.dataset.explicitScene = choices[index].dataset.key;
      if (location.hash.startsWith("#clip-")) {
        try { history.replaceState(history.state, "", "#profile"); } catch {}
      }
      select(index,true);
    }
    for (const [index, choice] of choices.entries()) {
      choice.setAttribute("role","tab"); choice.setAttribute("aria-controls",panel.id);
      choice.addEventListener("click",event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault(); chooseTab(index);
      });
      choice.addEventListener("keydown",event => {
        let next;
        if (event.key === "ArrowRight") next = (index + 1) % choices.length;
        else if (event.key === "ArrowLeft") next = (index - 1 + choices.length) % choices.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = choices.length - 1;
        else if (event.key === " ") next = index;
        else return;
        event.preventDefault(); chooseTab(next); choices[next].focus();
      });
    }
    function showClip(index, play) {
      singleClip = true;
      playClip = play;
      gallery.dataset.explicitScene = choices[index].dataset.key;
      if (play) failures.delete(index);
      select(index, play);
    }
    for (const link of document.querySelectorAll("a[data-gallery-target]")) {
      const key = link.dataset.galleryTarget;
      const index = choices.findIndex(choice => choice.dataset.key === key);
      if (index < 0) continue;
      link.addEventListener("click", event => {
        if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        const entry = link.closest("[data-work-entry]");
        if (entry && location.hash !== "#" + entry.id) {
          try { history.replaceState(history.state, "", "#" + entry.id); } catch {}
        }
        location.hash = "clip-" + key;
        showClip(index, true);
        panel.focus({preventScroll:true});
      });
    }
    function clipFromHash() {
      return choices.findIndex(choice => location.hash === "#clip-" + choice.dataset.key);
    }
    window.addEventListener("hashchange", () => {
      const index = clipFromHash();
      if (index >= 0 && (!singleClip || selected !== index)) showClip(index, false);
      if (index < 0 && singleClip) {
        singleClip = false;
        playClip = false;
        delete gallery.dataset.explicitScene;
        sync();
      }
    });
    toggle.addEventListener("click", () => {
      const canPause = wantsMotion() && !blocked && !failures.has(selected) && inView && !document.hidden && !otherPlaying();
      if (singleClip) {
        playClip = !canPause;
        if (playClip) {
          if (failures.delete(selected)) { select(selected, true); return; }
          document.querySelectorAll("video").forEach(item => { if (item !== video) item.pause(); });
          if (video.ended) video.currentTime = 0;
        }
        sync(); return;
      }
      if (canPause) { userPaused = true; optedIn = false; }
      else {
        userPaused = false; optedIn = true; blocked = false;
        document.querySelectorAll("video").forEach(item => { if (item !== video) item.pause(); });
        if (failures.has(selected)) { failures.delete(selected); select(selected,true); }
      }
      persist(); sync();
    });
    video.addEventListener("ended", () => {
      if (singleClip) { playClip = false; state(); return; }
      if (wantsMotion()) { const next = nextIndex(); if (next !== null) select(next); }
    });
    video.addEventListener("play",state); video.addEventListener("pause",state);
    video.addEventListener("volumechange", () => { if (!video.muted) video.muted = true; });
    video.addEventListener("error",fail);
    source.addEventListener("error", () => { setTimeout(() => { if (video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) fail(); }, 0); });
    reduceMotion.addEventListener("change", () => { optedIn = false; sync(); });
    document.addEventListener("visibilitychange",sync);
    document.addEventListener("play",event => { if (event.target instanceof HTMLVideoElement && event.target !== video) sync(); },true);
    document.addEventListener("pause",event => { if (event.target instanceof HTMLVideoElement && event.target !== video) setTimeout(sync,0); },true);
    window.addEventListener("storage",event => { if(event.key === STORAGE_KEY) { userPaused = event.newValue === "1"; sync(); } });
    const initialClip = clipFromHash();
    if (initialClip >= 0) showClip(initialClip, false);
    else select(0);
    state();
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => { inView = entry.isIntersecting && entry.intersectionRatio >= .12; sync(); },{threshold:[0,.12,.5]}).observe(gallery);
    } else { inView = true; sync(); }
  }
  function start() { document.querySelectorAll("[data-gallery]").forEach(initialize); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",start,{once:true}); else start();
})();
