import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const packageAt = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

test('pins the compatible Solid runtime and compiler stack together', () => {
  const manifest = packageAt('../../package.json');
  expect(manifest.dependencies['solid-js']).toBe('2.0.0-rc.13');
  expect(manifest.dependencies['@solidjs/web']).toBe('2.0.0-rc.13');
  expect(manifest.devDependencies['@solidjs/vite-plugin']).toBe('3.0.0-next.47');
  for (const name of ['solid-js', '@solidjs/web', '@solidjs/signals', '@solidjs/compiler', '@solidjs/babel-plugin']) {
    expect(packageAt(`../../node_modules/${name}/package.json`).version).toBe('2.0.0-rc.13');
  }
});

test('keeps static Pages output and explicitly selects a supported CI Node major', () => {
  const config = readFileSync(new URL('../../vite.config.ts', import.meta.url), 'utf8');
  const workflow = readFileSync(new URL('../../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  expect(config).toContain('solid({ start: true })');
  expect(config).toContain("base: '/readme-studio/'");
  expect(workflow).toContain('actions/setup-node@v4');
  expect(workflow).toContain("node-version: '22'");
  expect(workflow).toContain('path: dist/client');
});
