# Presentation guide (about 20 minutes)

This guide goes with the slide deck. The deck's **speaker notes** hold a short script for every slide. This page covers everything around it: what to set up, the timing, the demo click by click, the questions you're likely to get (with answers), and the key terms in plain English.

---

## 1. Before the day

- **Practise twice with a timer.** Aim for about 17 minutes of slides plus a 3-minute demo. If you run long, see "If you're short on time" below.
- **Set up the computer you'll present on.** Install Node.js 22, then in the project folder run `npm install` and `npm run build` once.
- **Download the slides as a backup** (PDF or PowerPoint, from the deck's download menu), in case there's no internet in the room.
- **Check your unit's rules** on declaring the tools you used to build the project, and follow them.

## 2. Ten minutes before you start

1. Open a command window in the project folder (in File Explorer, click the address bar, type `cmd` and press Enter).
2. For fresh demo data, run `npm run seed` first. This wipes old test orders.
3. Run `npm start`. Wait for the line **Shop available at http://localhost:3001**.
4. Open **http://localhost:3001** in the browser. Zoom to about 125% (Ctrl and +) so the back row can read it.
5. Make sure you're signed out and the cart is empty.
6. Open the slides in another window and start Present mode.

## 3. Timing plan

| Part | Slides | Time | Running total |
|---|---|---|---|
| Introduction, starting point, how I built it | 1–4 | 3 min | 3 min |
| Architecture and database | 5–6 | 2.5 min | 5.5 min |
| Security, two-step sign-in, checkout, payment | 7–10 | 5 min | 10.5 min |
| Beating the real site, features, analytics | 11–13 | 3 min | 13.5 min |
| Themes, UX audit, photos, testing | 14–17 | 3 min | 16.5 min |
| Live demo | 18 | 3 min | 19.5 min |
| Limitations and summary | 19–20 | 1 min | 20.5 min |

**If you're short on time:** skip slide 12 (the feature screenshots, because the demo shows the same screens) and say slide 16 (photos) in one sentence. That saves about a minute.

---

## 4. The demo, click by click

Say what the customer sees *and* what the server is checking. Keep moving: if one step fails, skip it.

| # | Do this | Say this |
|---|---|---|
| 1 | Home page → click **Hamptons Slip-Cover Sofa** → type **3171** in the postcode box | "As soon as I type a postcode, I see the delivery fee and real dates, before checkout." |
| 2 | **Add to cart** → **Cart** → **Proceed to checkout** → press **Pay** with the form empty | "The error summary lists every problem. I can't pay without ticking the privacy consent, and the server checks that too." |
| 3 | Fill in name, email, address. Card **4242 4242 4242 4242**, expiry **12/29**, CVC **123**. Point at the add-on. Tick **consent** → **Pay** | "The protection add-on is never pre-ticked. … The order is confirmed, with the delivery dates." |
| 4 | **Track this order** → **Report a problem or start a return** → choose **Arrived damaged**, type a note → **Submit request** | "The customer can follow the order, and the answer follows the Australian Consumer Law." |
| 5 | **Account** → email **admin@templewebster.demo**, password **Admin#2026** → **Sign in** → type the 6-digit demo code → **Verify** | "The password is right, but I still need the second step." |
| 6 | **Analytics** → on the new order, click **Mark "Dispatched"** | "The funnel and revenue come straight from the database. The customer's timeline updates and they're notified." |

**Optional extras if you have time:** the declined card **4000 0000 0000 0002** shows a payment error; the remote postcode **0870** shows that express delivery isn't available there; the **Evening** button in the header switches to the original dark-and-gold design.

**If something goes wrong:**
- *The page doesn't load:* check the command window still says "Shop available". If it only says "API listening", stop it (Ctrl+C), run `npm run build`, then `npm start` again.
- *"Port already in use":* another copy is still running. Close the other command window and run `npm start` again.
- *The code was "expired" or "too many attempts":* press Cancel and sign in again. Codes last 5 minutes and allow 5 tries.
- *Anything else:* go back to the slides and say "here's the same screen". Slides 8, 9, 12 and 13 have screenshots.

---

## 5. Questions you may be asked

**Why React instead of plain HTML and JavaScript?**
The design has many repeated parts (product cards, consent boxes, security badges). React lets me write each once and reuse it. It also escapes all text it shows by default, which helps prevent XSS. The original used `innerHTML`, which is how XSS usually happens.

**Why SQLite instead of MySQL or PostgreSQL?**
It's a real SQL database (transactions, foreign keys, constraints) but stored in one file, so anyone can run the project with just `npm install`. For a live shop I'd move to PostgreSQL, and the SQL would hardly change.

**How do you stop someone changing a price in the browser?**
The browser only sends product IDs and quantities. The server looks up every price in the database and calculates the total itself. I tested it by sending a fake `"price": 1`, and it was ignored.

**What if someone removes the consent checkbox with developer tools?**
The server checks consent again, before anything else. If `privacyConsent` isn't exactly `true`, the order is refused with an error. The time of consent is stored on the order.

**Why bcrypt for passwords, but SHA-256 for the MFA codes?**
bcrypt is slow on purpose and salted, which makes cracking stolen passwords very slow. SHA-256 is fast, which would be bad for passwords. It's fine for MFA codes because each code expires in 5 minutes, allows only 5 tries and works once.

**Isn't showing the MFA code on screen insecure?**
Yes, in a real shop. The prototype has no email or SMS service, so it shows a "demo code". The setting `SHOW_MFA_CODE=false` turns it off. Production would email or text the code, or use an authenticator app. It's listed in the limitations.

**Where are card numbers stored?**
Nowhere. The card goes to the (mock) payment provider, which returns a one-time token. The order stores only the token, the payment method and the last 4 digits. This is how real shops meet PCI DSS.

**What is XSS and how is it prevented here?**
Cross-site scripting is when an attacker gets their own script to run on your page. Three defences here: React escapes text, the Content-Security-Policy only allows our own scripts, and the session cookie is httpOnly so scripts can't read it anyway.

**What is CSRF and how is it prevented?**
Cross-site request forgery is when another website makes your browser send a request to our shop using your cookie. The session cookie is `SameSite=Strict`, so the browser never sends it with requests started by other sites.

**What is SQL injection and how is it prevented?**
It's when typed input changes an SQL query. Every query here is a prepared statement with `?` placeholders, so input is always treated as data, never as SQL.

**What happens if two people buy the last item at the same time?**
The stock update only works if there's enough stock left (`... WHERE stock >= ?`), inside the order's transaction. Only one of the two updates can succeed. The other order is rolled back, and that customer is told the item sold out while they were checking out.

**How are delivery dates calculated?**
The postcode is mapped to a zone: metro, regional (+2 days) or remote (+5 days and a $49 surcharge, no express). Each product has a minimum and maximum number of business days. The server adds them up and skips weekends, then turns that into real dates.

**What's the difference between authentication and authorisation?**
Authentication is *who you are* (password plus the code). Authorisation is *what you're allowed to do* (only the admin role can open the analytics). Both are checked on the server.

**Which laws and standards does it consider?**
- The Privacy Act 1988 and the Australian Privacy Principles: consent is recorded; customers can download their data (APP 12) and delete their account (APP 11.2).
- The Australian Consumer Law: remedies for damaged goods, and refunds to the original payment method.
- The ACCC's guidance against "dark patterns": no pre-ticked add-ons.
- PCI DSS for card data, and WCAG 2.2 AA for accessibility.

**How do you know it's accessible?**
The automated browser test runs axe, the industry-standard checker, on 22 page views in both themes, with zero WCAG violations. I also checked keyboard focus, a skip link, reduced motion and phone widths.

**How did you test it?**
- `npm test` runs 15 API tests that try to break the rules.
- `npm run test:e2e` runs 85 browser checks plus the accessibility audit.
- `npm audit` finds 0 known vulnerabilities.

I repeated build → test → fix until everything passed.

**How does it compare with the real Temple & Webster site?**
It fixes the most common customer complaints: unclear delivery costs, late postcode errors, split deliveries, misleading stock, chasing couriers, and confusing returns. The real site is still far ahead on range (200,000+ products), visual search, AR and payment options.

**Where do the photos come from?**
Ten free photos from Pexels. Each was chosen to match a product description, and every photographer is credited in `docs/IMAGE-CREDITS.md`. The Pexels licence allows free use, including commercial use.

**What would you do next?**
The items on the limitations slide: real email or SMS codes, a real payment provider's hosted fields, HTTPS, PostgreSQL, Redis for shared rate limits, and email verification at sign-up.

---

## 6. Key terms in plain English

| Term | Meaning |
|---|---|
| API / REST API | The server's set of web addresses (like `/api/orders`) that the front-end calls to get or send data |
| JSON | The text format the browser and server use to exchange data |
| Hash | A one-way fingerprint of some data. You can check a password against it, but you can't turn it back into the password |
| Salt | Random data added before hashing, so two people with the same password get different hashes |
| bcrypt | A deliberately slow password-hashing method, built for storing passwords |
| MFA / 2FA | Signing in with two things: something you know (password) and something you have (a code) |
| JWT | JSON Web Token: a signed "pass" the server gives you after sign-in. If anyone edits it, the signature breaks |
| httpOnly cookie | A cookie that page scripts can't read, so injected scripts can't steal the session |
| SameSite=Strict | The browser only sends the cookie on requests from our own site |
| CSP | Content-Security-Policy: a header telling the browser which scripts are allowed to run |
| XSS | Cross-site scripting: an attacker's script running on your page |
| CSRF | Cross-site request forgery: another site making your browser act on our site |
| SQL injection | Typed input that changes a database query. Prepared statements stop it |
| Rate limiting | Allowing only a certain number of attempts in a time window, to stop guessing |
| PCI DSS | The card industry's security standard. The easiest way to meet it is never to handle card numbers yourself |
| Tokenisation | Swapping card details for a one-time code (token) issued by the payment provider |
| Luhn algorithm | The check-digit formula every card number follows. It catches typos |
| Transaction | A group of database changes that all succeed or all fail together |
| WCAG 2.2 AA | The international accessibility guidelines; AA is the level most laws refer to |
| axe | An automated tool that checks web pages against WCAG |
| WebP | A modern image format, much smaller than JPEG at the same quality |
| srcset / lazy loading | The browser picks the right image size, and only loads images when you scroll near them |

---

## 7. Where things are in the code

If someone asks "show me where that happens", open these files:

| Feature | File |
|---|---|
| Database tables and rules | `server/src/schema.sql` |
| Password hashing, sign-in, MFA | `server/src/routes/auth.js` |
| Session cookie and role checks | `server/src/middleware/auth.js` |
| Checkout: consent, server pricing, add-on, stock, transaction | `server/src/routes/orders.js` |
| Mock payment provider (Luhn, tokens) | `server/src/routes/mockGateway.js` |
| Delivery zones and dates | `server/src/delivery.js` |
| Security headers and CSP | `server/src/app.js` |
| Analytics queries | `server/src/routes/admin.js` |
| Checkout page | `client/src/pages/Checkout.jsx` |
| API tests | `server/test/api.test.js` |
| Browser test and accessibility audit | `e2e/browser.test.mjs` |
| Every decision, explained | `docs/DECISIONS.md` |
