import * as vscode from 'vscode';
import { MarkdownDirectorySearch, type MarkdownSearchResult } from './markdown-directory-search';

const SEARCH_DEBOUNCE_MS = 200;

interface MarkdownSearchQuickPickItem extends vscode.QuickPickItem {
  readonly result: MarkdownSearchResult;
}

export class MarkdownSearchQuickPick {
  constructor(private readonly directorySearch: MarkdownDirectorySearch) {}

  show(directory: string): void {
    const quickPick = vscode.window.createQuickPick<MarkdownSearchQuickPickItem>();
    let debounceTimer: NodeJS.Timeout | undefined;
    let searchGeneration = 0;
    let previewGeneration = 0;
    let disposed = false;
    let searchCancellation: vscode.CancellationTokenSource | undefined;

    quickPick.title = vscode.l10n.t('Search Markdown in Piste Directory');
    quickPick.placeholder = vscode.l10n.t('Search markdown...');
    quickPick.matchOnDescription = true;
    quickPick.matchOnDetail = true;
    quickPick.show();

    const search = async (value: string, generation: number): Promise<void> => {
      const query = value.trim();
      quickPick.items = [];

      if (!query) {
        quickPick.busy = false;
        return;
      }

      quickPick.busy = true;
      const cancellation = new vscode.CancellationTokenSource();
      searchCancellation = cancellation;
      let results: MarkdownSearchResult[];
      try {
        results = await this.directorySearch.search(directory, query, cancellation.token);
      } catch {
        results = [];
      }

      if (!disposed && generation === searchGeneration) {
        quickPick.items = results.map(toQuickPickItem);
        quickPick.busy = false;
      }
    };

    quickPick.onDidChangeValue((value) => {
      const generation = ++searchGeneration;
      searchCancellation?.cancel();
      quickPick.items = [];
      quickPick.busy = Boolean(value.trim());
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => void search(value, generation), SEARCH_DEBOUNCE_MS);
    });

    quickPick.onDidChangeActive((items) => {
      const item = items[0];
      if (item) {
        void preview(item.result, ++previewGeneration).catch(() => undefined);
      }
    });

    quickPick.onDidAccept(() => {
      const item = quickPick.selectedItems[0] ?? quickPick.activeItems[0];
      if (item) {
        previewGeneration += 1;
        void openAtMatch(item.result, false).then(() => quickPick.hide());
      }
    });

    quickPick.onDidHide(() => {
      disposed = true;
      searchGeneration += 1;
      previewGeneration += 1;
      searchCancellation?.cancel();
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      quickPick.dispose();
      searchCancellation?.dispose();
    });

    const preview = async (result: MarkdownSearchResult, generation: number): Promise<void> => {
      await openAtMatch(result, true);
      if (disposed || generation !== previewGeneration) {
        return;
      }
    };
  }
}

function toQuickPickItem(result: MarkdownSearchResult): MarkdownSearchQuickPickItem {
  return {
    label: result.relativePath,
    description: result.preview,
    detail: result.heading,
    alwaysShow: true,
    result,
  };
}

async function openAtMatch(result: MarkdownSearchResult, preview: boolean): Promise<void> {
  const editor = await vscode.window.showTextDocument(result.uri, {
    preview,
    preserveFocus: preview,
    selection: result.range,
  });
  editor.revealRange(result.range, vscode.TextEditorRevealType.InCenter);
}
