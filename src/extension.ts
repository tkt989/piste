import * as vscode from 'vscode';
import { MemoDirectoryResolver } from './memo-directory-resolver';
import { MemoFileService } from './memo-file-service';
import { MemoSearchQuickPick } from './memo-search-quick-pick';
import { RipgrepContentSearch } from './ripgrep-content-search';

export function activate(context: vscode.ExtensionContext): void {
  const directoryResolver = new MemoDirectoryResolver();
  const memoFiles = new MemoFileService();
  const contentSearch = new RipgrepContentSearch();

  const openTodayMemo = vscode.commands.registerCommand(
    'dailyMemo.openToday',
    async () => {
      const directory = await directoryResolver.resolve();
      if (!directory) {
        return;
      }

      const suffix = await requestMemoSuffix();
      if (suffix === undefined) {
        return;
      }

      const memoUri = await memoFiles.getOrCreateToday(directory, suffix);
      await openMemo(memoUri);
    },
  );

  const searchMemos = vscode.commands.registerCommand('dailyMemo.search', async () => {
    const directory = await directoryResolver.resolve();
    if (directory) {
      new MemoSearchQuickPick(contentSearch).show(directory);
    }
  });

  context.subscriptions.push(openTodayMemo, searchMemos);
}

async function requestMemoSuffix(): Promise<string | undefined> {
  return vscode.window.showInputBox({
    prompt: vscode.l10n.t('Enter an optional name for this memo'),
    placeHolder: vscode.l10n.t('Example: review'),
  });
}

async function openMemo(uri: vscode.Uri): Promise<void> {
  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(document);
}

export function deactivate(): void {}
