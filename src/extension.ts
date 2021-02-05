import * as vscode from 'vscode';
import { SetupToolsTaskProvider } from './setupToolsTaskProvider';
import { DjangoTaskProvider } from './djangoTaskProvider';

let setupToolsProvider: vscode.Disposable | undefined;
let djangoProvider: vscode.Disposable | undefined;

export function activate(_context: vscode.ExtensionContext): void {
	const workspaceRoots = vscode.workspace.workspaceFolders;
	if (!workspaceRoots) {
		return;
	}

	setupToolsProvider = vscode.tasks.registerTaskProvider(SetupToolsTaskProvider.SetupToolsType, new SetupToolsTaskProvider());
	djangoProvider = vscode.tasks.registerTaskProvider(DjangoTaskProvider.DjangoType, new DjangoTaskProvider());
}

export function deactivate(): void {
	if (setupToolsProvider) {
		setupToolsProvider.dispose();
	}
	if (djangoProvider) {
		djangoProvider.dispose();
	}
}