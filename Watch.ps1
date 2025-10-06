$sass = Start-Process cmd "/c sass --embed-source-map --watch src/main.scss:dist/main.css" -NoNewWindow -PassThru
$esbuild = Start-Process node esbuild.mjs -NoNewWindow -PassThru

try {
    Write-Host "Jobs started"
    Wait-Process -Id $sass.Id,$esbuild.Id
} finally {
    Write-Host "Exiting"
    Stop-Process $sass
    Stop-Process $esbuild
}
