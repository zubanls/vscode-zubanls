/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { type ExtensionContext, workspace } from "vscode";
import { LanguageClient, type LanguageClientOptions } from "vscode-languageclient/node";
import { triggerMsPythonRefreshLanguageServersIfInstalled } from "./extension-interop";
import { PythonEnvironment } from "./python-environment";

let client: LanguageClient;
export let outputChannel: vscode.OutputChannel;
let traceOutputChannel: vscode.OutputChannel;

import { getStatusBarItem, updateStatusBar } from "./status-bar";

/// Get a setting at the path, or throw an error if it's not set.
function requireSetting<T>(path: string): T {
    const ret: T | undefined = vscode.workspace.getConfiguration().get(path);
    if (ret === undefined) {
        throw new Error(`Setting "${path}" was not configured`);
    }
    return ret;
}

export async function activate(context: ExtensionContext) {
    // Initialize the output channel if it doesn't exist
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel("Zuban language server");
    }

    // Initialize the trace output channel for separate trace logs
    if (!traceOutputChannel) {
        traceOutputChannel = vscode.window.createOutputChannel("Zuban language server trace");
    }

    const pythonEnv = new PythonEnvironment(context);

    async function newClient() {
        // `getConfiguration` returns a `WorkspaceConfiguration` proxy, not a
        // plain object: spread (`{...cfg}`) and `Object.assign({}, cfg)` rely
        // on own enumerable properties and may silently drop the configured
        // values. JSON-roundtrip via the proxy's `toJSON` (the same path
        // `vscode-languageclient` itself takes when serializing
        // `initializationOptions`) gives us a faithful plain object to merge
        // with.
        const initializationOptions: InitOptions = JSON.parse(
            JSON.stringify(vscode.workspace.getConfiguration("python.zuban") ?? {}),
        );

        const command = await findCommand(pythonEnv, initializationOptions);

        const loggingVerbosity: string = requireSetting("zuban.loggingVerbosity");

        // Options to control the language client
        const clientOptions: LanguageClientOptions = {
            initializationOptions,
            // Register the server for Python documents
            documentSelector: [
                { scheme: "file", language: "python" },
                // Support for unsaved/untitled files
                { scheme: "untitled", language: "python" },
                // Support for notebook cells
                { scheme: "vscode-notebook-cell", language: "python" },
                // Support for in-memory documents like the Positron Console
                { scheme: "inmemory", language: "python" },
            ],
            // Support for notebooks
            // @ts-expect-error
            notebookDocumentSync: {
                notebookSelector: [
                    {
                        notebook: { notebookType: "jupyter-notebook" },
                        cells: [{ language: "python" }],
                    },
                ],
            },
            outputChannel: outputChannel,
            traceOutputChannel: traceOutputChannel,
        };

        return new LanguageClient(
            "zuban",
            "Zuban",
            {
                command,
                args: ["server"],
                options: {
                    env: {
                        ...process.env,
                        ZUBAN_LOG: loggingVerbosity,
                    },
                },
            },
            clientOptions,
        );
    }

    async function restartClient(clearChannels: boolean = false) {
        await client.stop();
        if (clearChannels) {
            // Clear the output channel but don't dispose it
            outputChannel.clear();
            traceOutputChannel.clear();
        }
        client = await newClient();
        await client.start();
        await updateStatusBar(client);
    }

    // Create the language client and start the client.
    client = await newClient();
    await client.start();
    await updateStatusBar(client);

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(async () => {
            await updateStatusBar(client);
        }),
    );

    pythonEnv
        .onDidChangeInterpreter(async () => {
            await restartClient();
        })
        .then((disposable) => {
            if (disposable) {
                context.subscriptions.push(disposable);
            }
        });

    context.subscriptions.push(
        workspace.onDidChangeConfiguration(async (event) => {
            if (event.affectsConfiguration("python.zuban") || event.affectsConfiguration("zuban")) {
                await restartClient();
            }
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("zuban.restart", async () => {
            await restartClient(true);
        }),
    );

    // When our extension is activated, make sure ms-python knows
    // TODO(kylei): remove this hack once ms-python has this behavior
    await triggerMsPythonRefreshLanguageServersIfInstalled();

    vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration(`python.zuban.disableLanguageServices`)) {
            // TODO(kylei): remove this hack once ms-python has this behavior
            await triggerMsPythonRefreshLanguageServersIfInstalled();
        }
    });

    // Start the client. This will also launch the server

    const statusBarItem = getStatusBarItem();
    if (statusBarItem) {
        context.subscriptions.push(statusBarItem);
    }
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

interface InitOptions {
    pythonExecutable?: string;
    typeCheckingMode?: string;
    diagnosticMode?: string;
    disableLanguageServices?: boolean;
}

async function findCommand(
    pythonEnv: PythonEnvironment,
    initializationOptions: InitOptions,
): Promise<string> {
    // process.platform returns win32 on any windows CPU architecture
    const zubanBin = process.platform === "win32" ? "zuban.exe" : "zuban";

    // Step 1: Check the zubanls.executablePath
    const ex: string = requireSetting("zuban.executablePath");
    if (ex) {
        if (fs.existsSync(ex)) {
            return ex;
        }
        vscode.window.showWarningMessage(
            `zuban executable not found at zubanls.executablePath=${ex}`,
        );
    }

    const scopeUri =
        vscode.window.activeTextEditor?.document.uri ?? vscode.workspace.workspaceFolders?.[0]?.uri;

    // Step 2: Search in the Python extension's environment
    const pythonExecutable = await pythonEnv.getInterpreterPath(scopeUri);
    if (pythonExecutable) {
        outputChannel.appendLine(`Zuban tries to work with environment ${pythonExecutable}`);
        if (fs.existsSync(pythonExecutable)) {
            initializationOptions.pythonExecutable = pythonExecutable;

            // Try to use the Zuban executable from that environment.
            const executableDir = path.dirname(pythonExecutable);
            const zubanPath = path.join(executableDir, zubanBin);
            if (fs.existsSync(zubanPath)) {
                outputChannel.appendLine(`Zuban found a Zuban executable at ${zubanPath}`);
                return zubanPath;
            } else {
                outputChannel.appendLine(
                    `Zuban did not find a Zuban executable at ${zubanPath}, falling back to the default`,
                );
            }
        } else {
            outputChannel.appendLine(`Zuban executable ${pythonExecutable} does not exist`);
        }
    }
    // const bundledZubanPath = vscode.Uri.joinPath(context.extensionUri, 'bin', executableName);
    // return bundledZubanPath.fsPath;

    // Step 3: Rely on PATH
    return zubanBin;
}
