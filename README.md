# ShiftDesk Admin

A PWA (Progressive Web App) for managing a WooCommerce store directly from your phone or desktop. No dedicated server needed — runs entirely in the browser.

---

## Table of Contents

1. [What it does](#1-what-it-does)
2. [Fork and publish on GitHub Pages](#2-fork-and-publish-on-github-pages)
3. [Cloudflare account and Worker for push notifications](#3-cloudflare-account-and-worker-for-push-notifications)
4. [Configure WooCommerce webhook](#4-configure-woocommerce-webhook)
5. [Credentials file (stored on your phone)](#5-credentials-file-stored-on-your-phone)
6. [Install PWA on your phone](#6-install-pwa-on-your-phone)
7. [First-time setup](#7-first-time-setup)
8. [FAQ](#8-faq)

---

## 1. What it does

- View and manage WooCommerce **orders** in real time
- View and edit **products** (price, stock, description, images)
- **Push notifications** for new orders, even when the app is closed
- Works offline (shows last loaded data)
- Installable as a native app on iPhone, Android, or desktop

---

## 2. Fork and publish on GitHub Pages

### Step 1 — Fork the repo

1. Go to: `https://github.com/catalincheaga/shiftdesk`
2. Click the **Fork** button (top right)
3. Choose your GitHub account as the destination
4. Click **Create fork**

### Step 2 — Update the app URL in the worker file

After forking, update the app URL inside `cloudflare-worker.js`:

1. In your forked repo, open `cloudflare-worker.js`
2. Find the line:
   ```
   url: 'https://catalincheaga.github.io/shiftdesk/shiftdesk-admin.html#orders',
   ```
3. Replace with your URL (you'll know it after Step 3 below):
   ```
   url: 'https://YOUR-USERNAME.github.io/YOUR-REPO/shiftdesk-admin.html#orders',
   ```
4. Save (commit directly on GitHub or via `git push`)

### Step 3 — Enable GitHub Pages

1. In your repo, go to **Settings** (top menu)
2. In the left sidebar, find **Pages**
3. Under **Source**, select **Deploy from a branch**
4. Under **Branch**, choose **main** and folder **/ (root)**
5. Click **Save**
6. Wait 1-2 minutes. Your app URL will be:
   ```
   https://YOUR-USERNAME.github.io/YOUR-REPO/shiftdesk-admin.html
   ```

> **Note:** GitHub Pages is free for public repositories.

---

## 3. Cloudflare account and Worker for push notifications

Cloudflare Workers is **free** (100,000 requests/day on the Free plan). No credit card required.

### Step 1 — Create a Cloudflare account

1. Go to `https://cloudflare.com`
2. Click **Sign Up** (top right)
3. Fill in your email and password, then confirm your email

### Step 2 — Generate your own VAPID keys

> If you are setting this up just for yourself and not sharing the repo, you can skip this step and use the existing keys in `cloudflare-worker.js`. For a production setup, generating your own keys is recommended.

1. Go to `https://vapidkeys.com` (or any VAPID key generator)
2. Generate a pair: **Public Key** + **Private Key** (PKCS8 format for the private key)
3. Update `cloudflare-worker.js`:
   ```js
   const VAPID_PUBLIC  = 'YOUR_PUBLIC_KEY';
   const VAPID_PRIVATE = 'YOUR_PRIVATE_KEY_PKCS8';
   const VAPID_SUBJECT = 'mailto:your@email.com';
   ```
4. Update `shiftdesk-admin.html` — find and replace:
   ```js
   const VAPID_PUBLIC_KEY = 'YOUR_PUBLIC_KEY';
   ```

### Step 3 — Create a KV Namespace

Workers need a key-value store to remember subscribed devices.

1. In the Cloudflare dashboard, go to **Workers & Pages** (left sidebar)
2. Click **KV** (under "Storage & Databases" or inside "Workers & Pages")
3. Click **Create a namespace**
4. Name: `SUBSCRIPTIONS` (exactly, uppercase)
5. Click **Add**

### Step 4 — Create the Worker

1. Go to **Workers & Pages** > **Overview**
2. Click **Create application**
3. Click **Create Worker**
4. Give it a name, e.g. `shiftdesk-push`
5. Click **Deploy**
6. On the next page, click **Edit code**
7. Delete all existing code in the editor
8. Copy the contents of `cloudflare-worker.js` from your repo and paste it into the editor
9. Click **Save and deploy**

### Step 5 — Bind the KV Namespace to the Worker

1. Go to your worker > **Settings** > **Bindings**
2. Click **Add binding**
3. Type: **KV Namespace**
4. Variable name: `SUBSCRIPTIONS` (exactly, uppercase)
5. KV namespace: select the `SUBSCRIPTIONS` namespace you created earlier
6. Click **Save**

### Step 6 — Note your Worker URL

Your Worker URL looks like:
```
https://shiftdesk-push.YOUR-USERNAME.workers.dev
```

Find it on the worker's overview page or under **Workers & Pages** > Overview, in the "Route" column.

This is the **Worker URL** you will enter in the app and in your credentials file.

---

## 4. Configure WooCommerce webhook

The webhook sends a notification to your Cloudflare Worker every time a new order is placed.

1. In WordPress, go to **WooCommerce** > **Settings** > **Advanced** > **Webhooks**
2. Click **Add webhook**
3. Fill in:
   - **Name:** ShiftDesk Push
   - **Status:** Active
   - **Topic:** Order created
   - **Delivery URL:** `https://shiftdesk-push.YOUR-USERNAME.workers.dev/webhook`
   - **Secret:** (leave blank or enter anything)
   - **API version:** WP REST API Integration v3
4. Click **Save webhook**

> **Note:** If you do not see a Webhooks tab, check that WooCommerce is version 3.0 or later.

---

## 5. Credentials file (stored on your phone)

The app has no traditional login. Instead, you use a JSON file containing your WooCommerce API credentials. **Keep this file in iCloud Drive or Google Drive** so it's always accessible.

### How to get Consumer Key (CK) and Consumer Secret (CS)

1. In WordPress, go to **WooCommerce** > **Settings** > **Advanced** > **REST API**
2. Click **Add key**
3. Fill in:
   - **Description:** ShiftDesk Admin
   - **User:** select your admin user
   - **Permissions:** Read/Write
4. Click **Generate API key**
5. **IMPORTANT:** Copy the Consumer Key and Consumer Secret immediately — you cannot see them again after closing the page

### Credentials file format

Create a text file with a `.json` extension (e.g. `shiftdesk-credentials.json`) with the following content:

```json
{
  "url": "https://your-store.com",
  "ck": "ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "cs": "cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "workerUrl": "https://shiftdesk-push.YOUR-USERNAME.workers.dev"
}
```

| Field | Description |
|-------|-------------|
| `url` | Your WooCommerce store URL (no trailing `/`) |
| `ck` | Consumer Key from WooCommerce |
| `cs` | Consumer Secret from WooCommerce |
| `workerUrl` | Your Cloudflare Worker URL (no trailing `/`) |

### Where to keep it

- **iPhone:** iCloud Drive > "ShiftDesk" folder or in the Files app
- **Android:** Google Drive or any file manager
- Keep this file private — it contains credentials for your store

---

## 6. Install PWA on your phone

### iPhone (Safari)

1. Open Safari and go to `https://YOUR-USERNAME.github.io/YOUR-REPO/shiftdesk-admin.html`
2. Import your credentials file (tap "Alege fisier JSON")
3. Tap the **Share** button (square with an arrow) in the Safari toolbar
4. Scroll down and tap **Add to Home Screen**
5. Give it a name (e.g. "ShiftDesk") and tap **Add**
6. The app icon appears on your home screen like a native app

### Android (Chrome)

1. Open Chrome and navigate to the app URL
2. Import your credentials file
3. Chrome will show a banner "Add to Home screen", or
4. Tap the 3-dot menu (top right) > **Add to Home screen**
5. Confirm

> **Tip:** Always open the app from the **home screen icon**, not from the browser. This is what makes it behave like a native app (no browser bar).

---

## 7. First-time setup

On first launch:

1. Tap **Alege fisier JSON** and select your credentials file from iCloud/Google Drive
2. The app will automatically connect to your store
3. To enable push notifications:
   - Go to **Setari** (gear icon, bottom or left sidebar)
   - Make sure **Worker URL** is filled in
   - Tap **Aboneaza acest dispozitiv**
   - Allow notifications when the browser prompts
4. Done — you will receive push notifications for new orders even when the app is closed

---

## 8. FAQ

**The app shows 404 errors on startup**
> Press the **Refresh** button (top right). It will count down from 3, re-apply settings, and reload data. The app now does this automatically on every startup.

**I'm not receiving push notifications**
> Check: 1) The Cloudflare Worker is running (open `https://your-worker.workers.dev/` in a browser — it should show `{"status":"ok"}`). 2) The WooCommerce webhook is active. 3) You have pressed "Aboneaza acest dispozitiv" in Settings. 4) Notifications are allowed in your phone's system settings.

**Credentials disappear after closing the app**
> Make sure you open the app from the home screen icon (not from the browser). If the issue persists, re-import the JSON file from Settings (button "Reimporta credentiale").

**I can't find the Webhooks section in WooCommerce**
> Go to WooCommerce > Settings > Advanced > REST API. If "Webhooks" does not appear as a separate tab, look under WooCommerce > Status > Webhooks.

**Can I use the app on multiple devices?**
> Yes. Each device needs to import the credentials file and subscribe to notifications from Settings. The Cloudflare Worker sends push notifications to all subscribed devices simultaneously.
