# Development

## Publish a Release

1. Install

npm install -g @vscode/vsce

2. Upgrade the version in `package.json`.

3. Run the following code

```
vsce package
vsce publish
npx ovsx publish
```
