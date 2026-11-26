"""IndexNow proof-of-control files for both separate MATE OpenSEO accounts."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
KEYS = ("56ebdd67c32d47a4be948dc73d52f4db", "b4f1269a4bbe4d41a50149ef72535a0d")

class IndexNowKeyFiles(unittest.TestCase):
    def test_care_spark_files_are_exact_keys(self):
        for key in KEYS:
            for root in (ROOT, ROOT / "spark"):
                with self.subTest(key=key,host=root.name):
                    path = root / (key + ".txt")
                    self.assertEqual(path.read_text(encoding="ascii").strip(), key)

if __name__ == "__main__":
    unittest.main()
