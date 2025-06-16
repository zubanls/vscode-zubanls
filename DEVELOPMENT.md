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

for ovsx you might additionally need to install the correct node version:

nvm install 20
nvm use 20
