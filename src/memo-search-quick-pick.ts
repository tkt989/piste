import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import * as vscode from 'vscode';
import { MemoSearchResultsProvider } from './memo-search-results-provider';
import type { MemoEntry, MemoQuickPickItem } from './memo-types';
import { RipgrepContentSearch } from './ripgrep-content-search';

const SEARCH_DEBOUNCE_MS = 200;

export class MemoSearchQuickPick {
  constructor(
    private readonly contentSearch: RipgrepContentSearch,
    private readonly resultsProvider: MemoSearchResultsProvider,
    private readonly resultsView: vscode.TreeView<MemoEntry>,
  ) {}

  show(directory: string): void {
    const quickPick = vscode.window.createQuickPick<MemoQuickPickItem>();
    let activeProcess: ChildProcessWithoutNullStreams | undefined;
    let debounceTimer: NodeJS.Timeout | undefined;
    let searchId = 0;
    let disposed = false;
    let currentEntries: MemoEntry[] = [];

    quickPick.title = vscode.l10n.t('Search daily memo contents');
    quickPick.placeholder = vscode.l10n.t('Enter a search term');
    quickPick.matchOnDescription = true;
    quickPick.matchOnDetail = true;
    quickPick.show();

    const search = async (query: string): Promise<void> => {
      const normalizedQuery = query.trim();
      const currentSearchId = ++searchId;
      activeProcess?.kill();
      activeProcess = undefined;

      if (!normalizedQuery) {
        currentEntries = [];
        quickPick.items = [];
        quickPick.busy = false;
        this.resultsProvider.setLoading('');
        this.resultsView.message = this.resultsProvider.message;
        return;
      }

      this.resultsProvider.setLoading(normalizedQuery);
      this.resultsView.message = vscode.l10n.t('Searching "{0}"…', normalizedQuery);
      quickPick.busy = true;

      try {
        const task = this.contentSearch.start(directory, normalizedQuery);
        activeProcess = task.process;
        const entries = await task.result;
        if (!disposed && currentSearchId === searchId) {
          currentEntries = entries;
          this.resultsProvider.setResults(normalizedQuery, entries);
          this.resultsView.message = this.resultsProvider.message;
          quickPick.items = entries.map(toQuickPickItem);
          if (entries[0]) {
            void Promise.resolve(
              this.resultsView.reveal(entries[0], { focus: false, select: true }),
            ).catch(() => undefined);
          }
        }
      } catch {
        if (!disposed && currentSearchId === searchId) {
          currentEntries = [];
          this.resultsProvider.setResults(normalizedQuery, []);
          this.resultsView.message = vscode.l10n.t('Search failed.');
          quickPick.items = [];
        }
      } finally {
        if (!disposed && currentSearchId === searchId) {
          quickPick.busy = false;
          activeProcess = undefined;
        }
      }
    };

    quickPick.onDidChangeValue((value) => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => void search(value), SEARCH_DEBOUNCE_MS);
    });
    quickPick.onDidAccept(() => {
      const entry = quickPick.selectedItems[0]?.entry ?? currentEntries[0];
      if (entry) {
        void vscode.commands.executeCommand('piste.openSearchResult', entry);
      }
      quickPick.hide();
    });
    quickPick.onDidHide(() => {
      disposed = true;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      activeProcess?.kill();
      quickPick.dispose();
    });
  }
}

function toQuickPickItem(entry: MemoEntry): MemoQuickPickItem {
  return {
    label: entry.preview || entry.fileName,
    description: `${entry.fileName} · ${vscode.l10n.t('Line {0}', entry.lineNumber)}`,
    detail: entry.relativePath,
    alwaysShow: true,
    entry,
  };
}
