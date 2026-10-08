# Handoff für den nächsten Chat – NETA DAO

> Historical checkpoint. Current continuation: [HANDOFF](../HANDOFF.md);
> current inventory: [CURRENT_STATE](CURRENT_STATE.md). Older next steps below
> are evidence of that session, not instructions to repeat completed work.

Stand: 3. Oktober 2026, ca. 21:00 Uhr Europe/Berlin.

## Sofort hier weiterlesen

Der Nutzer hat die laufende Implementierung für einen Chatwechsel unterbrochen.
Auftrag: Haupt-DAO von NETA in die bestehende Website integrieren, Juno-Governance-Profil zugänglich machen und eine wiederverwendbare DAO-Onboarding-Checkliste auf GitHub anlegen.

**Die hier beschriebene neue DAO-Integration ist unfertiger Arbeitsstand und noch nicht live.**
Der Arbeitsbranch `wip/dao-onboarding-handoff-20261003` sichert Code und diese Datei.
Er basiert auf `a56ac4b7f78adf685d21887c45813fd162954944` (PR #117), nicht auf dem inzwischen durch Treasury-Bot-Commits weitergelaufenen `main`.
Beim Chatwechsel war `main` zuletzt `fb67aeab1b54908637233114bcf62f04ac53a8c1`; erneut abrufen.
Vor Integration aktuelle Änderungen vergleichen und Bot-Daten erhalten.

- Repository: <https://github.com/cristianoneta/neta-dao>
- Website: <https://dao.netareborn.com>
- Arbeitsbranch: <https://github.com/cristianoneta/neta-dao/tree/wip/dao-onboarding-handoff-20261003>
- Zuerst diese Datei, danach `AGENTS.md`, `docs/CURRENT_STATE.md` und für UI-Arbeit `docs/DESIGN_SYSTEM.md` lesen.
- Der alte Abschnitt „Next concrete task“ in `HANDOFF.md` beschreibt die vorherige Names-Priorität. **Zunächst diese DAO-Integration abschließen.**

Startauftrag für den nächsten Chat:

> Lies `docs/HANDOFF_NEXT_CHAT_2026-10-03.md` auf dem Arbeitsbranch `wip/dao-onboarding-handoff-20261003`. Prüfe aktuellen GitHub-Stand und CI. Setze die begonnene Haupt-DAO-Integration fort, behebe die dokumentierten offenen Punkte und veröffentliche erst nach erfolgreichen Prüfungen. Bestehende Operations-/Juno-Funktionen und Treasury-Bot-Daten erhalten.

## Nutzerziel und letzte Erklärung

Der Nutzer möchte den eigentlichen NETA-Haupt-DAO mit Treasury, alten Proposals, nachvollziehbarer Mitgliedschaft, DAO-Profil, Verzeichnisname und RELAY-Unterstützung einbinden. Künftige NNS-Einnahmen sollen nachvollziehbar sein. Alle bestehenden Untermenüs berücksichtigen; fehlende Funktionen ehrlich kennzeichnen.

Die letzte Nutzerfrage war, was „zentrale DAO-Konfiguration“ bedeutet. Erklärung: DAO-Stammdaten liegen einmal zentral statt separat in Auswahlmenü, RELAY, Treasury und anderen Modulen. Ein Eintrag enthält Name, Chain, Core-Adresse, Proposal-/Voting-Module, Treasury-Quelle, Verzeichnisname und freigeschaltete Funktionen. Die gemeinsame Konfiguration ersetzt nicht die Adapter für unterschiedliche Governance-Systeme.

Der Nutzer möchte nun ausdrücklich eine Handoff-Datei, um im neuen Chat weiterzuarbeiten. Keine weitere Feature-Fertigstellung oder Veröffentlichung in diesem Übergabeschritt behaupten.

## Bereits veröffentlichter Stand

- PR #117 ist integriert: bestehende Home-Voxelgrafiken in den Desktop-Überschriften von Proposals, Delivery, Contributors und Treasury; Assembly-Plaza für RELAY. Dekoration entfällt bis einschließlich 960 px. Contributors-Überlauf bei 320 px korrigiert.
- PR #117 enthält außerdem CI-Cache-/Formatierungswartung und aktualisierte Dokumentation. Die finalen PR-Prüfungen waren erfolgreich; Pages-Deployment `37144143067` erfolgreich.
- RELAY besitzt einen konstanten Titel und direkte Navigation: Inbox, Directory, Contacts, My profile, .neta name. Kein separater Preview-Modus und keine verschachtelte Names-Navigation. Following wird über Directory verwaltet.
- Graphit/Mint, gemeinsame Komponenten und vorhandene Voxelgrafiken beibehalten; keine erneute grundlegende Neugestaltung.
- Names-Registry ist deaktiviert: `REGISTRY=null`. Registrierung, Verlängerung, Übertragung, Profil-Schreibzugriffe, Profil-Proposals und echte namensbasierte Zahlungen sind nicht veröffentlicht.
- Mainnet-Messaging bleibt deaktiviert. UNI-7-Labor und produktive Website nicht verwechseln.
- Native Juno-Abstimmung/Submission ist deaktiviert. Bestehender Operations-Voting-Pfad darf nicht versehentlich deaktiviert oder auf neue DAOs übertragen werden.
- Delivery und Teile von Contributors/Treasury-Planung sind gekennzeichnete Konzepte, keine echten Mandate oder Zahlungszusagen.

## Verifizierte Identitäten und Beobachtungen

Die Werte sind Beobachtungen vom 3. Oktober 2026, keine dauerhaften Bestandszusagen.

| Gegenstand | Verifizierter Wert |
| --- | --- |
| Chain | `juno-1` |
| Tatsächlicher Core-Name | `Neta DAO` |
| Haupt-DAO Core | `juno1c5v6jkmre5xa9vf9aas6yxewc7aqmjy0rlkkyk4d88pnwuhclyhsrhhns6` |
| Proposal-Modul | `juno13z0mu9cyd0rj9cwr0hgwm9rxl8g9zwleqjg6pulcyypts26nua8qkzmlg0` |
| Voting-Modul | `juno1839rlmw33avduccuhpnv6cqxsdlwpz87vq8g6x6jkfrdzpwtl8nsgf20f4` |
| Staking-Vertrag | `juno1a7x8aj7k38vnj9edrlymkerhrl5d4ud3makmqhx6vt3dhu0d824qh038zh` |
| NETA CW20, 6 Dezimalstellen | `juno168ctmpyppk90d34p3jjy658zf5a5l3w8wk35wht6ccqj4mr0yv8s4j5awr` |
| Core-Version | `crates.io:cw-core` v0.1.0; Code-ID 432; Erzeugungshöhe 4324738 |
| Proposal-Version | `crates.io:cw-govmod-single` v0.1.0 |
| Voting-Version | `crates.io:cw20-staked-balance-voting` v0.1.0 |
| Historische Proposals | 3; darunter #2 „LLC Operating Agreement Ratification“, #3 „Ratify Neta DAO Constitution“, beide executed |
| Vorgesehener Verzeichnisname | `neta.dao.neta` – **keine aktive On-chain-Registrierung** |

Mitgliedschaftssnapshot `data/daos/neta.json`: Höhe **42333531**, erzeugt **2026-10-03T18:49:26Z**, **2088 positive Staking-Adressen**, Summe **4075135927 Roh-Einheiten = 4075.135927 NETA**. Alle Abfragen dieses Collectors sind auf die Höhe gepinnt; die Summe wird mit dem Voting-Modul abgeglichen. Raw-State-Namespace: `b'\x00\x0fstaked_balances'`. `list_stakers` ist bei diesem alten Vertrag nicht verfügbar.

Diese Adressen zeigen Governance-Beteiligung durch Staking. Sie beweisen weder rechtliche Mitgliedschaft noch Mitarbeit oder aktuelles Stimmrecht bei jedem historischen Proposal. Gestakte Mitgliedertoken sind **kein Treasury-Vermögen**.

Treasury-Snapshot `data/treasury/neta-main.json`: Höhe 42333618 als Kontext, erzeugt **2026-10-03T18:50:04Z**, vier Bestände und Status `PARTIAL`. Geprüfter Core-Bestand u. a. **2.571312 NETA** und **1402.010133 JUNO**; bewerteter Teil ca. **15.14 USD**. Zwei IBC-Assets sind unbewertet. Treasury-Abfragen sind anders als die Mitgliedschaft nicht durchgehend höhengepinnt. Die leere neue History-Datei bedeutet fehlende Zeitreihe, nicht Nullvermögen.

Operations ist ein anderer DAO:

- Core: `juno1excmamnysxujtd2hzm343nzdwch79y5cvk5h7w6uxlrt230xqwtqkmancl`
- Proposal-Modul: `juno1m9skms04ymmhsyc2q9cguja47d07mljsfnvm8f584dc645urxvjsjc9ep0`

Juno Governance ist native Chain-Governance, kein gewöhnlicher DAO-Core-Vertrag und keine normale Empfangsadresse. Der vorgesehene Eintrag `juno-governance.dao.neta` ist lediglich ein Verzeichnisname. **Juno besitzt im implementierten NNS derzeit keine registrierte .neta-Adresse.** Der bisher fehlende Profilknopf entstand durch ein nur für Operations implementiertes Profil.

## Gesicherter, noch unfertiger Code

| Dateien | Begonnene Änderung |
| --- | --- |
| `data/dao-directory.json`, `dao-directory.js`, `scripts/build_dao_directory.py` | Zentrale Einträge Operations, Neta DAO und Juno; synchron generiertes Browser-Modul, `--check` gegen Drift |
| `neta-governance.js` | DAO-Auswahl aus Konfiguration, Haupt-DAO-Historie, neuer `dao-readonly`-Modus, kein Haupt-DAO-Signer/Workshop |
| `names-workspace.js`, `ux-draft.js`, `index.html` | Profile für alle drei DAOs, tiefe Links `#relay/dao/<id>`, passende Modul-Navigation, Unterscheidung Verzeichnisname/registrierter Name |
| `dao-members.js`, `names.css` | Mitgliedschaftsansicht in Profil und Contributors, Adresssuche, schrittweise Anzeige, Herkunft und Grenzen |
| `relay.js` | Proposal-Beobachtung anhand zentral konfigurierter Module und Follow-Auswahl, dynamische Profil-Follow-Knöpfe |
| `scripts/update_dao_directory.py` | Höhengepinntes, identitätsgeprüftes Mitglieder-Snapshot mit Summenabgleich |
| `scripts/update_treasury.py`, `treasury.js` | Separate Haupt-DAO-Bestände/History; NNS derzeit inaktiv; gestakte Mitgliedertoken aus Treasury ausgeschlossen |
| `scripts/update_treasury_events.py` | Begonnener separater Main-DAO-Event-Collector, nur erlaubte CW20-Transferereignisse; derzeit realer Index-Blocker |
| `.github/workflows/treasury-snapshot.yml` | Neue Snapshot-Schritte und Dateien vorbereitet; noch nicht erfolgreich als Gesamtjob verifiziert |
| `.github/workflows/contract-ci.yml`, `.github/workflows/relay-crypto-browser.yml` | Pfadfilter und neue Prüfungen vorbereitet |
| `tests/test_dao_onboarding.py`, `tests/frontend-smoke.test.mjs`, `spikes/relay-corecrypto/browser-workspace-security.mjs` | Identität/Power/CW20-Fälle sowie UI-/Routing-/Readonly-Prüfungen ergänzt, Browserlauf noch ausstehend |

Gesicherte neue Datendateien: `data/daos/neta.json`, `data/treasury/neta-main.json`, `data/treasury/neta-main-history.json`.

**Nicht mitgesichert/überschrieben:** lokal ebenfalls neu erzeugte Operations-/Community-Dateien `current.json`, `history.json`, `juno-community-pool.json`, `juno-community-history.json`. Ihre kanonischen Bot-Fortschreibungen auf main erhalten. Keine neue `neta-main-events.json` vorhanden, da die Abfrage gescheitert ist.

Lokale Arbeitsverzeichnisse und temporäre Hilfsskripte sind privat dokumentiert.
Für eine Fortsetzung aktuelles main abrufen und vorhandene lokale Änderungen erhalten.

## Konkrete offene Punkte – zuerst bearbeiten

1. **Treasury-Event-Index funktioniert für den Haupt-DAO nicht.** Letzter echter Aufruf: `python scripts/update_treasury_events.py --dao neta`. Ergebnis bei PublicNode, Pocket und Polkachu jeweils „historical address index is empty“, zuletzt auch mit Probe `transfer.recipient`. Die frühere Probe `wasm._contract_address` war ebenfalls leer. Nicht als leere vollständige Historie ausgeben. Aktueller Workflow würde deshalb scheitern; vor Merge eine belastbare Quelle oder einen ausdrücklich als unverfügbar gekennzeichneten, von bestehenden Operations-Snapshots isolierten Zustand implementieren. Kein erfundenes Null-Revenue.
2. **Juno-Regression im Action-Button prüfen/beheben:** `renderActions` verwendet aktuell `disabled = !CONTRACT || (...)`. Dadurch kann der bisherige native Juno-Setup-Pfad ebenfalls deaktiviert werden. Nur den neuen `dao-readonly`-Fall sperren, bestehende autorisierte Juno-/Operations-Pfade erhalten.
3. **DAO-spezifische Treasury-Texte und Konzeptdaten prüfen:** vorhandener Footer über Juno-Core plus Osmosis-Proxy trifft nicht auf den neuen Haupt-DAO zu. Operations-Beispieldaten nicht als Haupt-DAO-Daten zeigen. Quelle und Asset-Custody müssen zum selektierten DAO passen.
4. **Unbekannte IBC-Dezimalstellen:** bestehender Collector fällt auf sechs zurück. Bei den zwei neuen unbekannten IBC-Assets ist das nicht verifiziert. Roh-Einheiten oder klar unbekannte Metadaten darstellen; keine präzisen Tokenmengen erfinden. Preise weiterhin unbewertet lassen.
5. **Profilidentität:** unbekannte Route fällt derzeit auf Operations zurück. Besser sichtbarer unbekannter DAO statt falschem Profil. Mitglieder-Snapshot neben Core/Voting/Staking auch gegen Chain-/Token-Identität prüfen. Main-DAO-Eventdaten vor Darstellung gegen erwarteten Scope/Treasury prüfen.
6. **Historische Proposals im Browser testen:** jetziger Stub liefert überwiegend leere `reverse_proposals`. Fixture mit drei Haupt-DAO-Proposals ergänzen und Detailöffnung prüfen. Nicht nur Readonly-Button testen.
7. **Gesamtworkflow-Laufzeit und Fehlerisolation:** bisheriger Treasury-Job hat zehn Minuten Timeout; vollständiger Mitglieder-Collector plus alle Treasury-/Event-Schritte sind noch nicht gemeinsam vermessen. Effiziente Aktualisierung und Erhalt vorhandener Operations-Ausgaben sicherstellen.
8. **UI prüfen:** drei DAOs, Auswahlwechsel, Reload, Direktlinks, Profile/Follow, echte Haupt-DAO-Proposals, Members-Suche, Treasury-PARTIAL-/Unavailable-Zustände und 320/768/1440 px. Änderungen in laufender Anwendung visuell prüfen; keine Wallet-Transaktionen auslösen.
9. **Dokumentation fertigstellen:** wiederverwendbare `docs/DAO_ONBOARDING_CHECKLIST.md`, passendes GitHub-Issue-Template und konkrete Restarbeiten als Issue anlegen. `CURRENT_STATE.md`, `HANDOFF.md` und Names-Plan erst mit zutreffendem Veröffentlichungsstatus aktualisieren. Diese Unterlagen/Issues wurden noch nicht erstellt.
10. **Veröffentlichen:** frisches main einbeziehen, vollständigen Checkout testen, relevante CI erfolgreich abwarten, erst dann PR integrieren und Pages sowie Treasury-Bot prüfen. Anschließend Live-UI kontrollieren. Die WIP-Sicherung ist keine Freigabe zum ungeprüften Merge.

## Tests und Nachweisgrenzen

Vor dem Chatwechsel erfolgreich: insgesamt **21 Python-Tests** aus `test_dao_onboarding.py`, `test_treasury_events.py`, `test_treasury_history.py`; Syntaxprüfung der bearbeiteten JavaScript-Dateien. Der Generator wurde lokal verwendet. Echte Mitglieder- und Bestandsabfragen liefen erfolgreich. Echte historische Treasury-Eventabfrage scheiterte wie oben beschrieben.

Noch nicht erfolgreich nachgewiesen: komplette Frontend-Tests im vollständigen Repository, erweiterter Browserlauf, gesamter neuer Snapshot-Workflow, Live-Darstellung des neuen DAO, vollständige historische Accounting-Abdeckung. Eventuelle CI-Ergebnisse des Sicherungs-PR im nächsten Chat neu prüfen.

Nützliche Befehle im vollständigen Checkout:

```sh
python scripts/build_dao_directory.py --check
python -m unittest discover -s tests -p 'test_dao_onboarding.py'
python -m unittest discover -s tests -p 'test_treasury_events.py'
python -m unittest discover -s tests -p 'test_treasury_history.py'
node --test tests/*.test.mjs
```

Browser-/Contract-Prüfungen gemäß aktuellen Workflows ausführen. Keine Erfolgsaussage aus dem bloßen Start eines Jobs ableiten.

## NNS- und Produktentscheidungen erhalten

- Persönliche Namen: mindestens 3 Zeichen; 3 Zeichen USD 640/Jahr, 4 Zeichen USD 160/Jahr, ab 5 Zeichen USD 5/Jahr, Zahlung in NETA. Der anfängliche Text „5 NETA im ersten Jahr“ ist überholt.
- Juno-NETA-Pool bleibt gewählter Preisreferenzpool. Kauf/Verlängerung benötigt aktuellen, belastbaren NETA-Quote; Quote-Service, Schutzregeln und v2-Vertrag sind noch nicht veröffentlicht.
- Laufzeit, Verlängerung und Übertragung sollen verwaltet werden können. Details im akzeptierten `docs/NETA_NAMES_V2_PLAN.md` lesen.
- Bevorzugte Chain zugleich bevorzugtes Empfangsnetzwerk, damit Nutzer nicht doppelt wählen müssen. Aktuell Juno; Osmosis/IBC später nur mit verifiziertem Asset/Empfänger/Routing und klarer Bestätigung.
- DAO-Namen separat unter `<slug>.dao.neta`, systemseitig/gratis vorgesehen. Slug aus dem tatsächlichen Namen ableiten; Identität über Chain plus Core bzw. expliziten nativen Governance-Adapter. Kollisionen und Reservierungen brauchen Regeln. Verzeichniszuordnung ist noch keine Registry-Registrierung.
- „Im NETA-Verzeichnis geprüft“ und „Von der DAO bestätigt“ sind verschiedene Aussagen. Profiländerungen soll ein DAO-Mitglied vorbereiten und per Proposal zur DAO-Entscheidung geben können; noch nicht implementiert.
- RELAY-Bestätigung und Lifecycle-Erinnerungen gewünscht. Nutzer schlug Registrierung sowie 6/3/1 Monate, 2/1 Wochen, 1 Tag, Ablauf und Ende von 30 Tagen Nachfrist vor. Nicht als implementierten Scheduler oder endgültig beschlossene Zustellpolitik darstellen; akzeptierten Plan auf Empfänger, Abos, Deduplizierung und Ablaufregeln prüfen.
- **NNS-Einnahmen noch nicht aktiv:** Registry/Empfänger/Eventquelle sind nicht produktiv verbunden. Ein beliebiger NETA-Eingang ist kein bewiesener NNS-Umsatz. Später genaue Registry-Identität, DAO-beschlossenen Empfänger, konkrete Fee-Events und Transaktionsbelege verbinden; keine pauschale Einnahmenklassifizierung.

## Wiederverwendbare DAO-Onboarding-Checkliste – in nächsten PR übernehmen

- [ ] Tatsächlichen Chain-/Core-/Modultyp und Anzeigenamen on-chain prüfen; native Governance gesondert behandeln.
- [ ] Eindeutigen zentralen Konfigurationseintrag mit verifizierten Modulen, Quellen und unterstützten Funktionen anlegen.
- [ ] Verzeichnisname nachvollziehbar ableiten, Kollisionen prüfen und Registry-/Bestätigungsstatus korrekt anzeigen.
- [ ] Proposal-Pagination, historische Details und Status prüfen; Schreibpfade nur nach separatem Adapter-/Berechtigungsnachweis freigeben.
- [ ] Treasury-Custody abgrenzen; native/CW20/IBC/LP-Assets samt Metadaten, fehlenden Preisen und Roh-Einheiten prüfen.
- [ ] History und Eventledger auf Vollständigkeit, Indexlücken und richtige DAO-Zuordnung prüfen; NNS-Umsatz gesondert belegen.
- [ ] Mitgliedschaftsgrund, Stimmgewicht und Herkunft zeigen; Member-Custody nicht als Treasury zählen.
- [ ] Directory-Profil, Copy-Aktionen, RELAY-Follow, tiefe Links und alle Modul-Scopes prüfen.
- [ ] Lade-/Leer-/Fehler-/Readonly-Zustände und responsive Darstellung testen; bestehende DAOs auf Regressionen prüfen.
- [ ] Dokumentation/Release-Gates aktualisieren; CI, Bot-Exports und Pages nach Integration verifizieren.

## Arbeitsregeln

- Nutzer möchte konkrete Umsetzung ohne unnötige Rückfragen; seine Frage nach Architektur war keine Stornierung.
- Bestehende UX weiterverwenden; keine Preview-Zwischenebene und keine verschobene Navigation.
- Keine Seeds/Private Keys, keine selbst ausgelösten Wallet-Schreibvorgänge, kein Mainnet-Messaging aktivieren.
- Kryptografische Archive, Ratchet-/Outbox- und Transaktionsjournale erhalten. Unklare Broadcasts nicht still wiederholen.
- Branch/PR verwenden; kein Force-Push, kein destruktives Reset, keine Bot-Daten durch ältere lokale Snapshots ersetzen.
- Asset-Query-Versionen bei JS/CSS-Änderungen aktualisieren. Unterschiedliche Legacy-/v0.3.0-APIs nicht vermischen.
- Keine Subagenten ohne expliziten Nutzer- oder einschlägigen Projektauftrag.
