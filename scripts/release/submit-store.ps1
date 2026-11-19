param(
    [Parameter(Mandatory)][string]$PackagePath,
    [string]$ReleaseTag = $env:RELEASE_TAG,
    [string]$PriceId = $env:MSSTORE_PRICE_ID,
    [switch]$AutoCommit
)

$ErrorActionPreference = 'Stop'
if ($PriceId -cnotmatch '\ATier[0-9]+\z') {
    throw 'MSSTORE_PRICE_ID must be configured as Tier<number>, such as Tier1052; no Store changes were made.'
}
if ($ReleaseTag -cnotmatch '\Av(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\z') {
    throw 'Store submission requires a stable vX.Y.Z release tag.'
}
$missingCredentials = @(
    foreach ($name in @('MSSTORE_TENANT_ID', 'MSSTORE_CLIENT_ID', 'MSSTORE_CLIENT_SECRET')) {
        if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
            $name
        }
    }
)
if ($missingCredentials.Count -gt 0) {
    Write-Host "::notice::Store package submission skipped; configure the missing microsoft-store environment secrets: $($missingCredentials -join ',')"
    return
}
if ($env:MSSTORE_TENANT_ID -notmatch '\A[0-9a-fA-F-]{36}\z') {
    throw 'MSSTORE_TENANT_ID must be a tenant GUID.'
}
$package = Get-Item -LiteralPath $PackagePath
if ($package.PSIsContainer -or $package.Extension -cne '.msix') {
    throw 'Store submission requires one MSIX file.'
}
$expectedVersion = "$($ReleaseTag.Substring(1)).0"
$appId = '9N85DQ7XKQ20'
$appPath = "applications/$appId"

function Invoke-StoreRequest {
    param([ValidateSet('GET', 'POST', 'PUT')][string]$Method, [string]$Path, [System.Collections.IDictionary]$Body)
    $request = @{
        Method = $Method
        Uri = "https://manage.devcenter.microsoft.com/v1.0/my/$Path"
        Headers = $apiHeaders
        MaximumRedirection = 0
    }
    if ($null -ne $Body) {
        $request.ContentType = 'application/json'
        $request.Body = ConvertTo-Json -InputObject $Body -Depth 100 -Compress
    } elseif ($Method -eq 'POST') {
        # Store requires chunked framing for the empty create and commit requests.
        $request.ContentType = 'application/json'
        $request.TransferEncoding = 'chunked'
        $request.Body = ''
    }
    try {
        $response = Invoke-WebRequest @request
        $data = ConvertFrom-Json -InputObject $response.Content -AsHashtable -Depth 100
        if ($data -isnot [System.Collections.IDictionary]) { throw 'Unexpected response.' }
        return $data
    } catch {
        $status = [int]$_.Exception.Response.StatusCode
        throw "Store API $Method request failed (HTTP $status); response details are suppressed. Inspect the pending submission through the API before retrying."
    }
}

function Assert-Submission {
    param([System.Collections.IDictionary]$Submission, [switch]$Ingested)
    if ($Submission.id -cne $submissionId) { throw 'Store returned a different submission ID.' }
    if ($Submission.pricing.priceId -cne $PriceId) { throw 'Store submission price does not match MSSTORE_PRICE_ID.' }
    if ($Submission.targetPublishMode -cne $publishMode) { throw 'Store submission publish mode does not match the requested mode.' }
    if ($Submission.status -cnotin @('PendingCommit', 'CommitStarted', 'PreProcessing', 'Certification', 'Release', 'PendingPublication', 'Publishing', 'Published')) {
        throw 'Store submission entered a failed, canceled, or unknown state; inspect the submission through the API.'
    }
    if (-not $Ingested -and $Submission.status -cne 'PendingCommit') {
        throw 'Store draft is not pending commit; refusing to submit it.'
    }
    $actualMarketPrices = $Submission.pricing.marketSpecificPricings
    if ($null -eq $actualMarketPrices) { $actualMarketPrices = @{} }
    if ($actualMarketPrices -isnot [System.Collections.IDictionary] -or $actualMarketPrices.Count -ne $marketPrices.Count) {
        throw 'Store submission market-specific pricing changed.'
    }
    foreach ($market in $marketPrices.Keys) {
        if (-not $actualMarketPrices.Contains($market) -or $actualMarketPrices[$market] -cne $marketPrices[$market]) {
            throw 'Store submission market-specific pricing changed.'
        }
    }
    $activePackages = @($Submission.applicationPackages | Where-Object { $_.fileStatus -cne 'PendingDelete' })
    if ($activePackages.Count -ne 1 -or $activePackages[0].fileName -cne $package.Name) {
        throw 'Store submission dropped the new package or contains an unexpected package.'
    }
    $selectedPackage = $activePackages[0]
    if ($selectedPackage.version -and $selectedPackage.version -cne $expectedVersion) {
        throw 'Store package version does not match the release tag.'
    }
    if ($selectedPackage.fileStatus -cnotin @('PendingUpload', 'Uploaded')) {
        throw 'Store package upload status was not recognized.'
    }
    if ($Ingested) {
        return $Submission.status -cne 'PendingCommit' -and $selectedPackage.fileStatus -ceq 'Uploaded' -and $selectedPackage.version -ceq $expectedVersion
    }
}

