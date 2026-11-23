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
        choices=[MOD.city_tile(date(2026,11,15),slot) for slot in range(16)]
        self.assertEqual(len({item[0] for item in choices}),16)
        self.assertLess(a[1][2]-a[1][0],0.12)
        self.assertLess(a[1][3]-a[1][1],0.09)

    def test_nationwide_rotation_avoids_adjacent_duplicate_city_tiles(self):
        cities={city for city, _, _ in MOD.CITIES}
        # At least one discovery centre in each prefectural-capital area;
        # three additional major cities are retained.
        self.assertEqual(len(cities),50)
        self.assertTrue({
            "札幌","青森","盛岡","仙台","秋田","山形","福島",
            "水戸","宇都宮","前橋","さいたま","千葉","東京","横浜",
            "新潟","富山","金沢","福井","甲府","長野","岐阜","静岡",
            "名古屋","津","大津","京都","大阪","神戸","奈良","和歌山",
            "鳥取","松江","岡山","広島","山口","徳島","高松","松山",
            "高知","福岡","佐賀","長崎","熊本","大分","宮崎",
            "鹿児島","那覇"
        }.issubset(cities))
        for day in (date(2026,11,23),date(2026,11,24)):
            tiles=[MOD.city_tile(day,i) for i in range(16)]
            self.assertEqual(len({name.split(" ")[0] for name,_ in tiles}),16)
            self.assertEqual(len({tuple(bounds) for _,bounds in tiles}),16)
            self.assertTrue(all(122 < xy[0] < 146 and 24 < xy[1] < 46
                                for _,xy in tiles))
        all_seen={
            MOD.city_tile(date(2026,11,23),i)[0].split(" ")[0]
            for i in range(80)
        }
        self.assertEqual(all_seen,cities)

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

    def test_block_marketplace_and_government_sites(self):
        features={"features":[
          self.sample("music_school","https://www.amazon.com/Lost-Samurai-School/"),
          self.sample("museum","https://www.pref.example.lg.jp/museum/","石川県立記念館"),
          self.sample("music_school","https://www.sample-school.jp/","こども音楽スタジオ")
        ]}
        got=list(MOD.select_records(features, "金沢"))
        self.assertEqual(len(got),1)
        self.assertEqual(got[0]["service"],"SPARK")

    def test_recent_feed_has_bounded_rows_without_losing_archive(self):
        sample=next(MOD.select_records(
            {"features":[self.sample("music_school","https://school.jp/")]}, "東京"))
        with tempfile.TemporaryDirectory() as tmp:
            archive=Path(tmp)/"all.csv"
            recent=Path(tmp)/"recent.csv"
            leads=[{**sample, "name":"教室"+str(i)} for i in range(25)]
            self.assertEqual(MOD.update_csv(archive,leads),(25,25))
            self.assertEqual(MOD.write_recent_csv(archive,recent,limit=5),5)
            with archive.open(encoding="utf-8") as f:
                self.assertEqual(len(f.readlines()),26)
            with recent.open(encoding="utf-8") as f:
                lines=f.readlines()
            self.assertEqual(len(lines),6)
            self.assertIn("教室24",lines[-1])

    def test_recent_feed_drops_legacy_marketplace_and_government_urls(self):
        sample=next(MOD.select_records(
            {"features":[self.sample("music_school","https://school.jp/")]}, "東京"))
        records=[
            sample,
            {**sample, "name":"Amazon book", "website":"https://www.amazon.com/books"},
            {**sample, "name":"市立施設", "website":"https://example.city.lg.jp/program"},
        ]
        with tempfile.TemporaryDirectory() as tmp:
            archive=Path(tmp)/"archive.csv"
            recent=Path(tmp)/"recent.csv"
            self.assertEqual(MOD.update_csv(archive,records),(3,3))
            self.assertEqual(MOD.write_recent_csv(archive,recent),1)
            with recent.open(encoding="utf-8") as handle:
                lines=handle.readlines()
            self.assertEqual(len(lines),2)

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
