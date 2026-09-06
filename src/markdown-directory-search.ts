import * as path from 'node:path';
import * as vscode from 'vscode';

const MAX_RESULTS = 100;
const MAX_FILES = 10_000;
const READ_CONCURRENCY = 16;

export interface MarkdownSearchResult {
  readonly uri: vscode.Uri;
  readonly relativePath: string;
  readonly preview: string;
  readonly heading?: string;
  readonly range: vscode.Range;
}

export class MarkdownDirectorySearch {
  async search(
    directory: string,
    query: string,
    token: vscode.CancellationToken,
  ): Promise<MarkdownSearchResult[]> {
    const files = await vscode.workspace.findFiles(
      new vscode.RelativePattern(vscode.Uri.file(directory), '**/*.md'),
      undefined,
      MAX_FILES,
      token,
    );
    const results: MarkdownSearchResult[] = [];
    let nextFileIndex = 0;

    const worker = async (): Promise<void> => {
      while (!token.isCancellationRequested && results.length < MAX_RESULTS) {
        const uri = files[nextFileIndex++];
        if (!uri) {
          return;
        }

        const fileResults = await this.searchFile(uri, directory, query, token);
        for (const result of fileResults) {
          if (token.isCancellationRequested || results.length === MAX_RESULTS) {
            return;
          }
          results.push(result);
        }
      }
    };

    await Promise.all(Array.from({ length: READ_CONCURRENCY }, () => worker()));
    return results;
  }

  private async searchFile(
    uri: vscode.Uri,
    directory: string,
    query: string,
    token: vscode.CancellationToken,
  ): Promise<MarkdownSearchResult[]> {
    try {
      const content = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
      const lines = content.split(/\r?\n/);
      const normalizedQuery = query.toLocaleLowerCase();
      const results: MarkdownSearchResult[] = [];
      const headings: Array<string | undefined> = [];

      for (
        let lineIndex = 0;
        lineIndex < lines.length && !token.isCancellationRequested && results.length < MAX_RESULTS;
        lineIndex += 1
      ) {
        const line = lines[lineIndex];
        updateHeadings(headings, line);

        const normalizedLine = line.toLocaleLowerCase();
        let matchIndex = normalizedLine.indexOf(normalizedQuery);
        while (matchIndex >= 0 && results.length < MAX_RESULTS) {
          results.push({
            uri,
            relativePath: path.relative(directory, uri.fsPath).split(path.sep).join('/'),
            preview: createPreview(line, matchIndex, query.length),
            heading: headings.filter((heading): heading is string => Boolean(heading)).join(' > ') || undefined,
            range: new vscode.Range(
              new vscode.Position(lineIndex, matchIndex),
              new vscode.Position(lineIndex, matchIndex + query.length),
            ),
          });
          matchIndex = normalizedLine.indexOf(normalizedQuery, matchIndex + query.length);
        }
      }

      return results;
    } catch {
      // A file can disappear or become unreadable while a directory search is running.
      return [];
    }
  }
}

function updateHeadings(headings: Array<string | undefined>, line: string): void {
  const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
  if (!match) {
    return;
  }

  const level = match[1].length;
  headings.length = level;
  headings[level - 1] = match[2];
}

function createPreview(line: string, matchIndex: number, matchLength: number): string {
  const context = 80;
  const start = Math.max(0, matchIndex - context);
  const end = Math.min(line.length, matchIndex + matchLength + context);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < line.length ? '…' : '';
  return `${prefix}${line.slice(start, end).replace(/\s+/g, ' ').trim()}${suffix}`;
}
