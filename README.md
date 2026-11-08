# David Dreier (Data Dave) — portfolio page

Static portfolio and quote-request page for David Dreier (Data Dave), LedgerFlow Systems LLC. It is plain HTML, CSS, and JavaScript for GitHub Pages.

## What the page does

- States the services actually offered: Excel report design, Power BI report design, data cleanup, and business reporting and bookkeeping support.
- States the one confirmed degree: bachelor's degree in Accounting & Finance, University of Pittsburgh.
- Runs one synthetic ledger in the browser. Filters for month, category, and entry type recalculate revenue, expenses, net, category totals, and the line table. Expense amounts are negative so the amount column adds up to the net.
- Sends a quote request only after the visitor submits the form and the fields pass validation. The request goes to the existing Formspree endpoint `https://formspree.io/f/mjkreldr`.

## What it does not do

- No model or insight feature, and no third-party script, font, or analytics host.
- No embedded Power BI report and no PBIX file. The sample is not client work.
- No client names, results, reviews, or claims of a connected accounting system.
- No checkout, published prices, or promised turnaround.
- No published email address or phone number.
- No proof that Formspree delivers messages to David. The page says that delivery is unconfirmed.
- No revocation of old API keys, and no rewrite of git history.

## Sample figures

Harbor Sample Ledger is fictional. The unfiltered book is 18 lines: revenue $49,500.00, expenses $12,840.00, net $36,660.00. January is revenue $16,800.00, expenses $4,200.00, net $12,600.00. `tests/report.test.mjs` checks every filter combination against those rows.

The sample math stays in the browser. Choosing a filter does not make a network request.

## Files

- `index.html` — page copy, quote form, and content security policy
- `styles.css` — layout
- `sample-report.js` — synthetic rows and totals
- `quote-form.js` — validation shared with the tests
- `main.js` — filters and the submit handler
- `favicon.svg` — icon
- `.nojekyll` — publish the files as-is

`api/insight.py` was an empty unused file and has been removed from the current tree. The old page remains in git history.

## Run locally

No install and no build.

```bash
python3 -m http.server
```

Open the URL the server prints. Asset paths are relative, so the same files work on a GitHub project-pages subpath.

## Tests

```bash
node tests/report.test.mjs
node tests/quote-form.test.mjs
node tests/source-scan.test.mjs
```

The source scan reads the current files only. It is expected to pass while older commits still contain keys. Do not rewrite history to satisfy it.

`node tests/browser-check.mjs` needs local Chrome. It loads the page from `127.0.0.1`, checks desktop and mobile layout, filter totals, and form validation, and stubs the quote submission. It does not post to Formspree and does not call Google. GitHub Actions runs the three Node tests only.

## Deployment

GitHub Pages for this repository publishes the root of `main`. Merging to `main` replaces the live site. Opening a pull request does not publish it.

Publish when the replacement page is the one you want visitors to see. Publishing removes the old page from the latest file. It does not remove older commits, and it does not revoke anything at Google.

## Credentials still in git history

Older revisions of `index.html` contain Google Gemini API keys for the removed insight feature. Two different keys appear there:

- Introduced in `90d0818722e87d362551ed0ddf3856939dbe9cf0` (20 June 2025) and last present in `d6758bde28c5851b6af5013fa519af7071866d34`.
- Replaced in `da9e55fb82f45eec70a7e37e2ad5e76c13cd4ddf` (23 June 2025) and still present through `4ececaa4ee7d1c7d7d5e3e0a2255c39b9489a5af`.

Both were only in `index.html`. The current files do not include them. This change does not revoke them, does not call Google, and does not rewrite history. Revoke both keys in the Google account that created them. The repository has no Google project id and no credential resource id, so a console record cannot be matched from these files alone.

Do not paste key values back into this repository.

## Quote form

The Formspree id was already on the previous page. Ownership and inbox delivery were not verified. The privacy notice is on the form. Automated tests must not submit it. A success message means Formspree returned a success response, and the page still does not claim David received the message.
