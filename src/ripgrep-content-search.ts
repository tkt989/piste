import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import * as path from 'node:path';
import { rgPath } from '@vscode/ripgrep';
import type { MemoEntry, SearchTask } from './memo-types';

const MAX_SEARCH_RESULTS = 100;

export class RipgrepContentSearch {
  start(directory: string, query: string): SearchTask {
    const process = spawn(rgPath, [
      '--json',
      '--ignore-case',
      '--fixed-strings',
      '--glob=*.md',
      '--no-ignore',
      '--no-messages',
      '--max-count=1',
      '--',
      query,
      directory,
    ]);

    return {
      process,
      result: this.collectResults(process, directory),
    };
  }

  private collectResults(
    process: ChildProcessWithoutNullStreams,
    directory: string,
  ): Promise<MemoEntry[]> {
    return new Promise((resolve, reject) => {
      const entries: MemoEntry[] = [];
      let outputBuffer = '';
      let stoppedAtLimit = false;

      process.stdout.setEncoding('utf8');
      process.stdout.on('data', (chunk: string) => {
        outputBuffer += chunk;
        const records = outputBuffer.split('\n');
        outputBuffer = records.pop() ?? '';

        for (const record of records) {
          const entry = this.parseMatch(record, directory);
          if (!entry) {
            continue;
          }

          entries.push(entry);
          if (entries.length === MAX_SEARCH_RESULTS) {
            stoppedAtLimit = true;
            process.kill();
            break;
          }
        }
      });
      process.on('error', reject);
      process.on('close', (code) => {
        if (code === 0 || code === 1 || stoppedAtLimit) {
          resolve(entries);
        } else {
          reject(new Error(`ripgrep exited with code ${code}`));
        }
      });
    });
  }

  private parseMatch(record: string, directory: string): MemoEntry | undefined {
    if (!record) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(record) as {
        type?: string;
        data?: { path?: { text?: string }; lines?: { text?: string } };
      };
      if (parsed.type !== 'match' || !parsed.data?.path?.text) {
        return undefined;
      }

      const filePath = parsed.data.path.text;
      return {
        filePath,
        fileName: path.basename(filePath),
        relativePath: path.relative(directory, filePath),
        preview: (parsed.data.lines?.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 180),
      };
    } catch {
      return undefined;
    }
  }
}
