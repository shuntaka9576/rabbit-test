# axum-on-lambda
## 構成

![axum](https://devio2024-media.developers.io/image/upload/v1729378884/2024/10/20/tbitukeuli784t7yqixt.png)

## Quick Start

依存関係の取得

```bash
npm install
```

デプロイ
```bash
npx cdk deploy web-app-stack

# デプロイ後CfnOutputにcurlコマンドが出力されるので、そちらを利用してテスト可能
```

## ローカル起動

```bash
cd web-app
cargo run
```

## Special Thanks

* [CloudFront + Lambda 関数 URL 構成でPOST/PUT リクエストを行うため Lambda@Edge でコンテンツハッシュを計算する](https://dev.classmethod.jp/articles/cloudfront-lambda-url-with-post-put-request/)
* [上記の実装](https://github.com/joe-king-sh/lambda-function-urls-with-post-put-sample)
