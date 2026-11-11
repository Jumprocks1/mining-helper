param(
    [switch]$Watch,
    [switch]$Debug
)

$a = @()
if ($Watch) { $a += "--watch" }
if ($Debug) { $a += "--debug" }

node esbuild-test.mjs @a -- @args