# Copies `mining_helper.lua` to the mpv scripts folder
# Also sets the exe path to `../server/publish/MiningHelper.exe`

$mpvPath = $env:APPDATA + "/mpv"

$self = $PSScriptRoot

if (Test-Path $mpvPath -PathType Container) {
    $scripts = Join-Path $mpvPath "scripts"
    if (Test-Path $scripts -PathType Container) {
        $target = Join-Path $scripts "mining_helper.lua"
        $sourceFile = Join-Path $self "mining_helper.lua"
        $exePath = Resolve-Path (Join-Path $self "../server/publish/MiningHelper.exe")
        $exePath = $exePath -replace "\\", "/"
        $contents = (cat $sourceFile -Raw) -replace "@EXECUTABLE_PATH", $exePath
        echo "Found scripts folder, copying to $target"
        Set-Content -Path $target $contents
        echo "Installed, boot mpv and press Ctrl+D to make sure it works"
    }
}