import * as vscode from 'vscode';
import { MemoDirectoryResolver } from './memo-directory-resolver';
import { MemoFileService } from './memo-file-service';
import { MemoSearchQuickPick } from './memo-search-quick-pick';
import { MemoSearchResultsProvider } from './memo-search-results-provider';
import type { MemoEntry } from './memo-types';
import { RipgrepContentSearch } from './ripgrep-content-search';

export function activate(context: vscode.ExtensionContext): void {
  const directoryResolver = new MemoDirectoryResolver();
  const memoFiles = new MemoFileService();
  const contentSearch = new RipgrepContentSearch();
  const searchResults = new MemoSearchResultsProvider();
  const searchResultsView = vscode.window.createTreeView<MemoEntry>('piste.searchResults', {
    treeDataProvider: searchResults,
  });

  const openTodayMemo = vscode.commands.registerCommand(
    'piste.openToday',
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

  const searchMemos = vscode.commands.registerCommand('piste.search', async () => {
    const directory = await directoryResolver.resolve();
    if (directory) {
      await showSearchResultsView();
      new MemoSearchQuickPick(contentSearch, searchResults, searchResultsView).show(directory);
    }
  });

  const clearSearchResults = vscode.commands.registerCommand(
    'piste.clearSearchResults',
    async () => {
      searchResults.clear();
      searchResultsView.message = undefined;
      await vscode.commands.executeCommand('setContext', 'piste.hasSearchResults', false);
    },
  );

  const openSearchResult = vscode.commands.registerCommand(
    'piste.openSearchResult',
    async (entry: MemoEntry) => openMemo(vscode.Uri.file(entry.filePath), entry.lineNumber),
  );

  const openMemoByDate = vscode.commands.registerCommand('piste.openByDate', async () => {
    const directory = await directoryResolver.resolve();
    if (!directory) {
      return;
    }

    const date = await requestMemoDate();
    if (date === undefined) {
      return;
    }

    const suffix = await requestMemoSuffix();
    if (suffix === undefined) {
      return;
    }

    const memoUri = await memoFiles.getOrCreate(directory, date, suffix);
    await openMemo(memoUri);
  });

  context.subscriptions.push(
    openTodayMemo,
    openMemoByDate,
    searchMemos,
    clearSearchResults,
    openSearchResult,
    searchResultsView,
  );
}

async function showSearchResultsView(): Promise<void> {
  await vscode.commands.executeCommand('setContext', 'piste.hasSearchResults', true);
  await vscode.commands.executeCommand('workbench.view.explorer');
}

async function requestMemoSuffix(): Promise<string | undefined> {
  return vscode.window.showInputBox({
    prompt: vscode.l10n.t('Enter an optional name for this memo'),
    placeHolder: vscode.l10n.t('Example: review'),
  });
}

async function requestMemoDate(): Promise<string | undefined> {
  const value = await vscode.window.showInputBox({
    prompt: vscode.l10n.t('Enter a date in YYYY-MM-DD format'),
    placeHolder: vscode.l10n.t('Example: 2026-08-28'),
    value: formatLocalDate(new Date()),
    validateInput: (value) => isValidDate(value.trim())
      ? undefined
      : vscode.l10n.t('Enter a real date in YYYY-MM-DD format.'),
  });

  return value?.trim();
}

async function openMemo(uri: vscode.Uri, lineNumber?: number): Promise<void> {
  const document = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(document);

  if (lineNumber !== undefined) {
    const position = new vscode.Position(Math.max(lineNumber - 1, 0), 0);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
  }
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day;
}

export function deactivate(): void {}
