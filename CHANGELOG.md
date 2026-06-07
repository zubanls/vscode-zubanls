# Change Log

## 0.1.0

This release was essentially forked from the Pyrefly VSCode extension and
adapted for Zuban.

This enabled a lot of features:

- Support for environments from the Microsoft extensions
- A couple of settings:
  - `python.zuban.typeCheckingMode` to be able to only use completions/goto and
    not type checking and also choose the default mypy mode
  - `python.zuban.disableLanguageServices` to make it possible to only use type checking
  - `python.zuban.diagnosticMode` to enable VSCode to query the workspace diagnostics
  - `zuban.executablePath` to enable a custom Zuban executable
  - `zuban.loggingVerbosity` - to pass a value to the `ZUBAN_LOG` environment variable

## 0.0.1 - 0.0.7

Initial releases
