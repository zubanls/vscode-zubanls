# Extension Tests

This directory contains the tests for the extension. These tests start a VSCode
client and will test the extension behavior.

To run the tests:

- run `npm run watch` or `npm: watch` VSCode task (from the `lsp/` dir)
- `npm run test` / `vscode-test` on the command-line (or through the
  package.json scripts in VSCode) OR UI exposed from the
  [Extension Test Runner](https://marketplace.visualstudio.com/items?itemName=ms-vscode.extension-test-runner)
  extension in VSCode (when `lsp` folder is open as a workspace)
