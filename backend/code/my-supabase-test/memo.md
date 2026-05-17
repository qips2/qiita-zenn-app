# seed.sql名変更

config.tomlで
[db.seed]
enabled = true
sql_paths = ['./A.sql', './B.sql']

# jwt無しの設定

npx supabase functions serve test-edge-function --no-verify-jwt

# 作業フォルダ

cd .\qiita-zenn-app\backend\code\my-supabase

# supabaseの起動と停止

npx supabase start
npx supabase stop

# url等確認

npx supabase status

# git organization

共有アカウントみたいなやつ

# edgefunction作成(ローカル)

npx supabase functions new {edgefunction_name}

# edgefunctionデプロイ

supabase functions deploy {edgefunction_name} --project-ref {REFERENCE_ID}

# migrationファイル作成

supabase migration new {name}

# DBの初期化(migirationファイルの環境にする)

supabase db reset

# DBパスワード

2SYiajdxeceh

# edgefunctionsの削除工程

1. functions内のフォルダ削除
2. config.toml内の[functions.*]を削除

# cron(定期実行)のjob一覧確認
