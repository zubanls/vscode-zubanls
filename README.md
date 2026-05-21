# Zuban README

A high-performance Python Language server written in Rust.

Supports Jupyter Notebooks in VSCode as well.

## Requirements

The extension needs to have `zuban` installed. It can be installed with:

```
pip install zuban --break-system-packages --upgrade
```

Install it into the same environment as your project (for example your virtual environment) so the language server can resolve imports the same way your tests and runtime do.

## Virtual environments

By default, when **ZubanLS: Executable Path** is empty, the extension picks `zuban` in this order:

1. **Selected environment from the Python extension** ([Python](https://marketplace.visualstudio.com/items?itemName=ms-python.python)) — matches **Python: Select Interpreter** and restarts when that environment changes.
2. Otherwise **Python: Default Interpreter Path** in settings (same folder as that interpreter’s `python` / `python.exe`).
3. Otherwise `zuban` on your `PATH`.

If the Python extension is not installed, only steps 2 and 3 apply.

You can set **ZubanLS: Executable Path** to an absolute path to force a specific `zuban` binary.

## Documentation

Go to https://docs.zubanls.com

## Repository

https://github.com/zubanls/vscode-zubanls

Repository for Zuban: https://github.com/zubanls/zuban/
