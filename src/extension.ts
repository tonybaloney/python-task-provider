import * as vscode from 'vscode';
import { SetupToolsTaskProvider } from './setupToolsTaskProvider';
import { DjangoTaskProvider } from './djangoTaskProvider';
import { PyProjectTaskProvider } from './pyprojectTaskProvider';

let setupToolsProvider: vscode.Disposable | undefined;
let djangoProvider: vscode.Disposable | undefined;
let flitProvider: vscode.Disposable | undefined;
let poetryProvider: vscode.Disposable | undefined;

export function activate(_context: vscode.ExtensionContext): void {
	const workspaceRoots = vscode.workspace.workspaceFolders;
	if (!workspaceRoots) {
		return;
	}

	setupToolsProvider = vscode.tasks.registerTaskProvider(SetupToolsTaskProvider.SetupToolsType, new SetupToolsTaskProvider());
	djangoProvider = vscode.tasks.registerTaskProvider(DjangoTaskProvider.DjangoType, new DjangoTaskProvider());
	flitProvider = vscode.tasks.registerTaskProvider(PyProjectTaskProvider.PoetryType, new PyProjectTaskProvider(PyProjectTaskProvider.PoetryType));
	poetryProvider = vscode.tasks.registerTaskProvider(PyProjectTaskProvider.FlitType, new PyProjectTaskProvider(PyProjectTaskProvider.FlitType));
}

export function deactivate(): void {
	if (setupToolsProvider) {
		setupToolsProvider.dispose();
	}
	if (djangoProvider) {
		djangoProvider.dispose();
	}
	if (flitProvider) {
		flitProvider.dispose();
	}
	if (poetryProvider) {
		poetryProvider.dispose();
	}
}