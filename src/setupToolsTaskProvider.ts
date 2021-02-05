import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import * as vscode from 'vscode';

export class SetupToolsTaskProvider implements vscode.TaskProvider {
	static SetupToolsType = 'setuptools';
	private setuptoolsPromise: Thenable<vscode.Task[]> | undefined = undefined;

	constructor() {
        if (!vscode.workspace.workspaceFolders) {
            return;
        }
        vscode.workspace.workspaceFolders.forEach(workspaceRoot => {
            const pattern = path.join(workspaceRoot.uri.fsPath, 'setup.py');
            const fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
            fileWatcher.onDidChange(() => this.setuptoolsPromise = undefined);
            fileWatcher.onDidCreate(() => this.setuptoolsPromise = undefined);
            fileWatcher.onDidDelete(() => this.setuptoolsPromise = undefined);
        });
	}

	public provideTasks(): Thenable<vscode.Task[]> | undefined {
		if (!this.setuptoolsPromise) {
			this.setuptoolsPromise = getSetupToolsTasks();
		}
		return this.setuptoolsPromise;
	}

	public resolveTask(_task: vscode.Task): vscode.Task | undefined {
		const task = _task.definition.task;

		if (task) {
			// resolveTask requires that the same definition object be used.
			const definition: SetupToolsTaskDefinition = <any>_task.definition;
			return new vscode.Task(definition, _task.scope ?? vscode.TaskScope.Workspace, definition.task, 'setuptools', new vscode.ShellExecution(`python ${definition.task}`));
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
		_channel = vscode.window.createOutputChannel('Setuptools Auto Detection');
	}
	return _channel;
}

interface SetupToolsTaskDefinition extends vscode.TaskDefinition {
	/**
	 * The task name
	 */
	task: string;

	/**
	 * The python file containing the task
	 */
	file?: string;
}

const buildNames: string[] = ['bdist', 'bdist_wheel', 'sdist', 'build'];
function isBuildTask(name: string): boolean {
	for (const buildName of buildNames) {
		if (name.indexOf(buildName) !== -1) {
			return true;
		}
	}
	return false;
}

const testNames: string[] = ['test'];
function isTestTask(name: string): boolean {
	for (const testName of testNames) {
		if (name.indexOf(testName) !== -1) {
			return true;
		}
	}
	return false;
}

async function getSetupToolsTasks(): Promise<vscode.Task[]> {
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
		const setupPyFile = path.join(folderString, 'setup.py');
		if (!await exists(setupPyFile)) {
			continue;
		}
        var pythonPath = vscode.workspace.getConfiguration('python').get('pythonPath');
        if (!pythonPath){
            pythonPath = 'python';
        }
        const commandLine = `${pythonPath} setup.py --help-commands`;
        var isStandardCommands = false;
        var isExtraCommands = false;
		try {
			const { stdout, stderr } = await exec(commandLine, { cwd: folderString });
			if (stderr && stderr.length > 0) {
				getOutputChannel().appendLine(stderr);
				getOutputChannel().show(true);
			}
			if (stdout) {
				const lines = stdout.split(/\r{0,1}\n/);
				for (const line of lines) {
					if (line.length === 0) {
                        isStandardCommands = false;
                        isExtraCommands = false;
						continue;
                    }
                    if (line.startsWith("Standard commands:")){
                        isStandardCommands = true;
                        continue;
                    }
                    if (line.startsWith("Extra commands:")){
                        isExtraCommands = true;
                        continue;
                    }
                    if (isStandardCommands || isExtraCommands){
						const taskName = line.trim().split(" ")[0];
						const kind: SetupToolsTaskDefinition = {
							type: 'setuptools',
							task: taskName
						};
						const task = new vscode.Task(kind, workspaceFolder, taskName, 'setuptools', new vscode.ShellExecution(`${pythonPath} setup.py ${taskName}`));
						result.push(task);
						const lowerCaseLine = line.toLowerCase();
						if (isBuildTask(lowerCaseLine)) {
							task.group = vscode.TaskGroup.Build;
						} else if (isTestTask(lowerCaseLine)) {
							task.group = vscode.TaskGroup.Test;
						}
					}
				}
			}
		} catch (err) {
			const channel = getOutputChannel();
			if (err.stderr) {
				channel.appendLine(err.stderr);
			}
			if (err.stdout) {
				channel.appendLine(err.stdout);
			}
			channel.appendLine('Auto detecting setup.py commands failed.');
			channel.show(true);
		}
	}
	return result;
}