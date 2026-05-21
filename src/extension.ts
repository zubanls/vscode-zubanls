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

async function resolveServerOptions(): Promise<{ command: string; args: string[] }> {
  const r =
    vscode.window.activeTextEditor?.document.uri ?? vscode.workspace.workspaceFolders?.[0]?.uri;
  const ex = vscode.workspace.getConfiguration('zubanls', r).get<string>('executablePath')?.trim();
  if (ex) {
    return { command: ex, args: ['server'] };
  }

  const zubanBin = process.platform === 'win32' ? 'zuban.exe' : 'zuban';
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
          return { command: full, args: ['server'] };
        }
      }
    } catch {
      /* use settings / PATH */
    }
  }

  const py = vscode.workspace.getConfiguration('python', r).get<string>('defaultInterpreterPath')?.trim();
  if (py) {
    const full = path.join(path.dirname(py), zubanBin);
    if (fs.existsSync(full)) {
      return { command: full, args: ['server'] };
    }
  }
  return { command: 'zuban', args: ['server'] };
}

async function start(): Promise<void> {
  if (client) {
    await client.stop();
  }
  const opts = await resolveServerOptions();
  outputChannel.appendLine(`Zuban: ${opts.command}`);
  client = new LanguageClient('zuban', 'Zuban', opts, clientOptions);
  await client.start();
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
