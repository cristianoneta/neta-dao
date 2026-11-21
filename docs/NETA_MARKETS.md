# NETA Markets — 21 November 2026

The owner approved a public NETA market page at `markets.cosmoot.com`, using
the token's coral, black and white palette and one observed price per minute.
The separate website source is managed with its Site. This repository contains
the independent read-only collector and generic production templates.

## Data contract

`collect_neta_market.py` reads the known JUNO/NETA XYK pool at one confirmed Juno
height. It checks the configured contract/code/pair/fee identity, response heights,
positive reserves, NETA decimals and token supply, block age and unchanged block
hash. A stale block, provider disagreement or query error cannot become a price.
The existing WYND reader and block parser remain unchanged.

NETA/JUNO is the normalized JUNO reserve divided by the normalized NETA reserve.
NETA/USD multiplies this by the existing Treasury JUNO/USD observation. That quote
keeps its actual source and time, with a 30-minute maximum age. An unavailable USD
quote produces null USD fields while retaining the independent JUNO observation.
There is no additional CoinGecko request for each minute or visitor.

SQLite retains the first accepted observation per UTC minute, block evidence,
exact decimal strings, both reserves, the USD quote and current token supply.
Repeated runs do not overwrite that minute. Regressed/conflicting block evidence
is rejected. No history is pruned. The systemd timer is independent of Treasury;
it does not restart, reschedule or run other collectors.

The publisher writes six explicitly public JSON files under `/data/markets/neta/`:
current, 1d, 7d, 1m, 3m and all. Short history uses minute observations; the weekly
view uses the last observed reference per 15-minute interval; longer views use
the last observed daily reference. Incremental aggregates keep long views from
reloading the complete minute archive on each publication. These are not executed trades, trade volume
or trade OHLC candles. Daily Treasury reference prices before the first collector
day remain separately identified and lack the newer per-price evidence.

Current and prior UTC-day records and the historical references are exported as
gzip JSON into the existing collector archive, under its backup lock. Existing
encrypted infrastructure backups include that directory. A busy backup prevents
publication/export for that cycle; the committed SQLite observation is retained
and the next minute retries. Files and database are not deleted by the collector.
An actual scheduled backup/download and an archive restoration must be accepted
after installation; the source does not itself prove remote backup success.

## Publication boundary

The supplied Caddy route exposes only the six named JSON files from an independent
directory in the existing read-only public snapshot mount. SQLite, archive files
and operator configuration remain outside it. The existing generation publisher
and Treasury paths are unchanged. The website uses a fixed-path same-origin proxy,
because the original data endpoint does not advertise browser CORS.

The frontend distinguishes the existing 15-minute Treasury fallback from the
new minute collector. It does not describe browser polling as minute recording.
Current supply is read from the CW20 contract; price times total supply is labelled
total-supply valuation, not circulating market capitalization.

## Validation and activation

Targeted tests cover exact pool normalization, supply decimals, rejected stale USD
and block observations, block disagreement, idempotency, chain-qualified historical JUNO pricing, regressed block rejection, null prices, archive
roundtrip and separation of historical daily records. A read-only live probe on
21 November accepted Juno height 43,967,582 and the 31,886.6 NETA supply; it made
eight requests including failover and received 28,955 response bytes. That probe
did not install or enable a production service.

Installation requires the separately reviewed operator package. It adds the new
script and timer, validates the narrow data route, preserves existing services
and runs a new observation before enabling the timer. Custom-domain DNS/TLS,
the first production observation, a later automatic minute and backup acceptance
are separate checks. No wallet, contract, swap or governance state is modified.

## Additional NETA market and executed volume — 21 November

The separate five-minute pool collector adds Osmosis pool 631 (NETA/OSMO).
It verifies the IBC trace back to the Juno NETA contract and reads the actual
weighted-pool reserves; an 80/20 pool must not use the XYK two-times-quote-reserve
liquidity formula. Osmosis LCDs do not confirm a requested state height, so this
latest-state observation records its bracketing block range and explicitly has
no exact state height. Juno observations retain their confirmed-height checks.

Both pools receive rolling 24-hour swap volume. Each successful matching swap
event contributes its single JUNO or OSMO leg; unrelated multi-hop events,
liquidity additions/removals and failed transactions are excluded. Events in the
same transaction remain distinct by event index. The query uses confirmed block
boundaries, a small index lag, stable bounded pagination and a known-receipt
control. Coverage describes the provider's transaction index, not a light-client
proof or guaranteed availability of pruned receipts. Missing or incomplete
coverage stays unavailable, while a completed empty window is measured zero.

The native quote-token volume is exact for the accepted indexed receipts. Its
USD display uses the current separately timestamped Treasury quote; it is not a
sum of historical USD execution prices. Stale USD does not erase native volume.
No extra price subscription or visitor-triggered blockchain scan is introduced.

Swap identities and scan evidence persist in an independent SQLite database;
current/prior UTC-day gzip exports enter the existing encrypted backup scope.
Earlier files are retained. The existing minute service remains independent of
pool-index failures. The frontend reads the additional allowlisted `pools.json`.
Server installation, an automatic later observation and backup acceptance remain
separate deployment checks; source tests and a live probe do not prove activation.

The Price / Market value chart switch uses price times the supply observed with
each point. Series now preserve that supply. Older daily records without supply
remain missing in valuation mode; no present supply is assigned retrospectively.
This is total-supply valuation, not a claim about circulating market cap.
