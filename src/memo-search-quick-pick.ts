import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import * as vscode from 'vscode';
import type { MemoEntry, MemoQuickPickItem } from './memo-types';
import { RipgrepContentSearch } from './ripgrep-content-search';

const SEARCH_DEBOUNCE_MS = 200;

export class MemoSearchQuickPick {
  constructor(private readonly contentSearch: RipgrepContentSearch) {}

  show(directory: string): void {
    const quickPick = vscode.window.createQuickPick<MemoQuickPickItem>();
    const searchPlaceholder = vscode.l10n.t('Enter a search term');
    let activeProcess: ChildProcessWithoutNullStreams | undefined;
    let debounceTimer: NodeJS.Timeout | undefined;
    let searchId = 0;
    let disposed = false;

    quickPick.title = vscode.l10n.t('Search daily memo contents');
    quickPick.placeholder = searchPlaceholder;
    quickPick.matchOnDescription = true;
    quickPick.matchOnDetail = true;
    quickPick.show();

    const search = async (query: string): Promise<void> => {
      const currentSearchId = ++searchId;
      activeProcess?.kill();
      activeProcess = undefined;

      if (!query.trim()) {
        quickPick.items = [];
        quickPick.busy = false;
        quickPick.placeholder = searchPlaceholder;
        return;
      }

      quickPick.busy = true;
      quickPick.placeholder = vscode.l10n.t('Searching memo contents…');
      const task = this.contentSearch.start(directory, query.trim());
      activeProcess = task.process;

      try {
        const entries = await task.result;
        if (!disposed && currentSearchId === searchId) {
          quickPick.items = entries.map(toQuickPickItem);
          quickPick.placeholder = entries.length === 0
            ? vscode.l10n.t('No matching memo contents found.')
            : searchPlaceholder;
        }
      } catch {
        if (!disposed && currentSearchId === searchId) {
          quickPick.items = [];
          quickPick.placeholder = vscode.l10n.t('Unable to search the memo directory.');
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
      const selected = quickPick.selectedItems[0];
      if (selected) {
        void openMemo(vscode.Uri.file(selected.entry.filePath)).catch(() => {
          void vscode.window.showWarningMessage(vscode.l10n.t('The selected memo no longer exists.'));
        });
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
    label: entry.fileName,
    description: entry.relativePath === entry.fileName ? undefined : entry.relativePath,
    detail: entry.preview,
    entry,
  };
}

async function openMemo(uri: vscode.Uri): Promise<void> {
  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(document);
}
