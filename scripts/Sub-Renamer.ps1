param($Target = ".")

$dir = Get-Item $Target

$videos = gci -LiteralPath $dir -Recurse *.mkv | sort Name
$subs = gci -LiteralPath $dir -Recurse *.srt | sort Name

if ($videos.Count -eq 0) {
    Write-Error "No videos found"
    exit 1
}

if ($subs.Count -ne $videos.Count) {
    Write-Error "Different video ($($videos.Count)) vs sub ($($subs.Count)) count"
    exit 1
}

for ($i = 0; $i -lt $subs.Count; $i++) {
    $video = $videos[$i]
    $sub = $subs[$i]
    $newName = $video.BaseName + $sub.Extension
    echo "$($sub.Name) => $newName"
    Rename-Item -LiteralPath $sub $newName
}