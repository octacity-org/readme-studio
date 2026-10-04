import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';

describe('Agent readiness & Discoverability', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const publicDir = path.join(rootDir, 'public');

  test('llms.txt and llms-full.txt exist and follow llmstxt specifications', () => {
    const llmsTxt = fs.readFileSync(path.join(publicDir, 'llms.txt'), 'utf-8');
    expect(llmsTxt).toStartWith('# Readme Studio by Octacity');
    expect(llmsTxt).toContain('## Core Resources');
    expect(llmsTxt).toContain('https://octacity-org.github.io/readme-studio/');
    expect(llmsTxt).toContain('llms-full.txt');
    expect(llmsTxt).toContain('## When to use Readme Studio');
    expect(llmsTxt).toContain('## Limitations');
    expect(llmsTxt).toContain('optional GitHub authorization');

    const llmsFull = fs.readFileSync(path.join(publicDir, 'llms-full.txt'), 'utf-8');
    expect(llmsFull).toContain('# Readme Studio by Octacity — Full Agent Documentation');
    expect(llmsFull).toContain('## Project Overview');
    expect(llmsFull).toContain('Octacity');
  });

  test('404.html provides recovery navigation and markdown block for agents', () => {
    const errorPage = fs.readFileSync(path.join(publicDir, '404.html'), 'utf-8');
    expect(errorPage).toContain('404 Not Found');
    expect(errorPage).toContain('Octacity');
    expect(errorPage).toContain('https://octacity-org.github.io/readme-studio/llms.txt');
    expect(errorPage).toContain('https://octacity-org.github.io/readme-studio/sitemap.xml');
  });

  test('robots.txt and sitemap.xml are configured correctly', () => {
    const robots = fs.readFileSync(path.join(publicDir, 'robots.txt'), 'utf-8');
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Allow: /');
    expect(robots).toContain('Sitemap: https://octacity-org.github.io/readme-studio/sitemap.xml');

    const sitemap = fs.readFileSync(path.join(publicDir, 'sitemap.xml'), 'utf-8');
    expect(sitemap).toContain('https://octacity-org.github.io/readme-studio/</loc>');
    expect(sitemap).toContain('https://octacity-org.github.io/readme-studio/llms.txt</loc>');
  });

  test('Document.tsx renders rich semantic content, JSON-LD, and alternate markdown links', () => {
    const docSource = fs.readFileSync(path.resolve(__dirname, '../Document.tsx'), 'utf-8');
    expect(docSource).toContain('Octacity');
    expect(docSource).toContain('application/ld+json');
    expect(docSource).toContain('type="text/markdown"');
    expect(docSource).toContain('llms.txt');
    expect(docSource).toContain('class="agent-homepage"');
    expect(docSource).toContain('<h1>Build a better GitHub README</h1>');
    expect(docSource).toContain('Privacy</a>');
    expect(docSource).toContain('property="og:image"');
    expect(docSource).toContain('name="twitter:image"');
  });

  test('publishes substantive About, Contact, and Privacy pages', () => {
    const expectedPages = [
      ['about', 'About Readme Studio'],
      ['contact', 'Contact Readme Studio'],
      ['privacy', 'Readme Studio Privacy'],
    ] as const;

    for (const [directory, heading] of expectedPages) {
      const page = fs.readFileSync(path.join(publicDir, directory, 'index.html'), 'utf-8');
      const readableText = page
        .replace(/<style[\s\S]*?<\/style>/g, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      expect(page).toContain(`<h1>${heading}</h1>`);
      expect(page).toContain(`rel="canonical" href="https://octacity-org.github.io/readme-studio/${directory}/"`);
      expect(page).toContain('href="/readme-studio/"');
      expect(readableText.length).toBeGreaterThan(500);
    }
  });

  test('provides a 1200 by 630 social preview image', () => {
    const image = fs.readFileSync(path.join(publicDir, 'social-card.png'));
    expect(image.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(image.readUInt32BE(16)).toBe(1200);
    expect(image.readUInt32BE(20)).toBe(630);
  });
});
