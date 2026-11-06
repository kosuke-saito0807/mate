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
    def test_drive_asset_requires_verified_private_copy(self):
        drive="DRIVE:"+"A"*30
        r=row()
        r["画像URL1"]=drive
        r["画像URL2"]=""
        correct="/"+("partner-media/play" if r["サービス"]=="PLAY" else "assets/partner-media/care")+"/01234567-89ab-4cde-8f01-23456789abcd/01-1234567890abcdef.jpg"
        self.assertEqual(public_photos(AID,r["サービス"],[r],"訪問保育")["images"],[])
        mapped=public_photos(AID,r["サービス"],[r],"訪問保育",media_map={drive:correct})
        self.assertEqual(mapped["images"],[correct])
        self.assertEqual(mapped["thumbnail"],correct)
        r["画像審査状態"]="未審査"
        self.assertEqual(public_photos(AID,r["サービス"],[r],"訪問保育",media_map={drive:correct})["images"],[])
    def test_no_images_uses_default(self):
        self.assertEqual(public_photos(AID,"CARE",[],"訪問保育")["images"],[])
        self.assertIsNone(public_photos(AID,"CARE",[],"訪問保育")["thumbnail"])

    def test_revoked_approved_media_is_removed_but_unrelated_files_preserved(self):
        import tempfile
        from mate_drive_media import sync_approved_media, _prune_generated_media
        from pathlib import Path
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            uuid="01234567-89ab-4cde-8f01-23456789abcd"
            folder=root/uuid
            folder.mkdir()
            published=folder/"01-1234567890abcdef.jpg"
            published.write_bytes(b"previously approved example")
            unrelated=folder/"manual-source.jpg"
            unrelated.write_bytes(b"do not touch owner source files")
            prefix="/partner-media/play" if "kosuke-saito0807/mate".endswith("private") else "/assets/partner-media/care"
            _prune_generated_media(root,{prefix+"/"+uuid+"/"+published.name},prefix)
            self.assertTrue(published.exists(),"approved asset must be retained")
            sync_approved_media([],set(),"PLAY" if prefix.endswith("play") else "CARE",root,prefix,None)
            self.assertFalse(published.exists(),"revoked asset must not retain a public URL")
            self.assertTrue(unrelated.exists(),"only generated files may be pruned")

if __name__=="__main__":unittest.main()
