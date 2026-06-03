/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

import {ExtensionContext, workspace} from 'vscode';
import * as vscode from 'vscode';
import {
  CancellationToken,
  ConfigurationItem,
  ConfigurationParams,
  ConfigurationRequest,
  LanguageClient,
  LanguageClientOptions,
  LSPAny,
  ResponseError,
  ServerOptions,
} from 'vscode-languageclient/node';
import {PythonEnvironment} from './python-environment';
import {
  triggerMsPythonRefreshLanguageServersIfInstalled,
} from './extension-interop';

let client: LanguageClient;
let outputChannel: vscode.OutputChannel;
let traceOutputChannel: vscode.OutputChannel;

/// Get a setting at the path, or throw an error if it's not set.
function requireSetting<T>(path: string): T {
  const ret: T | undefined = vscode.workspace.getConfiguration().get(path);
  if (ret == undefined) {
    throw new Error(`Setting "${path}" was not configured`);
  }
  return ret;
}

/**
 * This function adds the pythonPath to any section with configuration of 'python'.
 * Our language server expects the pythonPath from VSCode configurations but this setting is not stored in VSCode
 * configurations. The Python extension used to store pythonPath in this section but no longer does. Details:
 * https://github.com/microsoft/pyright/commit/863721687bc85a54880423791c79969778b19a3f
 *
 * Example:
 * - Pyrefly asks for a configurationItem for {scopeUri: '/home/project', section: 'python'}
 * - VSCode returns a configuration of {setting: 'value'} from settings.json
 * - This function will add pythonPath: '/usr/bin/python3' from the Python extension to the configuration
 * - {setting: 'value', pythonPath: '/usr/bin/python3'} is returned
 */
async function overridePythonPath(
  pythonEnv: PythonEnvironment,
  configurationItems: ConfigurationItem[],
  configuration: (object | null)[],
): Promise<(object | null)[]> {
  const newResult = await Promise.all(
    configuration.map(async (item, index) => {
      if (
        configurationItems.length <= index ||
        configurationItems[index].section !== 'python'
      ) {
        return item;
      }
      const scopeUri = configurationItems[index].scopeUri;
      const pythonPath = await pythonEnv.getInterpreterPath(
        scopeUri === undefined ? undefined : vscode.Uri.parse(scopeUri),
      );
      if (pythonPath === undefined) {
        return item;
      }
      return {...item, pythonPath};
    }),
  );
  return newResult;
}

export async function activate(context: ExtensionContext) {
  // Initialize the output channel if it doesn't exist
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel(
      'Zuban language server',
    );
  }

  // Initialize the trace output channel for separate trace logs
  if (!traceOutputChannel) {
    traceOutputChannel = vscode.window.createOutputChannel(
      'Zuban language server trace',
    );
  }

  const path: string = requireSetting('zuban.executablePath');

  // process.platform returns win32 on any windows CPU architecture
  const executableName = process.platform === 'win32' ? 'zuban.exe' : 'zuban';
  const bundledZubanPath = vscode.Uri.joinPath(context.extensionUri, 'bin', executableName);

  const pythonEnv = new PythonEnvironment(context);

  // Otherwise to spawn the server
  let serverOptions: ServerOptions = {
    command: path === '' ? bundledZubanPath.fsPath : path,
    args: ["server"],
  };

  // `getConfiguration` returns a `WorkspaceConfiguration` proxy, not a
  // plain object: spread (`{...cfg}`) and `Object.assign({}, cfg)` rely
  // on own enumerable properties and may silently drop the configured
  // values. JSON-roundtrip via the proxy's `toJSON` (the same path
  // `vscode-languageclient` itself takes when serializing
  // `initializationOptions`) gives us a faithful plain object to merge
  // with.
  const initializationOptions = JSON.parse(
    JSON.stringify(vscode.workspace.getConfiguration('zuban') ?? {}),
  );

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    initializationOptions,
    // Register the server for Python documents
    documentSelector: [
      {scheme: 'file', language: 'python'},
      // Support for unsaved/untitled files
      {scheme: 'untitled', language: 'python'},
      // Support for notebook cells
      {scheme: 'vscode-notebook-cell', language: 'python'},
      // Support for in-memory documents like the Positron Console
      {scheme: 'inmemory', language: 'python'},
    ],
    // Support for notebooks
    // @ts-ignore
    notebookDocumentSync: {
      notebookSelector: [
        {
          notebook: {notebookType: 'jupyter-notebook'},
          cells: [{language: 'python'}],
        },
      ],
    },
    outputChannel: outputChannel,
    traceOutputChannel: traceOutputChannel,
    middleware: {
      workspace: {
        configuration: async (
          params: ConfigurationParams,
          token: CancellationToken,
          next: ConfigurationRequest.HandlerSignature,
        ): Promise<LSPAny[] | ResponseError<void>> => {
          const result = await next(params, token);
          if (result instanceof ResponseError) {
            return result;
          }
          return await overridePythonPath(
            pythonEnv,
            params.items,
            result as (object | null)[],
          );
        },
      },
    },
  };

  function newClient() {
    return new LanguageClient(
      'zuban',
      'Zuban',
      serverOptions,
      clientOptions,
    )
  }

  async function restartClient(clearChannels: boolean = false) {
    await client.stop();
    if (clearChannels) {
      // Clear the output channel but don't dispose it
      outputChannel.clear();
      traceOutputChannel.clear();
    }
    client = newClient();
    await client.start();
  }

  // Create the language client and start the client.
  client = newClient();

  pythonEnv
    .onDidChangeInterpreter(async () => {
      await restartClient();
    })
    .then(disposable => {
      if (disposable) {
        context.subscriptions.push(disposable);
      }
    });

  context.subscriptions.push(
    workspace.onDidChangeConfiguration(async event => {
      if (event.affectsConfiguration('python.zuban')) {
        await restartClient();
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('zuban.restart', async () => {
        await restartClient(true);
    }),
  );

  // When our extension is activated, make sure ms-python knows
  // TODO(kylei): remove this hack once ms-python has this behavior
  await triggerMsPythonRefreshLanguageServersIfInstalled();

  vscode.workspace.onDidChangeConfiguration(async e => {
    if (e.affectsConfiguration(`python.zuban.disableLanguageServices`)) {
      // TODO(kylei): remove this hack once ms-python has this behavior
      await triggerMsPythonRefreshLanguageServersIfInstalled();
    }
  });

  // Start the client. This will also launch the server
  await client.start();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  // Dispose the output channels when the extension is deactivated
  if (outputChannel) {
    outputChannel.dispose();
  }
  if (traceOutputChannel) {
    traceOutputChannel.dispose();
  }
  return client.stop();
}
