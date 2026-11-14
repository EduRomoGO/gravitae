// While a reload restores the reader's progress, the lesson stays hidden. The
// server renders the lesson's initial state, since it cannot read the
// progress kept in localStorage; painted as is, the page would show that
// state until React hydrates and reads the saved one. An inline script, run
// while the browser parses the HTML, hides <main> when there is saved
// progress; the lesson reveals it once it has restored the progress and gone
// back to the reader's section. If the scripts of the page never run, the
// veil lifts by itself after a while.

const VEIL_ID = "progress-restoring-veil";
/** How long the veil waits for the lesson before lifting by itself. */
const VEIL_MAX_MS = 3000;

/** The inline script that hides <main> when `storageKey` holds progress. */
export function restoringVeilScript(storageKey: string): string {
  return `(function(){try{if(!localStorage.getItem(${JSON.stringify(storageKey)}))return;var s=document.createElement("style");s.id=${JSON.stringify(VEIL_ID)};s.textContent="main{visibility:hidden}";document.head.appendChild(s);setTimeout(function(){s.remove()},${String(VEIL_MAX_MS)})}catch(e){}})()`;
}

/** Shows the lesson the veil hid; without a veil, it does nothing. */
export function liftRestoringVeil(): void {
  document.getElementById(VEIL_ID)?.remove();
}
