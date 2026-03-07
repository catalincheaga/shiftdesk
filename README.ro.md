# ShiftDesk Admin — Documentatie (Romana)

Aplicatie PWA (Progressive Web App) pentru administrarea unui magazin WooCommerce direct de pe telefon sau desktop. Fara server propriu — ruleaza complet din browser.

---

## Cuprins

1. [Ce face aplicatia](#1-ce-face-aplicatia)
2. [Fork si publicare pe GitHub Pages](#2-fork-si-publicare-pe-github-pages)
3. [Cont Cloudflare si Worker pentru notificari push](#3-cont-cloudflare-si-worker-pentru-notificari-push)
4. [Configurare webhook in WooCommerce](#4-configurare-webhook-in-woocommerce)
5. [Fisierul de credentiale (tinut pe telefon)](#5-fisierul-de-credentiale-tinut-pe-telefon)
6. [Instalare PWA pe telefon](#6-instalare-pwa-pe-telefon)
7. [Prima configurare](#7-prima-configurare)
8. [Intrebari frecvente](#8-intrebari-frecvente)

---

## 1. Ce face aplicatia

- Vizualizare si gestionare **comenzi** WooCommerce in timp real
- Vizualizare si editare **produse** (pret, stoc, descriere, imagini)
- **Notificari push** pentru comenzi noi, chiar si cand aplicatia e inchisa
- Functioneaza offline (date din ultima sesiune)
- Installabila ca aplicatie nativa pe iPhone, Android sau desktop

---

## 2. Fork si publicare pe GitHub Pages

### Pas 1 — Fork repo

1. Mergi la: `https://github.com/catalincheaga/shiftdesk`
2. Click pe butonul **Fork** (dreapta sus)
3. Alege contul tau GitHub ca destinatie
4. Click **Create fork**

### Pas 2 — Modifica URL-ul aplicatiei in worker

Dupa fork, ai nevoie sa actualizezi URL-ul aplicatiei tale in `cloudflare-worker.js`:

1. In repo-ul tau forkat, deschide fisierul `cloudflare-worker.js`
2. Cauta linia:
   ```
   url: 'https://catalincheaga.github.io/shiftdesk/shiftdesk-admin.html#orders',
   ```
3. Inlocuieste cu URL-ul tau (il vei sti dupa Pasul 3):
   ```
   url: 'https://USERNAME-TU.github.io/REPO-TU/shiftdesk-admin.html#orders',
   ```
4. Salveaza (commit direct pe GitHub sau `git push` local)

### Pas 3 — Activeaza GitHub Pages

1. In repo-ul tau, mergi la **Settings** (meniul de sus)
2. In meniul din stanga, cauta sectiunea **Pages**
3. La **Source**, selecteaza **Deploy from a branch**
4. La **Branch**, alege **main** si folderul **/ (root)**
5. Click **Save**
6. Asteapta 1-2 minute, apoi URL-ul aplicatiei tale va fi:
   ```
   https://USERNAME-TU.github.io/REPO-TU/shiftdesk-admin.html
   ```

> **Nota:** GitHub Pages este gratuit pentru repo-uri publice.

---

## 3. Cont Cloudflare si Worker pentru notificari push

Cloudflare Workers este **gratuit** (100.000 cereri/zi pe planul Free). Nu trebuie card bancar.

### Pas 1 — Creeaza cont Cloudflare

1. Mergi la `https://cloudflare.com`
2. Click **Sign Up** (dreapta sus)
3. Completeaza email + parola, confirma email-ul

### Pas 2 — Genereaza chei VAPID proprii

> Daca instalezi pentru tine si nu imparti repo-ul cu altii, poti sari peste acest pas si folosi cheile existente din `cloudflare-worker.js`. Daca vrei chei proprii (recomandat):

1. Mergi la: `https://vapidkeys.com` (sau orice generator VAPID online)
2. Genereaza o pereche de chei **Public Key** + **Private Key** (format PKCS8 pentru privata)
3. Actualizeaza in `cloudflare-worker.js` liniile:
   ```js
   const VAPID_PUBLIC  = 'CHEIA_TA_PUBLICA';
   const VAPID_PRIVATE = 'CHEIA_TA_PRIVATA_PKCS8';
   const VAPID_SUBJECT = 'mailto:emailul-tau@domeniu.ro';
   ```
4. Si in `shiftdesk-admin.html` cauta si inlocuieste:
   ```js
   const VAPID_PUBLIC_KEY = 'CHEIA_TA_PUBLICA';
   ```

### Pas 3 — Creeaza KV Namespace

Workers au nevoie de un spatiu de stocare (KV) pentru a tine minte dispozitivele abonatilor.

1. In dashboard Cloudflare, mergi la **Workers & Pages** (meniu stanga)
2. Click pe **KV** (sub "Storage & Databases" sau direct in "Workers & Pages")
3. Click **Create a namespace**
4. Nume: `SUBSCRIPTIONS` (exact asa, cu majuscule)
5. Click **Add**

### Pas 4 — Creeaza Worker-ul

1. Mergi la **Workers & Pages** > **Overview**
2. Click **Create application**
3. Click **Create Worker**
4. Da un nume workerului, ex: `shiftdesk-push`
5. Click **Deploy**
6. Pe pagina urmatoare, click **Edit code**
7. Sterge tot codul existent din editor
8. Copiaza continutul fisierului `cloudflare-worker.js` din repo-ul tau si lipeste-l in editor
9. Click **Save and deploy**

### Pas 5 — Leaga KV Namespace la Worker

1. Mergi la workerul tau > **Settings** > **Bindings**
2. Click **Add binding**
3. Tip: **KV Namespace**
4. Variable name: `SUBSCRIPTIONS` (exact asa)
5. KV namespace: selecteaza `SUBSCRIPTIONS` creat mai devreme
6. Click **Save**

### Pas 6 — Noteaza URL-ul workerului

URL-ul workerului tau arata asa:
```
https://shiftdesk-push.USERNAME-TU.workers.dev
```

Il gasesti in pagina workerului sau in **Workers & Pages** > Overview, coloana "Route".

Acesta este **Worker URL** pe care il vei pune in aplicatie si in fisierul de credentiale.

---

## 4. Configurare webhook in WooCommerce

Webhookul trimite o notificare la Cloudflare Worker de fiecare data cand apare o comanda noua.

1. In WordPress, mergi la **WooCommerce** > **Settings** > **Advanced** > **Webhooks**
2. Click **Add webhook**
3. Completeaza:
   - **Name:** ShiftDesk Push
   - **Status:** Active
   - **Topic:** Order created
   - **Delivery URL:** `https://shiftdesk-push.USERNAME-TU.workers.dev/webhook`
   - **Secret:** (lasa gol sau pune orice)
   - **API version:** WP REST API Integration v3
4. Click **Save webhook**

> **Nota:** Daca nu gasesti sectiunea Webhooks, verifica ca WooCommerce este la versiunea 3.0+.

---

## 5. Fisierul de credentiale (tinut pe telefon)

Aplicatia nu are parole sau login clasic. In schimb, folosesti un fisier JSON cu credentialele tale WooCommerce. **Pastreaza acest fisier in iCloud Drive sau Google Drive** ca sa il ai mereu la indemana.

### Cum obtii Consumer Key (CK) si Consumer Secret (CS)

1. In WordPress, mergi la **WooCommerce** > **Settings** > **Advanced** > **REST API**
2. Click **Add key**
3. Completeaza:
   - **Description:** ShiftDesk Admin
   - **User:** selecteaza userul tau admin
   - **Permissions:** Read/Write
4. Click **Generate API key**
5. **IMPORTANT:** Copiaza imediat Consumer Key si Consumer Secret — nu le mai poti vedea dupa ce inchizi pagina

### Formatul fisierului JSON

Creeaza un fisier text cu extensia `.json` (ex: `shiftdesk-credentials.json`) cu urmatorul continut:

```json
{
  "url": "https://magazinul-tau.ro",
  "ck": "ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "cs": "cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "workerUrl": "https://shiftdesk-push.USERNAME-TU.workers.dev"
}
```

| Camp | Descriere |
|------|-----------|
| `url` | URL-ul magazinului tau WooCommerce (fara `/` la final) |
| `ck` | Consumer Key generat in WooCommerce |
| `cs` | Consumer Secret generat in WooCommerce |
| `workerUrl` | URL-ul Cloudflare Worker (fara `/` la final) |

### Unde il tii

- **iPhone:** iCloud Drive > folder "ShiftDesk" sau in aplicatia Files
- **Android:** Google Drive sau orice app de fisiere
- Tine fisierul privat — contine credentiale de acces la magazin

---

## 6. Instalare PWA pe telefon

### iPhone (Safari)

1. Deschide Safari si mergi la `https://USERNAME-TU.github.io/REPO-TU/shiftdesk-admin.html`
2. Importa fisierul de credentiale (buton "Alege fisier JSON")
3. Apasa butonul **Share** (patrat cu sageata in sus) din bara Safari
4. Deruleaza in jos si apasa **Add to Home Screen**
5. Da un nume (ex: "ShiftDesk") si apasa **Add**
6. Aplicatia apare pe ecranul principal ca o aplicatie normala

### Android (Chrome)

1. Deschide Chrome si mergi la URL-ul aplicatiei
2. Importa fisierul de credentiale
3. Chrome arata automat un banner "Add to Home Screen" sau
4. Apasa meniul cu 3 puncte (dreapta sus) > **Add to Home screen**
5. Confirma

> **Sfat:** Dupa instalare, deschide aplicatia **din iconita de pe ecranul principal**, nu din browser. Asa va functiona ca aplicatie nativa (fara bara browser).

---

## 7. Prima configurare

La prima deschidere a aplicatiei:

1. Apasa **Alege fisier JSON** si selecteaza fisierul de credentiale din iCloud/Google Drive
2. Aplicatia se va conecta automat la magazinul tau
3. Daca vrei notificari push:
   - Mergi la **Setari** (iconita rotita, jos sau stanga)
   - Verifica ca **Worker URL** este completat
   - Apasa **Aboneaza acest dispozitiv**
   - Permite notificarile cand browser-ul intreaba
4. Gata — vei primi notificari la comenzi noi chiar si cand aplicatia e inchisa

---

## 8. Intrebari frecvente

**Aplicatia da eroare 404 la pornire**
> Apasa butonul **Refresh** din dreapta sus. Va numara de la 3 la 0, reaplica setarile si incarca datele. Aplicatia face asta automat la fiecare pornire.

**Nu primesc notificari push**
> Verifica: 1) Workerul Cloudflare functioneaza (deschide `https://workerul-tau.workers.dev/` in browser — trebuie sa vada `{"status":"ok"}`). 2) Webhookul WooCommerce este activ. 3) Ai apasat "Aboneaza acest dispozitiv" in Setari. 4) Ai permis notificarile in setarile telefonului.

**Credentialele dispar dupa inchiderea aplicatiei**
> Asigura-te ca deschizi aplicatia din iconita de pe ecranul principal (nu din browser). Daca problema persista, reimporta fisierul JSON din Setari (butonul "Reimporta credentiale").

**Nu gasesc sectiunea Webhooks in WooCommerce**
> Mergi la WooCommerce > Settings > Advanced > REST API. Daca nu apare "Webhooks" ca tab separat, cauta in meniu WooCommerce > Status > Webhooks.

**Pot folosi aplicatia pe mai multe telefoane?**
> Da. Fiecare telefon trebuie sa importe fisierul de credentiale si sa se aboneze la notificari din Setari. Cloudflare Worker trimite notificari la toate dispozitivele abonatilor.
