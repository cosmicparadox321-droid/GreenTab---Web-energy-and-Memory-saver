GreenTab — Web Energy & Memory Saver

> A lightweight Manifest V3 Chrome extension designed to reduce client-side CPU rendering load, freeze background media bloat, and defer offscreen image rendering.

##  Features
- **Background Media Freeze:** Automatically pauses offscreen autoplaying `<video>` and `<audio>` elements.
- **Safe DOM Trimming:** Purges non-interactive, hidden leftover elements using safety filters to preserve site functionality.
- **Image Deferral:** Injects `loading="lazy"` attributes onto images far below the viewport.
- **Session Tracking:** Persists total cleaned nodes and estimated CPU savings across your browser session.

##  Tech Stack
- **Architecture:** Chrome Extension Manifest V3
- **Languages:** Vanilla JavaScript (ES6+), HTML5, CSS3
- **APIs:** `chrome.tabs`, `chrome.scripting`, `chrome.storage.session`

##  Installation
1. Clone this repository or download the source code.
2. Open Chrome/Brave and navigate to `chrome://extensions`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the `greentab` project directory.
5. Open any web page, launch the GreenTab popup, and click **Optimize Page**.
