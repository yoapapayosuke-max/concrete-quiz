# コンクリート技士 試験対策ゲーム

## すぐ使う
- Windows: `start_quiz.bat` をダブルクリック
- 直接開く: `index.html` をブラウザで開く

## スマホでアプリっぽく使う
1. このフォルダ一式を GitHub Pages / Netlify / Cloudflare Pages などに置く
2. 公開URLをスマホで開く
3. iPhone: Safariの共有 →「ホーム画面に追加」→「Webアプリとして開く」
4. Android/PC Chrome系: インストール案内またはメニューからインストール

## 同梱したもの
- PWA用 `manifest.webmanifest`
- `service-worker.js`
- アイコン `icon.svg`, `apple-touch-icon.png`
- 起動用 `start_quiz.bat`

## 補足
- localStorage を使うため、学習履歴は同じブラウザ・同じ端末で保持されます。
- 完全なスマホアプリ化をしたい場合は、次の段階で Capacitor 化するのが簡単です。
