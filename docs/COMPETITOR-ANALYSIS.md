# Competitor analysis: templeandwebster.com.au vs this prototype

This document compares the real Temple & Webster website with this prototype. It explains which problems on the real site the prototype was designed to fix, and where the real site is still ahead.

> **Method and honesty note.** The live website (and review sites such as Trustpilot and ProductReview) could not be opened from the build environment, because its network policy blocked them. The findings below therefore come from published sources: customer-review summaries, news coverage and Temple & Webster's own reports. Each is linked in [Sources](#sources). Where a claim couldn't be checked, it says so. Before presenting, open the live site yourself and tick off the [verification checklist](#verification-checklist-do-this-yourself-in-a-browser).

---

## 1. What the real site does well

| Strength | Evidence |
|---|---|
| Huge range: 200,000+ products via a drop-ship supplier network | [Inside Retail][visual], company reports |
| Strong reputation: Trustpilot TrustScore about **4.5 / 5** from about **13,500** reviews. Reviewers praise range, value and easy ordering. | [Trustpilot][tp] (via search summary) |
| Advanced discovery: **visual search** (photo → similar products) and **"see in your room" AR** | [Inside Retail][visual] |
| Heavy AI investment: about 80% of pre/post-sales support handled fully or partly by AI; AI personalisation and product recommendations | [Inside Retail Asia][ai], [AMI][ami] |
| Many payment options: Visa/Mastercard/Amex, PayPal, Afterpay, Zip, humm, Apple Pay, Google Pay | [House of Isabella review][hoi] (third-party blog) |
| Dispatch estimate shown on product pages | [House of Isabella review][hoi] |
| Wishlists / favourites | [Inside Retail][visual] |

## 2. Recurring customer complaints (the opportunities)

From review and complaint aggregators ([Trustpilot][tp], [ProductReview][pr], [Ajust][ajust]):

1. **Delivery costs unclear until checkout.** "Shipping information is not made clear at checkout." Customers reported unexpected delivery charges.
2. **Postcode rejected late in checkout.** One customer was stopped at checkout by an "unacceptable postcode".
3. **Items from one order arriving on different days.**
4. **Misleading stock status.** Items marked "In Stock" were later delayed because of supplier issues.
5. **Unclear tracking, no proactive updates.** Customers had to chase both T&W and the courier.
6. **Support hard to reach.** Chat and email heavy, and the phone number isn't prominent.
7. **Damaged or missing-part deliveries**, with confusing return processes.
8. **Change-of-mind returns go to store credit**, and the customer pays return shipping ([Ajust returns][ajust-ret], [Receiptor][receiptor]).

## 3. How this prototype responds

| # | Complaint on the real site | What this prototype does instead | Where in the code |
|---|---|---|---|
| 1 | Delivery cost unclear until checkout | **Postcode delivery estimator** on the product page and cart shows the fee and **real calendar dates** ("Arrives Wed 7 Oct – Mon 12 Oct") before checkout. The checkout button shows the exact total ("Pay $2,839"). | `server/src/delivery.js`, `components/DeliveryEstimate.jsx` |
| 2 | Postcode rejected late | The postcode is **validated the moment it's typed** on the product page. Remote areas are told upfront about the surcharge and that express isn't available. | `delivery.js → lookupPostcode` |
| 3 | Items arrive on different days | The cart warns when items ship from different warehouses. Checkout offers a **free "deliver everything together"** option (opt-in). | `Checkout.jsx`, `orders.deliver_together` |
| 4 | Misleading "In stock" | **Real stock counts** in the database: "In stock", "Only 3 left" or "Out of stock" (button disabled). The server **refuses to sell stock it doesn't have**, using a race-safe update, so two customers can't both buy the last one. | `schema.sql (stock)`, `routes/orders.js` |
| 5 | Unclear tracking, no updates | **Order timeline** (Confirmed → Dispatched → In transit → Out for delivery → Delivered) with the promised delivery window. Every status change is logged and the customer is **notified automatically** (mock email/SMS). Guests can track with order number + email. | `order_status_history`, `pages/Track.jsx`, `routes/admin.js` |
| 6 | Support hard to reach | Phone number in the **announcement bar on every page**, on the confirmation page and on the tracking page ("Talk to a real person"). | `Header.jsx` |
| 7 | Damaged / missing parts | **Self-service "Report a problem"** from the tracking page. The reply explains the customer's remedy under the Australian Consumer Law (free pickup, replacement or refund, parts in 2 days). Admins see a returns queue. | `return_requests`, `routes/orders.js` |
| 8 | Store credit for change of mind | Change-of-mind refunds go to the **original payment method**, not store credit. *(This is a policy choice for the prototype. It shows a customer-friendly alternative.)* | `routes/orders.js → RESOLUTIONS` |

### Beyond the complaints: privacy, security and accessibility

| Area | This prototype | Real site |
|---|---|---|
| **2-step sign-in (MFA)** on every account | ✅ Required for everyone, including admins | *Not verified.* Check whether the live site offers it. |
| **Password rules** | Blocks known-leaked passwords (NIST SP 800-63B), bcrypt hashing, rate-limited login | *Not verified* |
| **Privacy centre**: download my data (APP 12), delete my account (APP 11.2) | ✅ Self-service, in the account page | *Not verified.* Most retailers require an email request. |
| **Privacy consent** at checkout | ✅ Explicit, never pre-ticked, enforced by the server, timestamped | *Not verified* |
| **Optional add-ons never pre-ticked** | ✅ Enforced by the server (only `true` counts) | T&W sells "Purchase Protection"; check how it's presented at checkout |
| **Accessibility** | ✅ **0 violations** in an automated axe WCAG 2.2 AA audit (15 Daylight + 7 Evening pages); skip link; visible keyboard focus; underlined text links; reduced-motion support; no sideways scrolling on phones | *Not verified.* Run the same audit (checklist below). |
| **Content-Security-Policy** | ✅ Strict (`script-src 'self'`). The test tool's own injected script was blocked by it. | *Not verified.* Check the response headers. |
| **Automated tests** | ✅ 15 API tests (`npm test`) + 85-check browser test | n/a |

## 4. Where the real site is still better (be upfront about this)

A prototype can't match a listed company's platform, and saying so shows judgement:

| Real site advantage | Why the prototype doesn't have it | How it could be added |
|---|---|---|
| 200,000+ products, real photography | Prototype scope: 9 seeded products with emoji art (as in the original design) | Product import from supplier feeds; a CDN for images |
| Visual search, AR "see in your room" | Needs ML models and 3D assets | Third-party APIs (e.g. a visual-search service, WebXR / Apple Quick Look) |
| AI personalisation and AI support | Needs traffic data and models | Recommendation engine trained on the `events` table |
| Apple Pay, Google Pay, Amex, humm | Payments are mocked | A real gateway (e.g. Stripe) supports these through one integration |
| A real courier network, real emails and SMS | Prototype only logs "mock email" messages | Courier APIs (e.g. Australia Post / Allied Express), an email service |
| Public holidays in delivery dates | Business days skip weekends only | Add a holiday table per state |

## 5. One-slide summary

> **The real Temple & Webster wins on range and technology. Its customers' biggest frustrations are uncertainty: about cost, dates, stock and where their order is. This prototype removes that uncertainty. It shows exact costs and dates before checkout, keeps honest stock levels, offers combined delivery and a live order timeline, and gives self-service returns under the ACL. It also adds privacy and security features (mandatory MFA, a privacy centre, server-enforced consent, a strict CSP), passes an accessibility audit with zero violations, and is backed by automated tests.**

---

## Verification checklist (do this yourself in a browser)

Open https://www.templeandwebster.com.au and note:

1. **Security headers.** In Chrome, open DevTools → Network, click the first request, then look at Response Headers. Is there a `Content-Security-Policy`? `Strict-Transport-Security`?
2. **MFA.** Create an account. Is two-step sign-in offered or required?
3. **Delivery.** On a product page, can you see the delivery *cost* for your postcode before adding to cart? Are dates shown, or only a range of days?
4. **Checkout.** Is anything pre-ticked (e.g. Purchase Protection, marketing emails)? Is privacy consent explicit?
5. **Accessibility.** In Chrome DevTools → Lighthouse, run an Accessibility report on the home page, and do the same for this prototype. Compare the scores.
6. **Privacy.** Is there a self-service way to download or delete your data?

Record what you find. Any "no" answers are further evidence for your report.

## Sources

- [Trustpilot: Temple & Webster reviews][tp]
- [ProductReview.com.au: Temple & Webster][pr]
- [Ajust: Temple & Webster complaints][ajust] · [Ajust: returns policy explained][ajust-ret]
- [Receiptor: Temple and Webster return policy guide][receiptor]
- [Inside Retail: Temple & Webster launches visual search tool][visual]
- [Inside Retail Asia: How AI is driving Temple & Webster's growth (Aug 2025)][ai]
- [AMI: Temple flags marketing and AI investments as key to growth][ami]
- [Temple & Webster Group: FY25 Appendix 4E financial report][fy25]
- [House of Isabella: Temple and Webster review (third-party blog; lower reliability)][hoi]

[tp]: https://au.trustpilot.com/review/templeandwebster.com.au
[pr]: https://www.productreview.com.au/listings/temple-webster
[ajust]: https://www.ajust.com.au/complaints/temple-webster
[ajust-ret]: https://www.ajust.com.au/returns/temple-webster
[receiptor]: https://receiptor.ai/guides/return-policies/temple-and-webster-return-policy-complete-guide-for-hassle-free-returns
[visual]: https://insideretail.com.au/news/temple-webster-launches-visual-search-tool-201807
[ai]: https://insideretail.asia/2025/08/14/how-ai-is-driving-temple-websters-growth-in-homewares-and-beyond/
[ami]: https://ami.org.au/knowledge-hub/temple-flags-marketing-and-ai-investments-as-key-to-growth/
[fy25]: https://www.templeandwebstergroup.com.au/FormBuilder/_Resource/_module/7ik7dYsBn029bNaEl1204g/docs/reports/TPW_Appendix_4E_Financial_Report_2025.pdf
[hoi]: https://houseofisabella.com.au/pages/temple-and-webster-review
