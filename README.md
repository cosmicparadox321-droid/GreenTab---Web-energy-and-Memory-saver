GreenTab — Web Energy & Memory Saver

> A lightweight Manifest V3 Chrome extension designed to reduce client-side CPU rendering load, freeze background media bloat, and defer offscreen image rendering.

##  Features

- **Freezes Hidden Videos:** Automatically pauses offscreen background video and audio loops, stopping them from draining your battery and processor.
- **Cleans Invisible Bloat:** Safely deletes hidden, non-working elements left behind by heavy web pages without breaking buttons, forms, or menus.
- **Lazy Image Loading:** Delays loading images far down the page until you scroll to them, saving both internet data and memory.
- **Tracks Energy Savings:** Counts every cleaned element and calculates your estimated CPU savings live inside the popup.

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
