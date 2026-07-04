import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process'; // Imported to run native system commands

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('gemini-bundler.bundleProject', async (uri: vscode.Uri) => {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri || vscode.window.activeTextEditor?.document.uri);

        if (!workspaceFolder) {
            vscode.window.showErrorMessage('Please open a Flutter project workspace first.');
            return;
        }

        const projectRoot = workspaceFolder.uri.fsPath;
        const libFolder = path.join(projectRoot, 'lib');

        if (!fs.existsSync(libFolder)) {
            vscode.window.showErrorMessage('Could not find a "lib" folder in this project root.');
            return;
        }

        let mergedOutput = '';

        function traverseLib(currentDir: string) {
            const items = fs.readdirSync(currentDir);

            for (const item of items) {
                const fullPath = path.join(currentDir, item);
                const stat = fs.statSync(fullPath);

                if (stat.isDirectory()) {
                    traverseLib(fullPath);
                } else if (stat.isFile()) {
                    const relativePath = path.relative(libFolder, fullPath).replace(/\\/g, '/');
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    mergedOutput += `//${relativePath}\n${content}\n\n`;
                }
            }
        }

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Creating Gemini bundle file...",
                cancellable: false
            }, async () => {
                traverseLib(libFolder);

                if (mergedOutput.trim() === '') {
                    vscode.window.showWarningMessage('The "lib" folder appears to be empty.');
                    return;
                }

                const bundleFileName = 'gemini_bundle.txt';
                const bundleFilePath = path.join(projectRoot, bundleFileName);

                // 1. Save file locally to project root
                fs.writeFileSync(bundleFilePath, mergedOutput, 'utf-8');

                // 2. Add to .gitignore if not already listed
                const gitignorePath = path.join(projectRoot, '.gitignore');
                if (fs.existsSync(gitignorePath)) {
                    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
                    const lines = gitignoreContent.split(/\r?\n/);
                    const isAlreadyIgnored = lines.some(line => line.trim() === bundleFileName);

                    if (!isAlreadyIgnored) {
                        const appendPrefix = gitignoreContent.endsWith('\n') ? '' : '\n';
                        fs.appendFileSync(gitignorePath, `${appendPrefix}${bundleFileName}\n`, 'utf-8');
                    }
                } else {
                    fs.writeFileSync(gitignorePath, `${bundleFileName}\n`, 'utf-8');
                }

                // 3. COPY THE PHYSICAL FILE OBJECT TO OS CLIPBOARD
                // Format the file path cleanly with forward slashes to prevent shell escaping quirks
                const safePath = bundleFilePath.replace(/\\/g, '/');
                const platform = process.platform;

                if (platform === 'win32') {
                    // Windows Native Shell Command
                    exec(`powershell -Command "Set-Clipboard -Path '${safePath}'"`, (err) => {
                        if (err) vscode.window.showWarningMessage('File created, but failed to copy file object to clipboard.');
                    });
                } else if (platform === 'darwin') {
                    // macOS Native Shell Command
                    exec(`osascript -e 'set the clipboard to (POSIX file "${safePath}")'`, (err) => {
                        if (err) vscode.window.showWarningMessage('File created, but failed to copy file object to clipboard.');
                    });
                }

                vscode.window.showInformationMessage(`"${bundleFileName}" ready! Pressed Ctrl+V in Gemini to upload.`);
            });
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to create bundle file: ${error.message}`);
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() { }