param(
    [switch]$Watch,
    [switch]$Debug
)

$args = @()
if ($Watch) { $args += "--watch" }
if ($Debug) { $args += "--debug" }

node esbuild-test.mjs @args