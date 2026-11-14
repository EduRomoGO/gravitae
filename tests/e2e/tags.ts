// Firefox and WebKit run only the tests with this tag: the ones whose outcome
// depends on the browser engine (keyboard focus, history and scroll restoration,
// animation frames, IntersectionObserver, layout overflow, range inputs).
// The rest check content, routing and accessibility, which the DOM decides
// alike in every engine, so Chromium alone runs them.
export const crossBrowser = { tag: "@cross-browser" };
