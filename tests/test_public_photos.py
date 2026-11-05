import unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from mate_public_photos import public_photos,safe_image_url
AID="MATE-WEB-01234567-89ab-4cde-8f01-23456789abcd"
def row(state="確認済み",rights="掲載権限あり"):
    return {"申請ID":AID,"サービス":"CARE","画像URL1":"https://images.example.jp/childcare.jpg",
      "画像URL2":"https://images.example.jp/room.webp","画像URL3":"","画像URL4":"","画像URL5":"",
      "画像掲載権限の申告":rights,"画像審査状態":state}
class Photos(unittest.TestCase):
    def test_verified(self):
        o=public_photos(AID,"CARE",[row()],"訪問保育")
        self.assertEqual(len(o["images"]),2)
        self.assertEqual(o["thumbnail"],o["images"][0])
        self.assertIn("fallback-care",o["fallbackImageKey"])
    def test_unreviewed_never_public(self):
        for state,rights in [("未審査","掲載権限あり"),("確認済み","画像登録なし"),("差戻し","掲載権限あり")]:
            self.assertEqual(public_photos(AID,"CARE",[row(state,rights)],"訪問保育")["images"],[])
    def test_bad_image_never_public(self):
        for url in ["http://images.example.jp/a.jpg","https://images.example.jp/a.svg","https://127.0.0.1/a.jpg","https://images.example.jp/a.jpg#track","https://images.example.jp/a.jpg?foo="+"x"*200]:
            x=row();x["画像URL1"]=url
            self.assertFalse(safe_image_url(url))
            self.assertEqual(public_photos(AID,"CARE",[x],"訪問保育")["images"],[])
    def test_wrong_applicant_and_duplicate(self):
        self.assertEqual(public_photos("other","CARE",[row()],"訪問保育")["images"],[])
        self.assertEqual(public_photos(AID,"CARE",[row(),row()],"訪問保育")["images"],[])
    def test_no_images_uses_default(self):
        self.assertEqual(public_photos(AID,"CARE",[],"訪問保育")["images"],[])
        self.assertIsNone(public_photos(AID,"CARE",[],"訪問保育")["thumbnail"])
if __name__=="__main__":unittest.main()
