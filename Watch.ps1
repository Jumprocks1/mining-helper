$sass = Start-Job -ScriptBlock { sass --embed-source-map --watch src/popup.scss:dist/popup.css } -Name "sass"
$esbuild = Start-Job -ScriptBlock { node esbuild.mjs } -Name esbuild

try {
    Write-Host "Jobs started"
    Receive-Job ($sass,$esbuild) -Wait -AutoRemoveJob
} finally {
    Write-Host "Exiting"
    Stop-Job ($sass,$esbuild)
    Remove-Job ($sass,$esbuild)
}
