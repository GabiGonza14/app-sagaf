#!/bin/bash
# run-tests-with-report.sh — Run all E2E tests and generate HTML report with embedded videos
# Usage: bash run-tests-with-report.sh
# Output: playwright-report/index.html (open in browser to review all videos)

set -e

echo "🧪 SAGAF E2E Test Runner with HTML Report + Video Evidence"
echo "============================================================"
echo ""

# Kill any existing server on port 3099
fuser -k 3099/tcp 2>/dev/null || true
sleep 1

# Clean previous results
rm -rf test-results playwright-report test-results/videos

# Run tests — NO --reporter flag, so the config's ['html'] reporter generates the report
# The config already has: video: 'on' and ['html', { outputFolder: 'playwright-report', open: 'never' }]
echo "▶ Running 65 tests (this takes ~5-8 minutes)..."
echo ""
node node_modules/@playwright/test/cli.js test casos-de-prueba.spec.ts

echo ""
echo "============================================================"
echo "✅ Test run complete!"
echo ""

# Show summary
echo "📊 Report location:"
echo "   playwright-report/index.html"
echo ""
echo "🎬 Videos embedded in the report (open index.html in a browser)"
echo ""

# List video count
VIDEO_COUNT=$(find test-results -name "*.webm" 2>/dev/null | wc -l)
echo "📹 Videos recorded: $VIDEO_COUNT"
echo "📸 Screenshots captured: $(find test-results -name "*.png" 2>/dev/null | wc -l)"
echo ""

# Try to open the report in the default browser
if command -v xdg-open &>/dev/null; then
  echo "🌐 Opening report in browser..."
  xdg-open playwright-report/index.html 2>/dev/null || true
elif command -v open &>/dev/null; then
  echo "🌐 Opening report in browser..."
  open playwright-report/index.html 2>/dev/null || true
fi

echo ""
echo "Or open manually: file://$(pwd)/playwright-report/index.html"