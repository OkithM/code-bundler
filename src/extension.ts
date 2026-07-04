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
                    // Get path relative to the inside of the lib folder
                    const relativePath = path.relative(libFolder, fullPath).replace(/\\/g, '/');
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    
                    // Format: //path followed by code
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

                // 1. Create/Overwrite the bundle file at the project root
                fs.writeFileSync(bundleFilePath, mergedOutput, 'utf-8');

                // 2. Handle adding the file to .gitignore
                const gitignorePath = path.join(projectRoot, '.gitignore');
                
                if (fs.existsSync(gitignorePath)) {
                    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
                    const lines = gitignoreContent.split(/\r?\n/);
                    
                    // Check if the file is already listed in .gitignore to avoid duplicates
                    const isAlreadyIgnored = lines.some(line => line.trim() === bundleFileName);
                    
                    if (!isAlreadyIgnored) {
                        // Ensure clean spacing when appending to the end of the file
                        const appendPrefix = gitignoreContent.endsWith('\n') ? '' : '\n';
                        fs.appendFileSync(gitignorePath, `${appendPrefix}${bundleFileName}\n`, 'utf-8');
                    }
                } else {
                    // Create a new .gitignore if it doesn't exist
                    fs.writeFileSync(gitignorePath, `${bundleFileName}\n`, 'utf-8');
                }

                vscode.window.showInformationMessage(`"${bundleFileName}" created at root and added to .gitignore!`);
            });
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to create bundle file: ${error.message}`);
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}