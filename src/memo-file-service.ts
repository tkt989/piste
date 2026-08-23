import * as path from 'node:path';
import * as vscode from 'vscode';

export class MemoFileService {
  async getOrCreateToday(directory: string, suffix: string): Promise<vscode.Uri> {
    const date = formatLocalDate(new Date());
    const trimmedSuffix = suffix.trim();
    const fileName = trimmedSuffix
      ? `${date}-${sanitizeFileName(trimmedSuffix)}.md`
      : `${date}.md`;
    const directoryUri = vscode.Uri.file(directory);
    const memoUri = vscode.Uri.file(path.join(directory, fileName));

    await vscode.workspace.fs.createDirectory(directoryUri);

    if (!(await this.exists(memoUri))) {
      const title = trimmedSuffix ? `# ${date} - ${trimmedSuffix}\n\n` : `# ${date}\n\n`;
      await vscode.workspace.fs.writeFile(memoUri, Buffer.from(title, 'utf8'));
    }

    return memoUri;
  }

  private async exists(uri: vscode.Uri): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch (error) {
      if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
        return false;
      }
      throw error;
    }
  }
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function sanitizeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '-');
}
