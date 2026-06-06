/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

import * as vscode from "vscode";
import type { LanguageClient } from "vscode-languageclient/node";
import { outputChannel } from "./extension";

let statusBarItem: vscode.StatusBarItem;

/* Shape of `zuban/textDocument/status` */
type Status = {
    version: number;
    zubanVersion: string;
    zubanPath: string;
    typeCheckingEnabled: boolean;
    fileErrorsIgnoredReason: string | null;
    mode: string;
};

/// Update the status bar based on current configuration
export async function updateStatusBar(client: LanguageClient) {
    const document = vscode.window.activeTextEditor?.document;
    if (document == null || document.languageId !== "python") {
        statusBarItem?.hide();
        return;
    }
    let status: Status;
    try {
        // The server only reads `uri` from the payload (deserializes as
        // `TextDocumentIdentifier`), so send just that — no need to ship
        // the file text on every status-bar refresh.
        status = await client.sendRequest(
            "zuban/textDocument/status",
            client.code2ProtocolConverter.asTextDocumentIdentifier(document),
        );
    } catch (e) {
        outputChannel.appendLine(`Tried to fetch the document status but got ${e}`);
        statusBarItem?.hide();
        return;
    }

    if (!statusBarItem) {
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        statusBarItem.name = "Zuban";
    }

    // Currently only version 1 is supported, future versions might not be.
    if (status.version !== 1) {
        statusBarItem.hide();
        return;
    }

    let mode: string;
    let modeNode: string;
    if (!status.typeCheckingEnabled) {
        mode = "off";
        modeNode =
            'Zuban **diagnostics** are **suppressed** because [`python.zuban.typeCheckingMode`](command:workbench.action.openSettings?["python.zuban.typeCheckingMode"]). Change this setting to re-enable diagnostics.';
    } else if (status.fileErrorsIgnoredReason !== null) {
        mode = "excluded";
        modeNode = `Zuban **diagnostics** are **suppressed** in this specific file. ${status.fileErrorsIgnoredReason}. Change this setting to re-enable diagnostics.`;
    } else {
        mode = status.mode;
        modeNode = `The current Zuban [mode](https://docs.zubanls.com/en/latest/usage.html#modes) is **${mode}**.`;
    }
    statusBarItem.text = `Zuban: ${mode}`;

    const tooltip = `
### Zuban

- [Docs](https://docs.zubanls.com/)
- [VSCode Settings](command:workbench.action.openSettings?["@ext:zubanls.zuban"])
- [Website](https://zubanls.com)
- Zuban version: ${status.zubanVersion}
- Zuban executable path: ${status.zubanPath}

---

${modeNode}
`;

    const md = new vscode.MarkdownString(tooltip);
    // The kill-switch and IDE-override tooltips embed
    // `command:workbench.action.openSettings?["<setting-id>"]` links so
    // clicking the setting name jumps the user straight into the
    // Settings UI. `MarkdownString` rejects `command:` URIs unless
    // `isTrusted` allow-lists them — narrow the allow-list to just the
    // one command we use rather than blanket-trusting everything.
    md.isTrusted = { enabledCommands: ["workbench.action.openSettings"] };

    statusBarItem.tooltip = md;

    statusBarItem.show();
}

export function getStatusBarItem(): vscode.StatusBarItem {
    return statusBarItem;
}
