// Service Worker for ReadWell Browser Extension
console.log("ReadWell background service worker started.");

chrome.runtime.onInstalled.addListener(() => {
  console.log("ReadWell extension installed.");
});
