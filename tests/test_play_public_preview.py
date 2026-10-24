import datetime as dt
import unittest
from scripts.sync_play_public_preview import build_public,valid_url

TODAY=dt.date(2026,10,24)
APPLICATION={
    "サービス":"PLAY","公開ID":"play_demo_01","教室・事業者名":"【架空】親子工作体験",
    "公式URL":"https://example.org/event","都道府県":"東京都",
    "市区町村・対応エリア":"東京都北区","ジャンル":"工作・ものづくり",
    "紹介文":"親子で楽しむ創作体験を提供する架空のサンプル事業者です。予約はできません。",
    "審査状態":"承認","担当者権限の確認":"確認済み",
    "審査者":"運営担当","掲載申請の意思":"掲載の意向（別途合意）",
    "情報確認日":"2026-10-23","対象最少年齢":"3",
    "対象最高年齢":"10","体験料金（税込円）":"1000",
    "月謝（税込円）":"","GmailメッセージID":"SECRET",
    "担当者メール":"private@example.org"
}
CONTRACT={
    "サービス":"PLAY","状態":"有効","掲載先ID":"play_demo_01",
    "契約ID":"CX1","同意者":"事業者","同意日時":"2026-10-23",
    "条件版":"2026-10-23","合意証拠URL・メールID":"private-evidence",
    "開始日":"2026-10-23","終了日":"2026-12-31"
}
class Gate(unittest.TestCase):
    def build(self,a=None,c=None):
        return build_public([APPLICATION if a is None else a],[CONTRACT if c is None else c],TODAY)
    def test_approved_staging_no_contacts(self):
        result=self.build()
        self.assertEqual(len(result),1)
        self.assertEqual(result[0]["prefecture"],"東京都")
        self.assertNotIn("private@example.org",str(result))
        self.assertNotIn("private-evidence",str(result))
        self.assertNotIn("monthlyFee",result[0])
        self.assertFalse(result[0]["trialReferralEnabled"])
    def test_no_contract(self):self.assertEqual(build_public([APPLICATION],[],TODAY),[])
    def test_revoked(self):self.assertEqual(self.build(c={**CONTRACT,"状態":"取消"}),[])
    def test_expired(self):self.assertEqual(self.build(c={**CONTRACT,"終了日":"2026-10-01"}),[])
    def test_missing_signer(self):self.assertEqual(self.build(c={**CONTRACT,"同意者":""}),[])
    def test_no_reviewer(self):self.assertEqual(self.build(a={**APPLICATION,"審査者":""}),[])
    def test_unapproved(self):self.assertEqual(self.build(a={**APPLICATION,"審査状態":"未審査"}),[])
    def test_bad_age(self):self.assertEqual(self.build(a={**APPLICATION,"対象最少年齢":""}),[])
    def test_no_publication_id(self):self.assertEqual(self.build(a={**APPLICATION,"公開ID":""}),[])
    def test_duplicate(self):
        with self.assertRaises(ValueError):
            build_public([APPLICATION,APPLICATION],[CONTRACT],TODAY)
    def test_reject_userinfo_url(self):
        self.assertFalse(valid_url("https://user:pass@example.org/x"))
    def test_care_never_enters_play(self):self.assertEqual(self.build(a={**APPLICATION,"サービス":"CARE"}),[])
if __name__=="__main__": unittest.main()
