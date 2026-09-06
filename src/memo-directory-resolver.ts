import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';

export class MemoDirectoryResolver {
  async resolve(): Promise<string | undefined> {
    const directory = expandHomeDirectory(
      vscode.workspace
        .getConfiguration('piste')
        .get<string>('directory', '~/.daily-memo')
        .trim(),
    );

    if (path.isAbsolute(directory)) {
      return directory;
    }

    const openSettings = vscode.l10n.t('Open Settings');
    const action = await vscode.window.showErrorMessage(
      vscode.l10n.t(
        'Set an absolute path in the "piste.directory" setting before using Piste.',
      ),
      openSettings,
    );

    if (action === openSettings) {
      await vscode.commands.executeCommand(
        'workbench.action.openSettings',
        'piste.directory',
      );
    }

    return undefined;
  }
}

function expandHomeDirectory(value: string): string {
  if (value === '~') {
    return os.homedir();
  }

  if (value.startsWith('~/') || value.startsWith('~\\')) {
    return path.join(os.homedir(), value.slice(2));
  }

  return value;
}
