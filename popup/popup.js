"use strict";

const form = document.getElementById("preferences");
const status = document.getElementById("status");
const fields = ["amount", "productType", "indexer", "minRate", "maxMaturityDays", "liquidity", "excludedIssuers"];

function getPreferences() {
  return Object.fromEntries(fields.map((name) => [name, document.getElementById(name).value]));
}

function showStatus(message, state) {
  status.textContent = message;
  status.className = state || "";
}

chrome.storage.local.get("preferences", ({ preferences }) => {
  if (!preferences) return;
  fields.forEach((name) => {
    if (preferences[name] !== undefined) document.getElementById(name).value = preferences[name];
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button[type='submit']");
  const preferences = getPreferences();
  button.disabled = true;
  showStatus("Lendo os produtos exibidos…");

  try {
    await chrome.storage.local.set({ preferences });
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:/i.test(tab.url || "")) throw new Error("Abra uma página web para executar a análise.");
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["src/core.js", "src/content.js"] });
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["src/content.css"] });
    const result = await chrome.tabs.sendMessage(tab.id, { type: "BTG_ANALYZE", preferences });
    if (!result?.ok) throw new Error(result?.error || "Não foi possível analisar a página.");
    showStatus(`${result.total} produto(s) encontrado(s); ${result.eligible} atende(m) aos critérios.`, "success");
  } catch (error) {
    showStatus(error.message || "Falha inesperada.", "error");
  } finally {
    button.disabled = false;
  }
});
