[CmdletBinding()]
param([switch]$CheckOnly)

# User-run local lab only. Does not accept a server URL, credentials, project id or cleanup target.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$labName = 'dropzone-audit-inscricoes-01a128'
$labImage = 'postgres:17.6'
$auditLabel = 'inscricoes-20261011'
$runStamp = [DateTime]::UtcNow.ToString('yyyyMMddHHmmss')
$runCode = [Guid]::NewGuid().ToString('N').Substring(0, 4)
$runKey = $runStamp + '_' + $runCode
$evidence = 'relatorios-testes/liga-sql-exec-' + $runStamp + '-' + $runCode
$baselineDb = 'dropzone_validation_liga_' + $runKey + '_before'
$fixedDb = 'dropzone_validation_liga_' + $runKey + '_fixed'
$regressionDb = 'dropzone_validation_liga_' + $runKey + '_regress'
$planDb = 'dropzone_validation_liga_' + $runKey + '_plan'
$containerId = $null
$localEngineVerified = $false
$previousFixtureDb = $env:DROPZONE_FIXTURE_DB
$previousDockerContext = $env:DOCKER_CONTEXT
$previousDockerHost = $env:DOCKER_HOST
$evidencePath = [IO.Path]::GetFullPath((Join-Path $taskRoot $evidence))
if (-not $evidencePath.StartsWith($taskRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Evidence must stay in the workspace.' }
foreach ($db in @($baselineDb, $fixedDb, $regressionDb, $planDb, ($planDb + '_baseline'))) {
    if ($db -notmatch '^dropzone_validation_[a-z0-9_]+$' -or $db.Length -gt 63) { throw 'Invalid fixture database name.' }
}

function Invoke-LabStep {
    param([string]$Name, [string]$Executable, [string[]]$Arguments)
    if ($Executable -eq 'docker') { $Arguments = @('--context', 'desktop-linux') + $Arguments }
    Write-Host ('Executing: ' + $Name)
    $savedPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $captured = @(& $Executable @Arguments 2>&1)
        $stepExit = $LASTEXITCODE
    } finally { $ErrorActionPreference = $savedPreference }
    $captured | Out-File -LiteralPath (Join-Path $evidencePath ($Name + '.log')) -Encoding UTF8
    foreach ($line in $captured) { Write-Host $line }
    if ($stepExit -ne 0) { throw ($Name + ' failed with exit code ' + $stepExit + '. Evidence: ' + $evidence) }
    return ($captured -join [Environment]::NewLine)
}

function Read-LabResult {
    param([string]$RelativePath, [int]$ExpectedCases)
    $result = Get-Content -LiteralPath (Join-Path $taskRoot $RelativePath) -Raw | ConvertFrom-Json
    if ($result.failed -ne 0 -or $result.passed -ne $ExpectedCases) { throw ('Unexpected test result: ' + $RelativePath) }
    return @{ file = $RelativePath; passed = $result.passed; failed = $result.failed; sha256 = (Get-FileHash -LiteralPath (Join-Path $taskRoot $RelativePath) -Algorithm SHA256).Hash.ToLowerInvariant() }
}

Push-Location -LiteralPath $taskRoot
try {
    $required = @('relatorios-testes/banco-publicado.json', 'relatorios-testes/liga-sql-2026-10-11/participation-candidate-before.sql',
        'relatorios-testes/liga-sql-2026-10-11/preparation-check.json', 'relatorios-testes/liga-sql-2026-10-11/reproduce-fraction.mjs',
        'scripts/testes/postgres-inscricoes/build-schema.mjs', 'scripts/testes/postgres-inscricoes/fresh-validation.mjs',
        'scripts/testes/postgres-inscricoes/validate-participation.mjs', 'scripts/testes/postgres-inscricoes/validate-liga-quotas.mjs',
        'scripts/testes/postgres-inscricoes/validate-slot-batch.mjs', 'scripts/testes/postgres-inscricoes/validate-group-choice.mjs',
        'scripts/testes/postgres-inscricoes/validate-slot-transfer.mjs', 'scripts/testes/postgres-inscricoes/validate-slot-plan.mjs',
        'scripts/testes/postgres-inscricoes/validate-native.mjs')
    foreach ($file in $required) { if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw ('Missing local file: ' + $file) } }
    $prepared = Get-Content -LiteralPath 'relatorios-testes/liga-sql-2026-10-11/preparation-check.json' -Raw | ConvertFrom-Json
    $candidateHash = (Get-FileHash -LiteralPath 'docs/sql/20261011_participation_write_candidate.sql' -Algorithm SHA256).Hash.ToLowerInvariant()
    $beforeHash = (Get-FileHash -LiteralPath 'relatorios-testes/liga-sql-2026-10-11/participation-candidate-before.sql' -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($candidateHash -ne $prepared.candidateSha256 -or $beforeHash -ne $prepared.baselineSha256) { throw 'Candidate/baseline changed since preparation. Review before running.' }
    if ($CheckOnly) {
        Write-Host 'Local inputs, hashes and database/output paths checked. No Docker command or SQL executed.'
        return
    }
    Get-Command docker -ErrorAction Stop | Out-Null
    Get-Command node -ErrorAction Stop | Out-Null
    $env:DOCKER_CONTEXT = 'desktop-linux'
    $env:DOCKER_HOST = $null
    $env:DROPZONE_FIXTURE_DB = $null
    New-Item -ItemType Directory -Path $evidencePath -ErrorAction Stop | Out-Null
    $runResult = @{ generatedAt = [DateTime]::UtcNow.ToString('o'); evidence = $evidence; expectedNativeCases = 324; nativeCasesPassed = 0;
        nativeCompleted = $false; candidateSha256 = $candidateHash; baselineSha256 = $beforeHash; productionReads = 0; productionWrites = 0;
        productionDdl = 0; remoteEnvironmentChanges = 0; publication = $false; suites = @(); cleanup = @{}; error = $null }
    try {
        # Pin the local Desktop context before starting or inspecting the engine.
        $endpoint = Invoke-LabStep 'docker-local-endpoint' 'docker' @('context', 'inspect', 'desktop-linux', '--format', '{{.Endpoints.docker.Host}}')
        if ($endpoint.Trim() -ne 'npipe:////./pipe/dockerDesktopLinuxEngine') { throw 'Only the local Docker Desktop Linux engine is allowed.' }
        $localEngineVerified = $true
        $null = Invoke-LabStep 'start-local-docker' 'docker' @('desktop', 'start')
        $null = Invoke-LabStep 'docker-engine' 'docker' @('info', '--format', '{{.OSType}} {{.ServerVersion}}')
        $existing = Invoke-LabStep 'existing-container' 'docker' @('ps', '-a', '--filter', ('name=^/' + $labName + '$'), '--format', '{{.ID}}')
        if ($existing.Trim()) { throw 'A container with the lab name already exists. It was not created by this run and will not be reused or removed.' }
        $containerId = (Invoke-LabStep 'create-container' 'docker' @('run', '--pull', 'never', '-d', '--name', $labName,
            '--label', ('dropzone.audit=' + $auditLabel), '--label', ('dropzone.run=' + $runKey), '--network', 'none', '--memory', '512m', '--cpus', '2',
            '-e', 'POSTGRES_PASSWORD=synthetic_fixture_only', '-e', 'POSTGRES_DB=dropzone_audit', $labImage)).Trim()
        if ($containerId -notmatch '^[0-9a-f]{64}$') { throw 'Unexpected container ID; cleanup requires a verified identity.' }
        $ready = $false
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            & docker exec $containerId pg_isready -U postgres -d dropzone_audit *> $null
            if ($LASTEXITCODE -eq 0) { $ready = $true; break }
            Start-Sleep -Seconds 2
        }
        if (-not $ready) { throw 'PostgreSQL was not ready within 60 seconds.' }
        $null = Invoke-LabStep 'schema-build' 'node' @('scripts/testes/postgres-inscricoes/build-schema.mjs')
        Copy-Item -LiteralPath 'relatorios-testes/banco-inscricoes-2026-10-11/schema-reconstruction.sql' -Destination (Join-Path $evidencePath 'schema-reconstruction.sql')
        Copy-Item -LiteralPath 'relatorios-testes/banco-inscricoes-2026-10-11/schema-reconstruction-result.json' -Destination (Join-Path $evidencePath 'schema-reconstruction-result.json')
        $null = Invoke-LabStep 'setup-before' 'node' @('scripts/testes/postgres-inscricoes/fresh-validation.mjs', $baselineDb, '--participation', '--slot-batch', '--group-choice')
        $null = Invoke-LabStep 'reproduce-before' 'node' @('relatorios-testes/liga-sql-2026-10-11/reproduce-fraction.mjs', $baselineDb, $evidence)
        $null = Invoke-LabStep 'setup-fixed' 'node' @('scripts/testes/postgres-inscricoes/fresh-validation.mjs', $fixedDb, '--participation', '--slot-batch', '--group-choice')
        $null = Invoke-LabStep 'participation59' 'node' @('scripts/testes/postgres-inscricoes/validate-participation.mjs', $fixedDb, $evidence)
        $null = Invoke-LabStep 'liga91' 'node' @('scripts/testes/postgres-inscricoes/validate-liga-quotas.mjs', $fixedDb, $evidence)
        $runResult.suites += Read-LabResult ($evidence + '/native-participation.json') 59
        $runResult.suites += Read-LabResult ($evidence + '/native-liga-quotas.json') 91
        # Enrollment regressions require a separate database with the original all-status index.
        $null = Invoke-LabStep 'setup-regressions' 'node' @('scripts/testes/postgres-inscricoes/fresh-validation.mjs', $regressionDb, '--slot-batch', '--group-choice')
        $null = Invoke-LabStep 'batch40' 'node' @('scripts/testes/postgres-inscricoes/validate-slot-batch.mjs', $regressionDb, $evidence)
        $null = Invoke-LabStep 'choice35' 'node' @('scripts/testes/postgres-inscricoes/validate-group-choice.mjs', $regressionDb, $evidence)
        $null = Invoke-LabStep 'transfer33' 'node' @('scripts/testes/postgres-inscricoes/validate-slot-transfer.mjs', $regressionDb, $evidence)
        $env:DROPZONE_FIXTURE_DB = $regressionDb
        $null = Invoke-LabStep 'enrollment35' 'node' @('scripts/testes/postgres-inscricoes/validate-native.mjs', '4340000')
        Copy-Item -LiteralPath 'relatorios-testes/banco-inscricoes-2026-10-11/native-validation-4340000.json' -Destination (Join-Path $evidencePath 'native-enrollment.json')
        $null = Invoke-LabStep 'plan31' 'node' @('scripts/testes/postgres-inscricoes/validate-slot-plan.mjs', $planDb, $evidence)
        $runResult.suites += Read-LabResult ($evidence + '/native-slot-batch.json') 40
        $runResult.suites += Read-LabResult ($evidence + '/native-group-choice.json') 35
        $runResult.suites += Read-LabResult ($evidence + '/native-transfer.json') 33
        $runResult.suites += Read-LabResult ($evidence + '/native-enrollment.json') 35
        $runResult.suites += Read-LabResult ($evidence + '/native-slot-plan.json') 31
        # Windows PowerShell does not expose hashtable keys to Measure-Object -Property.
        $runResult.nativeCasesPassed = 0
        foreach ($suite in $runResult.suites) { $runResult.nativeCasesPassed += [int]$suite['passed'] }
        if ($runResult.nativeCasesPassed -ne 324) { throw 'Native case total mismatch.' }
        if ((Get-FileHash -LiteralPath 'docs/sql/20261011_participation_write_candidate.sql' -Algorithm SHA256).Hash.ToLowerInvariant() -ne $candidateHash) { throw 'Candidate changed during validation.' }
        $runResult.nativeCompleted = $true
    } catch { $runResult.error = $_.Exception.Message; Write-Host ('Validation stopped: ' + $runResult.error) }
    finally {
        try {
            if (-not $localEngineVerified) { throw 'Docker cleanup skipped because the local endpoint was not verified.' }
            if ($containerId -and $containerId -match '^[0-9a-f]{64}$') {
                $inspected = @(ConvertFrom-Json (Invoke-LabStep 'inspect-owned-container' 'docker' @('inspect', $containerId)))[0]
                $boundPorts = @()
                if ($null -ne $inspected.HostConfig.PortBindings) { $boundPorts = @($inspected.HostConfig.PortBindings.PSObject.Properties) }
                if ($inspected.Id -ne $containerId -or $inspected.Name -ne ('/' + $labName) -or $inspected.Config.Image -ne $labImage -or
                    $inspected.Config.Labels.'dropzone.audit' -ne $auditLabel -or $inspected.Config.Labels.'dropzone.run' -ne $runKey -or $inspected.HostConfig.NetworkMode -ne 'none' -or
                    $boundPorts.Count -ne 0) { throw 'Owned lab identity mismatch; cleanup refused.' }
                $ownedVolumes = @($inspected.Mounts | Where-Object Type -eq 'volume' | ForEach-Object Name)
                $null = Invoke-LabStep 'remove-owned-container' 'docker' @('rm', '--force', '--volumes', $containerId)
                $stillExists = Invoke-LabStep 'verify-container-removed' 'docker' @('ps', '-a', '--filter', ('id=' + $containerId), '--format', '{{.ID}}')
                if ($stillExists.Trim()) { throw 'Owned container removal incomplete.' }
                foreach ($volume in $ownedVolumes) {
                    if ($volume -notmatch '^[a-zA-Z0-9_.-]+$') { throw 'Unexpected owned volume name.' }
                    $remainingVolume = Invoke-LabStep ('verify-volume-' + $volume) 'docker' @('volume', 'ls', '--filter', ('name=^' + $volume + '$'), '--format', '{{.Name}}')
                    if ($remainingVolume.Trim()) { throw 'An owned volume remains; no generic cleanup was performed.' }
                }
                $runResult.cleanup = @{ ownedContainerRemoved = $true; ownedVolumesRemoved = $true; removedId = $containerId; volumes = $ownedVolumes; imageCachePreserved = $true }
            }
            $running = Invoke-LabStep 'remaining-running-containers' 'docker' @('ps', '--format', '{{.ID}}')
            if (-not $running.Trim()) {
                $null = Invoke-LabStep 'restore-docker-stopped' 'docker' @('desktop', 'stop')
                $runResult.cleanup.dockerStopRequested = $true
            } else { $runResult.cleanup.dockerKeptForOtherContainers = $true }
        } catch { $runResult.cleanup.error = $_.Exception.Message; Write-Host ('Cleanup needs attention: ' + $_.Exception.Message) }
        $runResult | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $evidencePath 'run-result.json') -Encoding UTF8
        Write-Host ('Evidence: ' + $evidence)
    }
    if (-not $runResult.nativeCompleted -or $runResult.error -or $runResult.cleanup.ContainsKey('error')) { exit 1 }
    Write-Host 'Completed 324 native cases. No production database, GitHub or Vercel changes.'
} finally {
    $env:DROPZONE_FIXTURE_DB = $previousFixtureDb
    $env:DOCKER_CONTEXT = $previousDockerContext
    $env:DOCKER_HOST = $previousDockerHost
    Pop-Location
}
