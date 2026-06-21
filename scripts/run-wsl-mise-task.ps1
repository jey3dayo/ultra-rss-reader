param(
  [Parameter(Mandatory = $true)]
  [string]$TaskName
)

$repoDir = $env:WSL_REPO_DIR
if ([string]::IsNullOrWhiteSpace($repoDir)) {
  Write-Error "WSL_REPO_DIR is required. Set it to the WSL checkout path, for example /home/user/src/ultra-rss-reader."
  exit 1
}

$wslDistros = wsl.exe --list --quiet 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Error "WSL is not ready for this Windows user. Install a WSL distribution, then set WSL_REPO_DIR to that checkout path."
  exit 1
}

if (($wslDistros | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }).Count -eq 0) {
  Write-Error "No WSL distribution is installed for this Windows user. Install a WSL distribution, then set WSL_REPO_DIR to that checkout path."
  exit 1
}

wsl.exe --cd $repoDir env CI=true PNPM_CONFIG_CONFIRM_MODULES_PURGE=false mise run $TaskName
exit $LASTEXITCODE
