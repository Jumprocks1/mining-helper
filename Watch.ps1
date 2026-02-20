param(
    [switch]$HotReloadCss
)

$sass = Start-Process cmd "/c sass --embed-source-map --source-map-urls=absolute --watch src/main.scss:dist/main.css" -NoNewWindow -PassThru

try {
    if ($HotReloadCss) {
        $esbuild = Start-Process node esbuild.mjs,--hot-reload-css -NoNewWindow -PassThru
        $css = Start-Process dotnet "run --project .\HotReload\HotReload.csproj" -NoNewWindow -PassThru
        Write-Host "Jobs started"
        Wait-Process -Id $sass.Id,$esbuild.Id,$css.Id
    } else {
        $esbuild = Start-Process node esbuild.mjs,--watch -NoNewWindow -PassThru
        Write-Host "Jobs started"
        Wait-Process -Id $sass.Id,$esbuild.Id
    }
} finally {
    Write-Host "Exiting"
    Stop-Process $sass
    Stop-Process $esbuild
}
