'use strict';

import * as vscode from 'vscode';
import fetch from "node-fetch";
import { posix } from 'path';
import * as fs from 'fs';
const config = vscode.workspace.getConfiguration('referenCite');

export function activate(context: vscode.ExtensionContext) {

	console.log('ReferenCite activated.');

	context.subscriptions.push(vscode.commands.registerCommand('referenCite/zoteroPicker', async _ => {
		await showZoteroPicker();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('referenCite/zoteroBibtex', async _ => {
		await api(generateFormatedCaywUrl())
			.then((result) => {
				console.log(result);
				if (!result) return;
				const fileUri = generatePath(config.bibtexFile);
				if (!fileUri) return;
				const writeData = Buffer.from(result, 'utf8');
				fs.promises.appendFile(fileUri.path, writeData).catch((err) => {
					const msg = `ReferenCite: could not write to ${fileUri.path}. ${err.message}.`;
					console.log(msg);
					return vscode.window.showErrorMessage(msg);
				}).finally(() => {
					const opened = vscode.workspace.textDocuments.find((value) => value.uri.path == fileUri.path);
					if (opened) {
						const subscription = vscode.workspace.onDidChangeTextDocument((e) => {
							if (e.document.fileName == generatePath(config.bibtexFile)?.fsPath) {
								showZoteroPickerBibtex(e.document.uri, e.contentChanges[0].text.split('\n').length);
								subscription.dispose();
							}
						});
					}
					else {
						showZoteroPickerBibtex(fileUri, result.split('\n').length);
					}
				});
			})
			.catch(err => {
				console.log('ReferenCite: Failed to fetch BibTeX entry. %j', err.message);
				return vscode.window.showErrorMessage('ReferenCite: Failed to fetch BibTeX entry. Ensure Zotero is running.');
			});
	}));

	const showZoteroPickerBibtex = async (fileUri: vscode.Uri, entryLinesCount: number) => {
		vscode.workspace.openTextDocument(fileUri).then((doc: vscode.TextDocument) => {
			vscode.window.showTextDocument(doc, 1, false).then(editor => {
				const position = new vscode.Position(doc.lineCount - entryLinesCount + 1, 0);
				editor.selection = new vscode.Selection(position, position);
				const range = new vscode.Range(position, position);
				editor.revealRange(range);
			});
		}, (err: any) => {
			console.log('ReferenCite: Failed to open BibTeX file. %j', err.message);
			return vscode.window.showErrorMessage('ReferenCite: Failed to open BibTeX file.');
		});
	};

	const showZoteroPicker = async () => {
		await api(generateFormatedCaywUrl())
			.then((result) => {
				console.log(result);
				if (!result) return;
				const editor = vscode.window.activeTextEditor;
				if (!editor) return;
				editor.edit(
					edit => editor.selections.forEach(
						selection => {
							edit.delete(selection);
							edit.insert(selection.start, result);
						}
					)
				);
			})
			.catch(err => {
				console.log('ReferenCite: Failed to fetch from Zotero. Ensure Zotero is running. %j', err.message);
				return vscode.window.showErrorMessage('ReferenCite: Failed to fetch from Zotero. Ensure Zotero is running.');
			});
	};
}

function generatePath(filename: string): vscode.Uri | undefined {
	if (!vscode.workspace.workspaceFolders) {
		vscode.window.showInformationMessage('No folder or workspace opened.');
		return undefined;
	}
	const folderUri = vscode.workspace.workspaceFolders[0].uri;
	return folderUri.with({ path: posix.join(folderUri.path, filename) });
}

function generateFormatedCaywUrl() {
	const bbUrl = config.betterBibtexCaywUrl;
	if (config.importingContentType == 'bibtex' && config.referencesManager == 'zotero') {
		return `${bbUrl}?format=translate`;
	}
	return `${bbUrl}?format=${config.importingContentType}`;
}

async function api(url: string): Promise<string> {
	return await fetch(url)
		.then(response => {
			if (!response.ok) {
				throw new Error(response.statusText);
			}
			return response.text() as Promise<string>;
		});
}
