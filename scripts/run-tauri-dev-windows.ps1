# mise が PATH に足すツール dir が多いと cmd の上限 (8191 文字) を超え、node / pnpm が解決できなくなる。
# mise の tool dir は node / pnpm だけ残して重複を除いてから dispatch を起動する。
$ErrorActionPreference = "Stop"
$miseTools = [regex]::Escape("mise\installs\")
$keepTools = [regex]::Escape("mise\installs\") + "(node|pnpm)\\"
$entries = $env:PATH -split ";" | Where-Object { $_ -and ($_ -notmatch $miseTools -or $_ -match $keepTools) }
$env:PATH = ($entries | Select-Object -Unique) -join ";"
& node ./scripts/tauri-cli-dispatch.ts dev -c src-tauri/tauri.dev.conf.json -f mcp-bridge @args
exit $LASTEXITCODE
