param(
    [switch]$Watch
)

if ($Watch) {
    node test.mjs --watch
} else {
    node test.mjs
}