const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const result = spawnSync('npm', ['run', 'lint'], {
  cwd: root,
  encoding: 'utf8',
  timeout: 25_000,
});

if (result.status !== 0) {
  const output = [result.stdout, result.stderr, result.error?.message]
    .filter(Boolean)
    .join('\n')
    .trim();

  process.stdout.write(JSON.stringify({
    systemMessage: `Stop フックの npm run lint -- --fix が失敗しました。\n${output.slice(-4_000)}`,
  }));
} else {
  process.stdout.write('{}');
}
