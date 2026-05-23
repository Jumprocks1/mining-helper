param($Target = ".", [switch]$Force, [switch]$WhatIf)

$dir = Get-Item $Target

$videos = gci -LiteralPath $dir *.mkv | sort Name
if ($videos.Count -eq 0) {
    $videos = gci -LiteralPath $dir -Recurse *.mkv | sort Name
}
$videoBaseNames = $videos.BaseName
$subs = gci -LiteralPath $dir -Recurse |? {$_.Extension -in ".srt",".ass"} | sort Name
if ($subs.Count -eq 0) {
    $zips = gci -LiteralPath $dir -Recurse |? {$_.Extension -in ".zip"}
    if ($zips.Count -eq 1) {
        $zip = $zips | Select -First 1
        $response = Read-Host "Do you want to unzip '$($zip.Name)'? (y/n)"
        if ($response -ne "y") { exit; }
        # Expand-Archive is jank and can't handle `[]` characters. This will usually remove them
        $relativeOutput = Resolve-Path -Relative -LiteralPath $zip.DirectoryName
        Expand-Archive -LiteralPath $zip.FullName -DestinationPath $relativeOutput
        $subs = gci -LiteralPath $dir -Recurse |? {$_.Extension -in ".srt",".ass"} | sort Name
    }
}
$subsBaseNames = $subs.BaseName

# ignore files that already have the correct name
$subs = $subs |? {$_.BaseName -notin $videoBaseNames}
$videos = $videos |? {$_.BaseName -notin $subsBaseNames}

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