try {
    $authResponse = Invoke-WebRequest -Method POST -Uri "https://login.microsoftonline.com/$($env:MSSTORE_TENANT_ID)/oauth2/token" -MaximumRedirection 0 -Body @{
        grant_type = 'client_credentials'
        client_id = $env:MSSTORE_CLIENT_ID
        client_secret = $env:MSSTORE_CLIENT_SECRET
        resource = 'https://manage.devcenter.microsoft.com'
    }
    $auth = ConvertFrom-Json -InputObject $authResponse.Content -AsHashtable
    if ([string]::IsNullOrWhiteSpace($auth.access_token)) { throw 'Missing access token.' }
} catch {
    throw 'Microsoft Store authentication failed; response details are suppressed.'
}
$apiHeaders = @{ Authorization = "Bearer $($auth.access_token)" }
$app = Invoke-StoreRequest GET $appPath
if ($app.id -cne $appId -or $app.lastPublishedApplicationSubmission.id -cnotmatch '\A[0-9]+\z') {
    throw 'Could not verify the Store app and its published submission; refusing to create a draft.'
}
if ($null -ne $app.pendingApplicationSubmission) {
    throw 'Partner Center has a pending submission; it will not be deleted, replaced, or committed by this run.'
}
$published = Invoke-StoreRequest GET "$appPath/submissions/$($app.lastPublishedApplicationSubmission.id)"
if ($published.id -cne $app.lastPublishedApplicationSubmission.id -or $published.status -cne 'Published') {
    throw 'Could not verify the last published Store submission; refusing to create a draft.'
}

$submission = Invoke-StoreRequest POST "$appPath/submissions"
$submissionId = $submission.id
if ($submissionId -cnotmatch '\A[0-9]+\z' -or $submissionId -ceq $published.id -or $submission.status -cne 'PendingCommit') {
    throw 'Store did not return a new pending draft; no further changes will be made.'
}
Write-Host "Created Store submission $submissionId. This run will leave it in place if a later step fails."
$submissionPath = "$appPath/submissions/$submissionId"
$uploadUri = $null
if (-not [Uri]::TryCreate($submission.fileUploadUrl, [UriKind]::Absolute, [ref]$uploadUri) -or
    $uploadUri.Scheme -cne 'https' -or -not $uploadUri.Host.EndsWith('.blob.core.windows.net', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Store did not return a recognized HTTPS Azure Blob upload URL.'
}
if ($submission.pricing -isnot [System.Collections.IDictionary] -or $submission.listings -isnot [System.Collections.IDictionary]) {
    throw 'Store draft pricing or listings are missing; refusing to update it.'
}
$oldPackages = @($submission.applicationPackages)
if ($oldPackages.Count -ne 1 -or $oldPackages[0].fileStatus -cne 'Uploaded' -or
    [IO.Path]::GetExtension($oldPackages[0].fileName) -cne '.msix') {
    throw 'Store draft must contain one previously uploaded MSIX; refusing to remove an unexpected package set.'
}
$marketPrices = $submission.pricing.marketSpecificPricings
if ($null -eq $marketPrices) { $marketPrices = @{} }
if ($marketPrices -isnot [System.Collections.IDictionary]) {
    throw 'Store draft market-specific pricing was not recognized.'
}
$publishMode = if ($AutoCommit) { 'Immediate' } else { 'Manual' }
$submission.pricing.priceId = $PriceId
$submission.targetPublishMode = $publishMode
foreach ($oldPackage in $submission.applicationPackages) { $oldPackage.fileStatus = 'PendingDelete' }
$submission.applicationPackages = @($submission.applicationPackages) + @(@{
    fileName = $package.Name
    fileStatus = 'PendingUpload'
    minimumDirectXVersion = 'None'
    minimumSystemRam = 'None'
})
$null = Invoke-StoreRequest PUT $submissionPath $submission

$zipPath = Join-Path $package.DirectoryName "store-$submissionId.zip"
Compress-Archive -LiteralPath $package.FullName -DestinationPath $zipPath
try {
    $null = Invoke-WebRequest -Method PUT -Uri $uploadUri -InFile $zipPath -ContentType 'application/zip' -MaximumRedirection 0 -Headers @{
        'x-ms-blob-type' = 'BlockBlob'
        'x-ms-version' = '2021-08-06'
    }
} catch {
    throw 'Store package ZIP upload failed; the signed URL and response details are suppressed. The draft was preserved.'
}
$draft = Invoke-StoreRequest GET $submissionPath
Assert-Submission $draft
if (-not $AutoCommit) {
    Write-Host "Store draft $submissionId is ready. Use the submission API to commit it; do not submit or edit it in Partner Center."
    return
}
$commit = Invoke-StoreRequest POST "$submissionPath/commit"
if ($commit.status -cne 'CommitStarted') { throw 'Store did not acknowledge the certification commit.' }

# Package version is populated only after Store ingestion; every retry is read-only.
for ($attempt = 1; $attempt -le 21; $attempt++) {
    $committed = Invoke-StoreRequest GET $submissionPath
    if (Assert-Submission $committed -Ingested) {
        Write-Host "Verified Store submission ${submissionId}: package $expectedVersion, configured price tier, automatic publication after certification."
        return
    }
    if ($attempt -lt 21) { Start-Sleep -Seconds 15 }
}
throw "Store submission $submissionId did not expose the expected ingested package within five minutes. Inspect it through the API; do not create a replacement."
