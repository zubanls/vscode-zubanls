# Development

## Publish a Release

1. Install

npm install -g @vscode/vsce

Or run with

npx @vscode/vsce@latest

2. Upgrade the version in `package.json`.

3. Run the following code


```
vsce package
vsce publish
npx ovsx publish
```

for ovsx you might additionally need to install the correct node version:

nvm install 20
nvm use 20

## Test the release locally in VSCode

code --install-extension zubanls-x.x.x.vsix

## Run the extension from source (F5)

1. `npm install` and `npm run compile` (or `npm run watch` in a terminal).
2. Open this folder in VS Code / Cursor and run **Run Extension** from the Run
   and Debug view.
3. In the Extension Development Host window, open a Python workspace where
   `zuban` is installed in the same `venv` as the selected interpreter; open
   **View → Output → ZubanLS** and confirm the `Zuban: …` line points at the
   binary you expect.
4. If you make changes (and `npm run watch` is running) you can reload the
   extension development host (Ctrl+R).
