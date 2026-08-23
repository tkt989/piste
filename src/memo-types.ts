import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import type * as vscode from 'vscode';

export interface MemoEntry {
  readonly filePath: string;
  readonly fileName: string;
  readonly relativePath: string;
  readonly preview: string;
}

export interface MemoQuickPickItem extends vscode.QuickPickItem {
  readonly entry: MemoEntry;
}

export interface SearchTask {
  readonly process: ChildProcessWithoutNullStreams;
  readonly result: Promise<MemoEntry[]>;
}
