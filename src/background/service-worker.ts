// Ratatoskr browser extension service worker.
// Scaffold milestone: no capture behaviour lives here yet. Later milestones add
// message handling and submission behind narrow adapters.
chrome.runtime.onInstalled.addListener(() => {
  console.log('Ratatoskr browser extension installed');
});
