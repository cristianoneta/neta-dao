import importlib.util
import unittest
from unittest.mock import patch
from pathlib import Path


SPEC = importlib.util.spec_from_file_location(
    "treasury_events", Path(__file__).parents[1] / "scripts" / "update_treasury_events.py"
)
events = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(events)


class TreasuryEventTests(unittest.TestCase):
    def test_extracts_confirmed_treasury_movement(self):
        raw = [
            {
                "type": "transfer",
                "attributes": [
                    {"key": "recipient", "value": events.TREASURY},
                    {"key": "sender", "value": "juno1sender"},
                    {"key": "amount", "value": "2500000ujuno"},
                ],
            }
        ]
        rows = events.movements(raw, {"ujuno": {"symbol": "JUNO", "decimals": 6}})
        self.assertEqual(rows[0]["direction"], "in")
        self.assertEqual(rows[0]["amount"], "2.5")
        self.assertEqual(events.classify(raw, rows)[0], "inflow")

    def test_detects_cross_chain_command_without_inventing_cashflow(self):
        raw = [
            {
                "type": "send_packet",
                "attributes": [{"key": "packet_data", "value": '{"sender":"' + events.TREASURY + '"}'}],
            }
        ]
        kind, _, _, packets = events.classify(raw, [])
        self.assertEqual(kind, "cross_chain_command")
        self.assertEqual(len(packets), 1)

    def test_transfer_attribute_order_does_not_hide_payments(self):
        raw = [
            {
                "type": "transfer",
                "attributes": [
                    {"key": "amount", "value": "798000000ujuno"},
                    {"key": "recipient", "value": "juno1recipient"},
                    {"key": "sender", "value": events.TREASURY},
                ],
            }
        ]
        rows = events.movements(raw, {"ujuno": {"symbol": "JUNO", "decimals": 6}})
        self.assertEqual(rows[0]["direction"], "out")
        self.assertEqual(rows[0]["amount"], "798")
        self.assertEqual(events.classify(raw, rows)[0], "payment")

    def test_event_identity_is_chain_and_transaction_hash(self):
        tx = {"hash": "ABC", "height": "10", "tx_result": {"events": []}}
        row = events.normalize(tx, "2026-01-01T00:00:00Z", {})
        self.assertEqual(row["id"], "juno-1:ABC")

    def test_osmosis_proxy_movement_retains_chain_and_account(self):
        raw = [{"type": "transfer", "attributes": [
            {"key": "recipient", "value": events.OSMOSIS_TREASURY},
            {"key": "sender", "value": "osmo1sender"},
            {"key": "amount", "value": "5000000uosmo"},
        ]}]
        tx = {"hash": "OSMO", "height": "20", "tx_result": {"events": raw}}
        row = events.normalize(tx, None, {"uosmo": {"symbol": "OSMO", "decimals": 6}}, events.CHAINS[1])
        self.assertEqual(row["id"], "osmosis-1:OSMO")
        self.assertEqual(row["type"], "inflow")
        self.assertEqual(row["treasury_address"], events.OSMOSIS_TREASURY)

    def test_proposal_title_is_attached_to_event(self):
        raw = [{"type": "wasm", "attributes": [{"key": "proposal_id", "value": "77"}]}]
        tx = {"hash": "TITLE", "height": "30", "tx_result": {"events": raw}}
        row = events.normalize(tx, None, {}, titles={"77": "Validator payment"})
        self.assertEqual(row["proposal_title"], "Validator payment")

    def test_incremental_scan_uses_verified_anchor_and_overlap(self):
        chain = {"address": "treasury", "creation_height": 10}
        source = {"address": "treasury", "last_scanned_height": 500, "anchor_hash": "A"*64}
        with patch.object(events, "block_hash", return_value="A"*64):
            self.assertEqual(events.scan_start(chain, "rpc", 600, source), (400, True))
        with patch.object(events, "block_hash", return_value="B"*64):
            with self.assertRaisesRegex(RuntimeError, "anchor changed"):
                events.scan_start(chain, "rpc", 600, source)
        self.assertEqual(events.scan_start(chain, "rpc", 600, {}), (10, False))

    def test_truncated_and_duplicate_pages_fail_instead_of_advancing_watermark(self):
        with patch.object(events, "rpc", return_value={"total_count": "1", "txs": []}):
            with self.assertRaisesRegex(RuntimeError, "truncated"):
                events.search("rpc", "transfer.sender", "wallet", 10, 20)
        with patch.object(events, "rpc", return_value={"total_count": "2", "txs": [{"hash": "A"}, {"hash": "A"}]}):
            with self.assertRaisesRegex(RuntimeError, "duplicate"):
                events.search("rpc", "transfer.sender", "wallet", 10, 20)

    def test_search_is_height_bounded(self):
        with patch.object(events, "rpc", return_value={"total_count": "0", "txs": []}) as call:
            self.assertEqual(events.search("rpc", "transfer.sender", "wallet", 10, 20), [])
        query = call.call_args.kwargs["query"]
        self.assertIn("tx.height>=10", query)
        self.assertIn("tx.height<=20", query)

    def test_optional_legacy_index_gap_keeps_every_cached_event(self):
        chain = events.CHAINS[1]
        old = {"chain_id": chain["id"], "tx_hash": "OLD", "height": chain["creation_height"]+100, "timestamp": None}
        with patch.object(events, "select_rpc", return_value=("rpc", chain["creation_height"]+300, 0, True)), patch.object(events, "block_hash", return_value="A"*64), patch.object(events, "search", return_value=[]):
            rows, source = events.collect_chain(chain, [old], {}, {})
        self.assertEqual([row["tx_hash"] for row in rows], ["OLD"])
        self.assertEqual(source["historical_missing_transactions"], 1)

    def test_required_history_loss_fails_before_replacing_ledger(self):
        chain = events.CHAINS[0]
        old = {"chain_id": chain["id"], "tx_hash": "OLD", "height": chain["creation_height"]+100, "timestamp": None}
        with patch.object(events, "select_rpc", return_value=("rpc", chain["creation_height"]+300, 0, True)), patch.object(events, "block_hash", return_value="A"*64), patch.object(events, "search", return_value=[]):
            with self.assertRaisesRegex(RuntimeError, "historical index lost"):
                events.collect_chain(chain, [old], {}, {})


if __name__ == "__main__":
    unittest.main()
