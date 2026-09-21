import importlib.util
import unittest
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


if __name__ == "__main__":
    unittest.main()
