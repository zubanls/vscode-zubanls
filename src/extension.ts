import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { PythonExtension } from '@vscode/python-extension';
import { LanguageClient, LanguageClientOptions } from 'vscode-languageclient/node';

const outputChannel = vscode.window.createOutputChannel('ZubanLS');
let client: LanguageClient | undefined;
const clientOptions: LanguageClientOptions = {
  documentSelector: [
    { scheme: 'file', language: 'python' },
    { scheme: 'vscode-notebook-cell', language: 'python' },
  ],
  outputChannel,
};

let pythonApi: Awaited<ReturnType<typeof PythonExtension.api>> | undefined;

async function ensurePythonApi(): Promise<void> {
  if (pythonApi) {
    return;
  }
  try {
    pythonApi = await PythonExtension.api();
    await pythonApi.ready;
  } catch {
    pythonApi = undefined;
  }
}

async function resolveServerOptions(): Promise<string> {
  const zubanBin = process.platform === 'win32' ? 'zuban.exe' : 'zuban';

  // Step 1: Check the zubanls.executablePath
  const r =
    vscode.window.activeTextEditor?.document.uri ?? vscode.workspace.workspaceFolders?.[0]?.uri;
  const ex = vscode.workspace.getConfiguration('zubanls', r).get<string>('executablePath')?.trim();
  if (ex) {
    if (fs.existsSync(ex)) {
      return ex;
    }
    vscode.window.showWarningMessage(`ZubanLS executable not found at zubanls.executablePath=${ex}`);
  }

  // Step 2: Search in the Python extension's environment
  await ensurePythonApi();
  if (pythonApi) {
    try {
      const ep = pythonApi.environments.getActiveEnvironmentPath(r);
      const resolved = await pythonApi.environments.resolveEnvironment(ep);
      const dirs: string[] = [];
      if (resolved?.executable.uri?.fsPath) {
        dirs.push(path.dirname(resolved.executable.uri.fsPath));
      }
      if (ep.path) {
        dirs.push(path.join(ep.path, process.platform === 'win32' ? 'Scripts' : 'bin'));
      }
      for (const d of dirs) {
        const full = path.join(d, zubanBin);
        if (fs.existsSync(full)) {
          return full;
        }
      }
    } catch {
      /* use settings / PATH */
    }
  }

  // Step 3: Search in the python.defaultInterpreterPath
  const py = vscode.workspace.getConfiguration('python', r).get<string>('defaultInterpreterPath')?.trim();
  if (py) {
    const full = path.join(path.dirname(py), zubanBin);
    if (fs.existsSync(full)) {
      return full;
    }
  }

  // Step 4: Rely on PATH
  return 'zuban';
}

async function start(): Promise<void> {
  if (client) {
    await client.stop();
  }
  const command = await resolveServerOptions();
  outputChannel.appendLine(`Zuban: ${command}`);
  client = new LanguageClient('zuban', 'Zuban', { command, args: ['server'] }, clientOptions);
  try {
    await client.start();
  } catch (e) {
    vscode.window.showErrorMessage(`Failed to start ZubanLS: ${e instanceof Error ? e.message : e}`);
    client = undefined;
  }
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  await start();
  if (pythonApi) {
    context.subscriptions.push(
      pythonApi.environments.onDidChangeActiveEnvironmentPath(() => {
        void start();
      }),
    );
  }
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('zubanls') || e.affectsConfiguration('python')) {
        void start();
      }
    }),
    outputChannel,
  );
}

export function deactivate(): Thenable<void> | undefined {
  return client?.stop();
}
