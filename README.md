# Zuban Language Server

[Zuban](https://zuban.com/) is a high-performance Python Language Server and
type checker implemented in Rust, by the author of [Jedi](https://github.com/davidhalter/jedi).
Zuban is 20–200× faster than Mypy, while using roughly half the memory and CPU
compared to Ty and Pyrefly. It offers both a PyRight-like mode and a
Mypy-compatible mode, which behaves just like Mypy; supporting the same config
files, command-line flags, and error messages.

Zuban has full LSP (Language Server Protocol) support. Features include
diagnostics, completions, goto, references, rename, hover, auto-imports and
document highlights.

Supports Jupyter Notebooks in VSCode as well.

## Requirements

The VSCode extension for Zuban should work out of the box, since Zuban is
bundled with the extension.

Alternatively you can install zuban in a virtual environment. If that specific
virtualenv is activated in VSCode, Zuban will automatically load that specific
Zuban version.

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
