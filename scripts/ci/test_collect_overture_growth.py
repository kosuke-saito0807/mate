"""Offline tests; never hit S3 or send mail."""
import importlib.util
import tempfile
import unittest
from datetime import date
from pathlib import Path

FILE = Path(__file__).resolve().parents[1] / "collect_overture_growth.py"
SPEC = importlib.util.spec_from_file_location("mate_overture_growth", FILE)
MOD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MOD)


class TestOvertureGrowth(unittest.TestCase):
    def sample(self, tax, website, name="こども音楽スタジオ"):
        return {"type":"Feature","properties":{
            "names":{"primary":name},"taxonomy":{"primary":tax},
            "websites":[website],"confidence":0.9,
            "operating_status":"open"}}

    def test_only_relevant_first_party_https_leads(self):
        features={"features":[
            self.sample("music_school","https://sample-school.jp/"),
            self.sample("music_school","http://other-school.jp/"),
            self.sample("cafe","https://mycafe.jp/"),
            self.sample("workshop","https://craft-example.jp/",name="親子クラフト工房")
        ]}
        got=list(MOD.select_records(features,"東京都"))
        self.assertEqual(len(got),2)
        self.assertEqual({x["service"] for x in got},{"SPARK","PLAY"})
        self.assertTrue(all(x["email"]=="" and x["mail_basis"]=="UNVERIFIED" for x in got))
        self.assertTrue(all(x["source_url"]==MOD.SOURCE_URL for x in got))

    def test_duplicate_stage_has_no_email_and_does_not_inflate(self):
        rec=next(MOD.select_records({"features":[self.sample("music_school","https://school.jp")]}, "大阪"))
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/"leads.csv"
            self.assertEqual(MOD.update_csv(path,[rec,rec]),(1,1))
            self.assertEqual(MOD.update_csv(path,[rec]),(0,1))

    def test_rotation_is_bounded_and_changes_daily(self):
        a=MOD.city_tile(date(2026,11,15),0)
        b=MOD.city_tile(date(2026,11,16),0)
        self.assertNotEqual(a,b)
        self.assertEqual(len(a[1]),4)
        choices=[MOD.city_tile(date(2026,11,15),slot) for slot in range(8)]
        self.assertEqual(len({item[0] for item in choices}),8)
        self.assertLess(a[1][2]-a[1][0],0.12)
        self.assertLess(a[1][3]-a[1][1],0.09)

    def test_care_requires_sitter_not_generic_nursery(self):
        nursery=self.sample("day_care", "https://sample-nursery.jp/", "つつじが丘保育園")
        sitter=self.sample("child_care", "https://sitter-company.jp/", "訪問型ベビーシッター会社")
        nursery_records=list(MOD.select_records({"features":[nursery]}, "鹿児島"))
        sitter_records=list(MOD.select_records({"features":[sitter]}, "東京"))
        self.assertEqual(nursery_records,[])
        self.assertEqual(len(sitter_records),1)
        self.assertEqual(sitter_records[0]["service"],"CARE")

    def test_japanese_class_name_maps_to_spark(self):
        x=self.sample("school", "https://sample-piano.jp/", "こども音楽教室")
        got=list(MOD.select_records({"features":[x]}, "東京"))
        self.assertEqual(len(got),1)
        self.assertEqual(got[0]["service"],"SPARK")

    def test_block_social_and_close_locations(self):
        features={"features":[
           self.sample("music_school","https://instagram.com/test/"),
           {"type":"Feature","properties":{"names":{"primary":"こども音楽教室"},
               "taxonomy":{"primary":"music_school"},"websites":["https://music.jp"],
               "operating_status":"permanently_closed"}}
        ]}
        self.assertEqual(list(MOD.select_records(features,"東京都")),[])


if __name__=="__main__":
    unittest.main()
