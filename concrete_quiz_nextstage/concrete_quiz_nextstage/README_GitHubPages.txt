コンクリート技士 試験対策ゲーム - GitHub Pages 公開手順

1) GitHubで新しいリポジトリを作成
   例: concrete-quiz

2) このフォルダの中身を全部アップロード
   index.html / quiz.html / result.html / app.js / questions.js / style.css
   manifest.webmanifest / service-worker.js / icon.svg / apple-touch-icon.png
   404.html / .nojekyll も一緒に入れてください。

3) GitHubの Settings → Pages を開く
   Build and deployment の Source を Deploy from a branch にする
   Branch は main / root を選ぶ
   Save を押す

4) 数分待つと公開URLが出ます
   例: https://ユーザー名.github.io/concrete-quiz/

5) スマホで公開URLを開く
   - iPhone: Safariの共有 → ホーム画面に追加
   - Android/Chrome: 画面の案内かメニューからインストール

補足
- ローカルでPWA機能を試すなら start_quiz_server.bat が便利です。
- 学習履歴は端末ごとのブラウザ localStorage に保存されます。
- 問題を更新したら service-worker.js の CACHE_NAME を v3, v4 のように上げると反映しやすくなります。
