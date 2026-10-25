/*
 * p-fx.js — Prosperity's live exchange rates and gold price: fetched when the app opens, every 15 minutes and when it
 * comes back to the front; kept on the device so it still converts offline. The only network requests the app makes
 * (index.html's Content-Security-Policy allows exactly these hosts).
 *   fawazahmed0 currency-api: daily rates for every currency, plus XAU (gold)
 *   gold-api.com: live gold spot, so the gram price moves during the day
 */
"use strict";

const PFX_KEY = "tally:p-fx";
const PFX_URLS = [
  "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json",
  "https://latest.currency-api.pages.dev/v1/currencies/usd.min.json",
];
const PFX_GOLD = "https://api.gold-api.com/price/XAU";
/* {rates: {TRY: 49.5, ..., XAU: ounces per USD}, date: "YYYY-MM-DD" (published), at: ms (fetched), live: bool} */
let PFX = (() => {
  try {
    const o = JSON.parse(localStorage.getItem(PFX_KEY) || "null");
    return o && o.rates ? o : { rates: null, date: null, at: 0 };
  } catch (e) {
    return { rates: null, date: null, at: 0 };
  }
})();
let pfxBusy = false;
const pRates = () => PFX.rates;

async function pFetchJson(urls) {
  for (const u of urls) {
    try {
      const r = await fetch(u, { cache: "no-store" });
      if (r.ok) return await r.json();
    } catch (e) {}
  }
  return null;
}
async function pRefreshFx() {
  if (pfxBusy) return;
  pfxBusy = true;
  try {
    const next = Object.assign({}, PFX);
    const j = await pFetchJson(PFX_URLS);
    if (j && j.usd) {
      const rates = {};
      for (const [k, v] of Object.entries(j.usd)) if (typeof v === "number" && v > 0 && /^[a-z]{3}$/.test(k)) rates[k.toUpperCase()] = v;
      rates.USD = 1;
      next.rates = rates;
      next.date = j.date || null;
      next.at = Date.now();
    }
    const g = await pFetchJson([PFX_GOLD]);
    if (next.rates && g && g.price > 0) {
      next.rates = Object.assign({}, next.rates, { XAU: 1 / g.price });
      next.goldAt = g.updatedAt || new Date().toISOString();
    }
    if (next.at !== PFX.at || next.goldAt !== PFX.goldAt) {
      PFX = next;
      try {
        localStorage.setItem(PFX_KEY, JSON.stringify(PFX));
      } catch (e) {}
      if (!$("#sheet").innerHTML) render(); // an open sheet isn't redrawn under the user's fingers
    }
  } finally {
    pfxBusy = false;
  }
}
function pStartFx() {
  pRefreshFx();
  setInterval(pRefreshFx, 15 * 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && Date.now() - (PFX.at || 0) > 15 * 60 * 1000) pRefreshFx();
  });
}
