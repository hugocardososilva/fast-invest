"use strict";

const form = document.getElementById("preferences");
const status = document.getElementById("status");
const startButton = form.querySelector("button[type='submit']");
const stopButton = document.getElementById("stopBooster");
const analyzeButton = document.getElementById("analyzeOnce");
const fields = ["amount", "productType", "indexer", "minRate", "maxMaturityDays", "maxRateDrop", "scanInterval", "liquidity", "excludedIssuers"];

function getPreferences() {
  return Object.fromEntries(fields.map((name) => [name, document.getElementById(name).value]));
}

function showStatus(message, state) {
  status.textContent = message;
  status.className = state || "";
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https?:/i.test(tab.url || "")) throw new Error("Abra uma página web para executar o booster.");
  return tab;
}

async function ensureInjected(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ["src/core.js", "src/content.js"] });
  await chrome.scripting.insertCSS({ target: { tabId }, files: ["src/content.css"] });
}

async function send(type, preferences) {
  const tab = await activeTab();
  await ensureInjected(tab.id);
  return chrome.tabs.sendMessage(tab.id, { type, preferences });
}

function reflectBooster(result) {
  stopButton.disabled = !result?.active;
  startButton.textContent = result?.active ? "⚡ Reiniciar booster" : "⚡ Ativar booster";
}

chrome.storage.local.get("preferences", async ({ preferences }) => {
  if (preferences) {
    fields.forEach((name) => {
      if (preferences[name] !== undefined) document.getElementById(name).value = preferences[name];
    });
  }
  try {
    const tab = await activeTab();
    const result = await chrome.tabs.sendMessage(tab.id, { type: "BTG_BOOSTER_STATUS" });
    reflectBooster(result);
    if (result?.phase && result.phase !== "inactive") showStatus(result.message, result.active ? "success" : "");
  } catch (_) {
    reflectBooster(null);
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const preferences = getPreferences();
  startButton.disabled = true;
  showStatus("Ativando monitoramento contínuo…");
  try {
    await chrome.storage.local.set({ preferences });
    const result = await send("BTG_BOOSTER_START", preferences);
    if (!result?.ok) throw new Error(result?.error || "Não foi possível ativar o booster.");
    reflectBooster(result);
    showStatus("Booster ativo. Você pode fechar esta janela.", "success");
  } catch (error) {
    showStatus(error.message || "Falha inesperada.", "error");
  } finally {
    startButton.disabled = false;
  }
});

analyzeButton.addEventListener("click", async () => {
  const preferences = getPreferences();
  analyzeButton.disabled = true;
  showStatus("Lendo os produtos exibidos…");
  try {
    await chrome.storage.local.set({ preferences });
    const result = await send("BTG_ANALYZE", preferences);
    if (!result?.ok) throw new Error(result?.error || "Não foi possível analisar a página.");
    showStatus(`${result.total} produto(s); ${result.eligible} atende(m) aos critérios.`, "success");
  } catch (error) {
    showStatus(error.message || "Falha inesperada.", "error");
  } finally {
    analyzeButton.disabled = false;
  }
});

stopButton.addEventListener("click", async () => {
  stopButton.disabled = true;
  try {
    const result = await send("BTG_BOOSTER_STOP");
    reflectBooster(result);
    showStatus("Booster interrompido.");
  } catch (error) {
    showStatus(error.message || "Não foi possível interromper.", "error");
  }
});
