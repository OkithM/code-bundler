import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('gemini-bundler.bundleProject', async (uri: vscode.Uri) => {
        // Find the workspace root folder
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri || vscode.window.activeTextEditor?.document.uri);
        
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('Please open a Flutter project workspace first.');
            return;
        }

        const projectRoot = workspaceFolder.uri.fsPath;
        const libFolder = path.join(projectRoot, 'lib');

        // Safety check to ensure a lib folder actually exists
        if (!fs.existsSync(libFolder)) {
            vscode.window.showErrorMessage('Could not find a "lib" folder in this project root.');
            return;
        }

        let mergedOutput = '';

        // Recursively look through only the lib folder
        function traverseLib(currentDir: string) {
            const items = fs.readdirSync(currentDir);

            for (const item of items) {
                const fullPath = path.join(currentDir, item);
                const stat = fs.statSync(fullPath);

                if (stat.isDirectory()) {
                    traverseLib(fullPath);
                } else if (stat.isFile()) {
                    // Get path relative to the inside of the lib folder (e.g., "main.dart" or "pages/home.dart")
                    const relativePath = path.relative(libFolder, fullPath).replace(/\\/g, '/');
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    
                    // Format exactly as requested: //path followed by code
                    mergedOutput += `//${relativePath}\n${content}\n\n`;
                }
            }
        }

        try {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Bundling lib/ folder for Gemini...",
                cancellable: false
            }, async () => {
                traverseLib(libFolder);
                
                if (mergedOutput.trim() === '') {
                    vscode.window.showWarningMessage('The "lib" folder appears to be empty.');
                    return;
                }

                // Copy the final bundled text to your clipboard
                await vscode.env.clipboard.writeText(mergedOutput);
                vscode.window.showInformationMessage('All lib/ files merged and copied to clipboard!');
            });
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to bundle lib folder: ${error.message}`);
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}