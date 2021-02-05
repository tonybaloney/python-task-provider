import * as vscode from 'vscode';
import { SetupToolsTaskProvider } from './setupToolsTaskProvider';

let setupToolsProvider: vscode.Disposable | undefined;

export function activate(_context: vscode.ExtensionContext): void {
	const workspaceRoots = vscode.workspace.workspaceFolders;
	if (!workspaceRoots) {
		return;
	}
	
	setupToolsProvider = vscode.tasks.registerTaskProvider(SetupToolsTaskProvider.SetupToolsType, new SetupToolsTaskProvider());

}

export function deactivate(): void {
	if (setupToolsProvider) {
		setupToolsProvider.dispose();
	}
}