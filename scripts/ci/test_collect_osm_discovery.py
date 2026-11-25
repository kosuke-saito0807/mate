"""Offline-only OSM discovery safety tests (no API calls and no email)."""
import csv
import importlib.util
import sys
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
SPEC = importlib.util.spec_from_file_location("mate_osm_discovery", ROOT / "collect_osm_discovery.py")
MOD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MOD)


def item(name="まちの書道教室", osm_id=123, website="https://business.jp/"):
    return {
        "type": "node", "id": osm_id,
        "tags": {"name": name, "website": website, "amenity": "studio"}
    }


class OSMDiscoverySafety(unittest.TestCase):
    def test_50_centres_rotated_through_25_days_with_bounded_boxes(self):
        start = date(2026, 11, 25)
        choices = [record for day in range(25)
                   for record in MOD.tiles(start + timedelta(days=day))]
        self.assertEqual(len(choices), 50)
        self.assertEqual(len({x[0] for x in choices}), 50)
        self.assertEqual({x[0].split(" OSM")[0] for x in choices},
                         {city for city, _, _ in MOD.CITIES})
        for label, bbox in choices:
            self.assertLess(bbox[2] - bbox[0], 0.071)
            self.assertLess(bbox[3] - bbox[1], 0.111)
            query = MOD.query_for_bbox(bbox)
            self.assertIn("out tags 1500", query)
            self.assertIn('"website"', query)
            self.assertIn('"contact:website"', query)
            self.assertNotIn('"email"', query)
            self.assertNotIn('"phone"', query)
            self.assertLess(len(query), 1200)

    def test_rejects_unbounded_searches(self):
        for bbox in [(0, 0, 90, 180), (35, 139, 35, 139),
                     (34, 138, 34.2, 138.4), (35, 5, 36, 7)]:
            with self.assertRaises(ValueError):
                MOD.query_for_bbox(bbox)

    def test_child_services_are_unverified_first_party_only(self):
        elements = [
            item("まちの書道教室", 11, "https://study.jp/"),
            item("親子ガラス体験", 12, "https://glass.jp/"),
            item("ベビーシッター訪問サービス", 13, "https://sitter.jp/"),
            item("大人のカフェ", 14, "https://cafe.jp/"),
            item("さくら保育園", 15, "https://daycare.jp/"),
            item("一般洋品店", 16, "https://fashion.jp/"),
            item("子ども英語教室", 17, "http://insecure.jp/"),
            item("書道教室個人SNS", 18, "https://instagram.com/foo"),
            item("キッズ体操教室", 19, "https://example.go.jp/"),
            item("こども料理教室", 20, "https://example.jp/?visitor=token"),
            item("親子陶芸体験", 21, "https://user:secret@bad.example.jp/"),
        ]
        # A public crowd-sourced website is NOT proof of permission to email.
        got = list(MOD.select_candidates({"elements": elements}, "東京 OSM 1"))
        self.assertEqual({z["service"] for z in got}, {"CARE", "SPARK", "PLAY"})
        self.assertEqual(len(got), 3)
        self.assertEqual({z["source_url"] for z in got}, {
            "https://www.openstreetmap.org/node/11",
            "https://www.openstreetmap.org/node/12",
            "https://www.openstreetmap.org/node/13"
        })
        self.assertTrue(all(z["mail_basis"] == "UNVERIFIED" for z in got))
        self.assertTrue(all(not z["email"] and not z["contact_url"] for z in got))

    def test_filters_closures_invalid_ids_and_malicious_rows(self):
        examples = [
            item("書道教室", -1),
            {**item("書道教室"), "type": "user"},
            {**item("書道教室"), "tags": {}},
            {"type": "way", "id": 45, "tags": {"name": "こども音楽教室",
                                                   "website": "https://school.jp/",
                                                   "disused": "yes"}},
        ]
        self.assertEqual(list(MOD.select_candidates({"elements": examples}, "東京")), [])

    def test_archived_osm_rows_are_distinct_from_overture_and_no_send(self):
        source = list(MOD.select_candidates({"elements": [
            item("まちの書道教室", 37, "https://study.jp/")
        ]}, "青森 OSM 1"))
        with tempfile.TemporaryDirectory() as folder:
            archive = Path(folder) / "osm.csv"
            recent = Path(folder) / "recent.csv"
            self.assertEqual(MOD.update_csv(archive, source), (1, 1))
            self.assertEqual(MOD.update_csv(archive, source), (0, 1))
            self.assertEqual(MOD.write_recent_csv(archive, recent), 1)
            with archive.open(encoding="utf-8", newline="") as handle:
                row = list(csv.DictReader(handle))[0]
            self.assertEqual(row["source_url"], "https://www.openstreetmap.org/node/37")
            self.assertEqual(row["mail_basis"], "UNVERIFIED")
            self.assertEqual(row["email"], "")
            self.assertEqual(row["contact_url"], "")
            self.assertEqual(row["service"], "SPARK")
            self.assertEqual(row["region"], "青森 OSM 1")

    def test_no_unsafe_fetch_outside_fixed_overpass_source(self):
        self.assertEqual(MOD.ENDPOINT, "https://overpass.private.coffee/api/interpreter")
        self.assertEqual(MOD.ATTRIBUTION, "© OpenStreetMap contributors (ODbL)")
        self.assertEqual(MOD.LICENSE_URL, "https://www.openstreetmap.org/copyright")
        # Verification through a hard mock, not a real network request.
        fake = {"elements": [item()]}
        class Response:
            status = 200
            headers = {"Content-Type": "application/json"}
            def __enter__(self): return self
            def __exit__(self, *a): return False
            def read(self, size): return __import__("json").dumps(fake).encode("utf-8")
        with patch.object(MOD, "urlopen", return_value=Response()) as fetch:
            out = MOD.download(MOD.tiles(date(2026, 11, 25))[0][1])
            self.assertEqual(len(out["elements"]), 1)
            req = fetch.call_args.args[0]
            self.assertEqual(req.full_url, MOD.ENDPOINT)
            self.assertEqual(req.get_method(), "POST")
            self.assertIn("data=", req.data.decode("utf-8"))
            self.assertIn("MATE-open-data-discovery", req.headers.get("User-agent", ""))


if __name__ == "__main__":
    unittest.main()
