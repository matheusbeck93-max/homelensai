# HomeLens Chrome Extension

AI-powered real estate analysis directly in your browser. Works on Zillow, Redfin, Realtor.com, Compass, and hundreds of other listing sites.

## Features

- **Global Chat Popup**: Click the extension icon on any tab to open the HomeLens AI chat
- **Smart Listing Detection**: Automatically detects property listings on any real estate website via intelligent DOM analysis
- **One-Click Analysis**: A floating "Analyze with HomeLens" button appears on detected listings
- **Badge Notification**: Green badge on the extension icon when a listing is detected

## Build

```bash
cd chrome-extension
npm install
npm run build
```

## Install in Chrome (Developer Mode)

1. Open `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `chrome-extension/dist/` folder

## How It Works

- Click the extension icon on any tab to open the HomeLens AI chat
- On any American real estate listing site, a floating **"Analyze with HomeLens"** button appears automatically
- The button is detected via intelligent DOM content analysis — it works on Zillow, Redfin, Realtor.com, Compass, RE/MAX, Century 21, Coldwell Banker, and hundreds of other listing sites
- When you open the popup after a listing is detected, a banner lets you instantly analyze the property

## Supported Sites

The extension uses universal detection, not a fixed site list. It works on any site that displays:
- Property price ($XXX,XXX format)
- Beds/baths count
- Square footage
- MLS information
- US address format

This covers 99%+ of American real estate listing websites.

## Publishing to Chrome Web Store

1. Zip the `dist/` folder
2. Go to https://chrome.google.com/webstore/devconsole
3. Pay the one-time $5 fee and submit for review (3-7 business days)

## Tech Stack

- **Popup**: React 18 + Vite
- **Content Script**: Vanilla TypeScript (bundled via esbuild as IIFE)
- **Background**: Service Worker (Manifest V3)
- **Styling**: Pure CSS (no Tailwind — avoids conflicts with host pages)
