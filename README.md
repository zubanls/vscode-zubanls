# Zuban README

A high-performance Python Language server written in Rust.

Supports Jupyter Notebooks in VSCode as well.

## Requirements

Zuban should work out of the bugs, since it is bundled with the extension.

Alternatively you can install zuban in a virtual environment. If that specific
virtualenv is activated in VSCode, Zuban will be loaded from there, so you can
use a specific Zuban version.

## Documentation

For general documetation about Zuban pease visit https://docs.zubanls.com.

There are a few settings VSCode related settings:

- `python.zuban.typeCheckingMode` to be able to only use completions/goto and
  not type checking and also choose the default mypy mode
- `python.zuban.disableLanguageServices` to make it possible to only use type checking
- `python.zuban.diagnosticMode` to enable VSCode to query the workspace diagnostics
- `zuban.executablePath` to enable a custom Zuban executable
- `zuban.loggingVerbosity` - to pass a value to the `ZUBAN_LOG` environment variable

All Zuban related type checking settings are configured in `pyproject.toml` or `mypy.ini`.

## Repository

https://github.com/zubanls/vscode-zubanls

Repository for Zuban: https://github.com/zubanls/zuban/
