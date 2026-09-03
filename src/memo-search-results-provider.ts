import * as vscode from 'vscode';
import type { MemoEntry } from './memo-types';

export class MemoSearchResultsProvider implements vscode.TreeDataProvider<MemoEntry> {
  private readonly changeEmitter = new vscode.EventEmitter<MemoEntry | undefined>();
  private entries: MemoEntry[] = [];

  readonly onDidChangeTreeData = this.changeEmitter.event;

  setLoading(query: string): void {
    this.queryValue = query;
    this.entries = [];
    this.changeEmitter.fire(undefined);
  }

  setResults(query: string, entries: MemoEntry[]): void {
    this.queryValue = query;
    this.entries = entries;
    this.changeEmitter.fire(undefined);
  }

  clear(): void {
    this.queryValue = '';
    this.entries = [];
    this.changeEmitter.fire(undefined);
  }

  getTreeItem(entry: MemoEntry): vscode.TreeItem {
    const item = new vscode.TreeItem(
      {
        label: entry.preview || entry.fileName,
        highlights: findHighlights(entry.preview, this.queryValue),
      },
      vscode.TreeItemCollapsibleState.None,
    );

    item.description = `${entry.fileName} · ${vscode.l10n.t('Line {0}', entry.lineNumber)}`;
    item.tooltip = new vscode.MarkdownString(
      `**${entry.fileName}**  \n${entry.relativePath}:${entry.lineNumber}  \n\n${entry.preview}`,
    );
    item.iconPath = new vscode.ThemeIcon('search');
    item.command = {
      command: 'piste.openSearchResult',
      title: vscode.l10n.t('Open search result'),
      arguments: [entry],
    };
    return item;
  }

  getChildren(): MemoEntry[] {
    return this.entries;
  }

  get message(): string | undefined {
    if (!this.queryValue) {
      return vscode.l10n.t('Enter a search term to search your daily memos.');
    }

    return this.entries.length === 0
      ? vscode.l10n.t('No results for "{0}"', this.queryValue)
      : vscode.l10n.t('{0} results for "{1}"', this.entries.length, this.queryValue);
  }

  private queryValue = '';
}

function findHighlights(value: string, query: string): [number, number][] {
  if (!query) {
    return [];
  }

  const highlights: [number, number][] = [];
  const normalizedValue = value.toLocaleLowerCase();
  const normalizedQuery = query.toLocaleLowerCase();
  let start = normalizedValue.indexOf(normalizedQuery);

  while (start >= 0) {
    highlights.push([start, start + query.length]);
    start = normalizedValue.indexOf(normalizedQuery, start + query.length);
  }

  return highlights;
}
