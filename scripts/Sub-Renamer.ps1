param($Target = ".", [switch]$Force, [switch]$WhatIf)

$dir = Get-Item $Target

$videos = gci -LiteralPath $dir -Recurse *.mkv | sort Name
$subs = gci -LiteralPath $dir -Recurse *.srt | sort Name

if ($videos.Count -eq 0) {
    Write-Error "No videos found"
    exit 1
}

if ($subs.Count -ne $videos.Count) {
    Write-Error "Different video ($($videos.Count)) vs sub ($($subs.Count)) count"
    if (!$Force) {
        exit 1
    }
}

$c = [Math]::min($subs.Count, $videos.Count)

for ($i = 0; $i -lt $c; $i++) {
    $video = $videos[$i]
    $sub = $subs[$i]
    $newName = $video.BaseName + $sub.Extension
    echo "$($sub.Name) => $newName"
    if (!$WhatIf) {
        Rename-Item -LiteralPath $sub $newName
    }
}