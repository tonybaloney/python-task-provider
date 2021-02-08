import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import * as vscode from 'vscode';

export class PyProjectTaskProvider implements vscode.TaskProvider {
	static PoetryType = 'poetry';
	static FlitType = 'flit';
	private pyprojectPromise: Thenable<vscode.Task[]> | undefined = undefined;
	private buildType: string = 'undefined';

	constructor(type: string) {
        if (!vscode.workspace.workspaceFolders) {
            return;
        }
		this.buildType = type;
        vscode.workspace.workspaceFolders.forEach(workspaceRoot => {
            const pattern = path.join(workspaceRoot.uri.fsPath, 'pyproject.toml');
            const fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
            fileWatcher.onDidChange(() => this.pyprojectPromise = undefined);
            fileWatcher.onDidCreate(() => this.pyprojectPromise = undefined);
            fileWatcher.onDidDelete(() => this.pyprojectPromise = undefined);
        });
	}

	public provideTasks(): Thenable<vscode.Task[]> | undefined {
		if (!this.pyprojectPromise) {
			this.pyprojectPromise = getTasks(this.buildType);
		}
		return this.pyprojectPromise;
	}

	public resolveTask(_task: vscode.Task): vscode.Task | undefined {
		const task = _task.definition.task;
        var pythonPath = vscode.workspace.getConfiguration('python').get('pythonPath');
        if (!pythonPath){
            pythonPath = 'python';
        }
		if (task) {
			// resolveTask requires that the same definition object be used.
			const definition: PyProjectTaskDefinition = <any>_task.definition;
			const args = definition.args ? definition.args.join(' ') : ''; 
			return new vscode.Task(definition, _task.scope ?? vscode.TaskScope.Workspace, definition.task, definition.type, new vscode.ShellExecution(`${pythonPath} -m ${definition.type} ${definition.task} ${args}`));
		}
		return undefined;
	}
}

function exists(file: string): Promise<boolean> {
	return new Promise<boolean>((resolve, _reject) => {
		fs.exists(file, (value) => {
			resolve(value);
		});
	});
}

function exec(command: string, options: cp.ExecOptions): Promise<{ stdout: string; stderr: string }> {
	return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
		cp.exec(command, options, (error, stdout, stderr) => {
			if (error) {
				reject({ error, stdout, stderr });
			}
			resolve({ stdout, stderr });
		});
	});
}

let _channel: vscode.OutputChannel;
function getOutputChannel(): vscode.OutputChannel {
	if (!_channel) {
		_channel = vscode.window.createOutputChannel('Pyproject.toml Auto Detection');
	}
	return _channel;
}

interface PyProjectTaskDefinition extends vscode.TaskDefinition {
	/**
	 * The task name
	 */
	task: string;

	/**
	 * Optional arguments to the task
	 */
	args?: string[];
}

function getBuiltinTasks(type: string): Array<string> {
	if (type === "flit") {
		return ["build", "publish", "install", "init"];
	} else if (type === "poetry") {
		return ["new", "init", "install", "update", "add", "remove", "show", "build", "publish", "config", "run", 
	"shell", "check", "search", "lock", "version", "export", "env", "cache"];
	} else {
		return [];
	}
}

async function getTasks(buildType: string): Promise<vscode.Task[]> {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	const result: vscode.Task[] = [];
	if (!workspaceFolders || workspaceFolders.length === 0) {
		return result;
	}
	for (const workspaceFolder of workspaceFolders) {
		const folderString = workspaceFolder.uri.fsPath;
		if (!folderString) {
			continue;
		}
		const pyprojectTomlFile = path.join(folderString, 'pyproject.toml');
		if (!await exists(pyprojectTomlFile)) {
			continue;
		}
        var pythonPath = vscode.workspace.getConfiguration('python').get('pythonPath');
        if (!pythonPath){
            pythonPath = 'python';
        }
		try {
			vscode.workspace.openTextDocument(path.join(folderString, 'pyproject.toml')).then((document) => {
				let text = document.getText();
				if (text && text.search(`\\[tool\\.${buildType}`) !== -1) {
					getBuiltinTasks(buildType).forEach(taskName => {
						const kind: PyProjectTaskDefinition = {
							type: buildType,
							task: taskName
						};
						const task = new vscode.Task(kind, workspaceFolder, taskName, buildType, new vscode.ShellExecution(`${pythonPath} -m ${buildType} ${taskName}`));
						result.push(task);

						if (taskName === "build") {
							task.group = vscode.TaskGroup.Build;
						}
					});
				}
			});
		} catch (err) {
			const channel = getOutputChannel();
			if (err.stderr) {
				channel.appendLine(err.stderr);
			}
			if (err.stdout) {
				channel.appendLine(err.stdout);
			}
			channel.appendLine('Auto detecting pyproject.toml commands failed.');
			channel.show(true);
		}

	}
	return result;
}