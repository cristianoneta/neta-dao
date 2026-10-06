# Treasury receipt accounting — 2026-10-06

Status: source implemented; local Node/Python validation passed. Hosted browser,
PR checks and publication verification are pending. This is partial accounting,
not a claim of a complete P&L or a financial-reporting standard.

## Implemented

- Income & expenses between Assets and Treasury events, current-month default,
  year/month/full-year selection, UTC half-open boundaries, equal elapsed prior
  periods, category drilldown and exact transaction links. Shared graphite/mint
  tokens and contained table scrolling. Missing amounts use Unavailable.
- Observed NNS income from matched registration/renewal receipts. The complete
  income, expenses, operating result, changes and opening-to-closing bridge stay
  unavailable while overall transaction/classification coverage is missing.
- Removed fictional Treasury allocation, risk, cash-flow forecasts and payment
  schedules from the actual page. Upcoming commitments remain explicitly
  unconnected and outside paid expenses. No Reserve Policy.
- `scripts/update_treasury_accounting.py` is a separate bounded task in the
  existing main DAO job, with no additional cron, server, price feed or wallet.
  It writes `data/treasury/neta-main-accounting.json` atomically. Existing balance,
  historical-event and signed-price exports retain their collector ownership.
- Registry-index replay begins at deployment height 42391393 and ends 20 blocks
  before the observed tip. It checks fresh Juno identity, pagination totals,
  duplicate/truncated pages, known-payment retention and immutable amounts/prices.
  It preserves prior evidence on provider/parse failure; refresh status is explicit.

## Receipt and pricing evidence

Live STAVR REST collection matched the first payment
`85689A2C75DE86829D4116FA0AABBA5062D269679CA139984E169E8E2ACF8DC1`
at height 42400450, 2026-10-05 18:20:13 UTC. Exact fee: **4.755098 NETA**.
Its executed snapshot rate is **1.051503244853 USD/NETA**, observed at the timestamp
embedded in the payment. Fixed USD value: **5.000000976594010594**, displayed $5.00.
This is the accepted payment conversion, not an independently sampled spot price.

The parser requires successful execution, a top-level send through the pinned
NETA contract, a matching registry registration/renewal event, and one exact
registry-to-main-DAO transfer in the same message. It matches payer, name,
amount, operation, price/version and validity. Failed receipts, plain transfers,
swaps and funding do not become NNS revenue. Buyer-paid gas is not a DAO expense.
The two NETA legs yield one accounting entry keyed by chain/hash/message index.
USD integer arithmetic is fixed at 18 decimal places; no current-price revaluation.

This is provider-receipt evidence, not a Tendermint light-client proof or a new
independent raw-protobuf hash check. The existing launch archive is the recoverable
baseline. Nested or ambiguous multi-payment messages are unsupported and make
the refresh unavailable rather than being guessed. Contract upgrades and new
payment protocols need a reviewed parser update.

## Coverage boundaries / next work

NNS subtotals remain partial even after a successful index refresh: a public
index is not proof of complete historical coverage. No matched records in a
period do not establish zero activity. The full historical main-DAO event feed
remains separate and UNAVAILABLE. Other income, expenses, funding, own-wallet and
cross-chain reconciliation, historical prices, proposal attribution and a verified
commitment schedule still need authoritative inputs and classification rules.
No automatic income/expense classification from transfer direction is introduced.

The UI refetches the committed accounting file with the existing Treasury refresh;
DAO switches abort old loads and clear prior evidence. Wrong source identity,
duplicate entries and arithmetic mismatches fail closed. Other DAOs show their
own unavailable accounting state, never NETA main-DAO revenue.

## Validation

- 118 root Node tests and 38 Python tests passed locally, including new accounting
  tests for exact forwarding, amount/price binding, duplicate/failure rejection,
  partial coverage, UTC period boundaries and missing totals.
- A live collector run produced one matched receipt and `refresh_status=completed`.
  It read chain data only; no transaction, signature or contract change was made.
- Local Chromium installation failed because the downloaded archive was invalid.
  A dedicated hosted browser test covers period/category controls, DAO isolation,
  source/fetch failure, keyboard navigation and 320/390/768/1440px screenshots.
  Inspect that run and screenshots before publication; do not claim it passed yet.

Release PR owns final hosted checks, screenshot review and Pages/served-file evidence.
