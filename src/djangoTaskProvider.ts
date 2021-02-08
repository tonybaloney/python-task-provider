import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import * as vscode from 'vscode';

export class DjangoTaskProvider implements vscode.TaskProvider {
	static DjangoType = 'django';
	private djangoPromise: Thenable<vscode.Task[]> | undefined = undefined;

	constructor() {
        if (!vscode.workspace.workspaceFolders) {
            return;
        }
        vscode.workspace.workspaceFolders.forEach(workspaceRoot => {
            const pattern = path.join(workspaceRoot.uri.fsPath, 'manage.py');
            const fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
            fileWatcher.onDidChange(() => this.djangoPromise = undefined);
            fileWatcher.onDidCreate(() => this.djangoPromise = undefined);
            fileWatcher.onDidDelete(() => this.djangoPromise = undefined);
        });
	}

	public provideTasks(): Thenable<vscode.Task[]> | undefined {
		if (!this.djangoPromise) {
			this.djangoPromise = getDjangoTasks();
		}
		return this.djangoPromise;
	}

	public resolveTask(_task: vscode.Task): vscode.Task | undefined {
		const task = _task.definition.task;
        var pythonPath = vscode.workspace.getConfiguration('python').get('pythonPath');
        if (!pythonPath){
            pythonPath = 'python';
        }
		if (task) {
			// resolveTask requires that the same definition object be used.
			const definition: DjangoTaskDefinition = <any>_task.definition;
			return new vscode.Task(definition, _task.scope ?? vscode.TaskScope.Workspace, definition.task, 'django', new vscode.ShellExecution(`${pythonPath} ${definition.task}`));
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
		_channel = vscode.window.createOutputChannel('Django Auto Detection');
	}
	return _channel;
}

interface DjangoTaskDefinition extends vscode.TaskDefinition {
	/**
	 * The task name
	 */
	task: string;

	/**
	 * The python file containing the task
	 */
	file?: string;
}

function isBuildTask(name: string): boolean {
	return false;
}

function isTestTask(name: string): boolean {
	return false;
}

async function getDjangoTasks(): Promise<vscode.Task[]> {
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
		const managePyFile = path.join(folderString, 'manage.py');
		if (!await exists(managePyFile)) {
			continue;
		}
        var pythonPath = vscode.workspace.getConfiguration('python').get('pythonPath');
        if (!pythonPath){
            pythonPath = 'python';
        }
        const commandLine = `${pythonPath} manage.py help`;
        var isCommandList = false;
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
						continue;
                    }
                    if (line.startsWith("Available subcommands:")) {
                        isCommandList = true;
                        continue;
                    }
                    if (isCommandList) {
						const taskName = line.trim().split(" ")[0];
						if (taskName.startsWith("[")) {
							continue;
						}
						const kind: DjangoTaskDefinition = {
							type: 'django',
							task: taskName
						};
						const task = new vscode.Task(kind, workspaceFolder, taskName, 'django', new vscode.ShellExecution(`${pythonPath} manage.py ${taskName}`));
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
			channel.appendLine('Auto detecting manage.py commands failed.');
			channel.show(true);
		}
	}
	return result;
}