import type { ParentProps } from 'solid-js';
import { HydrationScript } from '@solidjs/web';

export default function Document(props: ParentProps) {
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://github.com/octacity-org#organization',
        name: 'Octacity',
        url: 'https://github.com/octacity-org',
        sameAs: ['https://github.com/octacity-org'],
      },
      {
        '@type': 'WebApplication',
        '@id': 'https://octacity-org.github.io/readme-studio/#webapp',
        name: 'Readme Studio',
        alternateName: ['Readme Studio by Octacity', 'octacity-org Readme Studio'],
        url: 'https://octacity-org.github.io/readme-studio/',
        description: 'A fast, private, browser-based visual Markdown editor for creating polished GitHub repository and profile READMEs by Octacity.',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Any (Web Browser)',
        browserRequirements: 'Requires JavaScript and a modern web browser',
        softwareVersion: '1.0.0',
        license: 'https://opensource.org/licenses/MIT',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        author: {
          '@id': 'https://github.com/octacity-org#organization',
        },
        publisher: {
          '@id': 'https://github.com/octacity-org#organization',
        },
        featureList: [
          'Real-time GitHub Flavored Markdown (GFM) editing with live sanitized preview',
          'Shields.io custom and dynamic badge builder',
          'GitHub Profile README tools (Capsule Render, Contribution Snake, Retro Arcade animations)',
          'GitHub statistics, top languages, and streak widgets',
          'Directory tree generator and automatic Table of Contents',
          'Local-first draft persistence with optional GitHub integration',
        ],
        image: 'https://octacity-org.github.io/readme-studio/social-card.png',
        screenshot: 'https://octacity-org.github.io/readme-studio/social-card.png',
      },
    ],
  });

  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Readme Studio by Octacity — Build better GitHub READMEs</title>
        <meta name="description" content="A fast, private, browser-based visual Markdown editor for polished GitHub repository and profile READMEs by Octacity." />
        <meta name="author" content="Octacity" />
        <meta name="publisher" content="Octacity" />
        <meta name="brand" content="Octacity" />
        <meta name="keywords" content="Readme Studio, Octacity, GitHub README editor, Profile README, Markdown editor, Shields.io badges, SolidJS" />
        <meta name="theme-color" content="#17211c" />

        {/* Canonical & Agent Alternate links */}
        <link rel="canonical" href="https://octacity-org.github.io/readme-studio/" />
        <link rel="alternate" type="text/markdown" href="https://octacity-org.github.io/readme-studio/llms.txt" title="Agent documentation in Markdown (llms.txt)" />
        <link rel="alternate" type="text/markdown" href="https://octacity-org.github.io/readme-studio/README.md" title="Project README in Markdown" />
        <link rel="help" type="text/markdown" href="https://octacity-org.github.io/readme-studio/llms.txt" />
        <link rel="sitemap" type="application/xml" href="https://octacity-org.github.io/readme-studio/sitemap.xml" />
        <link rel="icon" href="/readme-studio/favicon.ico" />

        {/* OpenGraph & Social Discoverability */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Readme Studio by Octacity — Build better GitHub READMEs" />
        <meta property="og:description" content="A fast, private, browser-based visual Markdown editor for polished GitHub repository and profile READMEs by Octacity." />
        <meta property="og:url" content="https://octacity-org.github.io/readme-studio/" />
        <meta property="og:site_name" content="Readme Studio by Octacity" />
        <meta property="og:image" content="https://octacity-org.github.io/readme-studio/social-card.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Readme Studio editor workbench with toolbox, Markdown workspace, and inspector" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Readme Studio by Octacity" />
        <meta name="twitter:description" content="A fast, private, browser-based visual Markdown editor for polished GitHub repository and profile READMEs by Octacity." />
        <meta name="twitter:image" content="https://octacity-org.github.io/readme-studio/social-card.png" />
        <meta name="twitter:image:alt" content="Readme Studio editor workbench with toolbox, Markdown workspace, and inspector" />

        {/* JSON-LD Structured Data */}
        <script type="application/ld+json" innerHTML={jsonLd} />

        <noscript>
          <link rel="alternate" type="text/markdown" href="/readme-studio/llms.txt" />
        </noscript>

        <script innerHTML="document.documentElement.classList.add('js')" />
        <HydrationScript />
      </head>
      <body>
        <main class="agent-homepage">
          <header class="agent-homepage-header">
            <a class="agent-homepage-brand" href="/readme-studio/" aria-label="Readme Studio home">
              <span>R/</span>
              <strong>Readme Studio</strong>
            </a>
            <p>Browser-based README workbench by Octacity</p>
          </header>

          <section class="agent-homepage-hero">
            <p class="eyebrow">Markdown, focused</p>
            <h1>Build a better GitHub README</h1>
            <p>Readme Studio is a fast, private, browser-based workspace for creating repository and profile READMEs. Write Markdown as the source of truth, inspect a sanitized GitHub-style preview, and export a finished README.md without creating an account.</p>
          </section>

          <section class="agent-homepage-section" aria-labelledby="fallback-capabilities">
            <h2 id="fallback-capabilities">A workbench for README-specific tasks</h2>
            <p>The editor includes focused Editor and Preview modes, insertion helpers for common Markdown and HTML patterns, dynamic Shields.io badge presets, GitHub profile widgets, project-tree generation, and automatic tables of contents. Document checks highlight missing titles, missing image alternative text, and duplicate headings while you work.</p>
            <ul>
              <li>Import local Markdown files or begin with a clean README.</li>
              <li>Build badges, profile cards, banners, social links, and contribution visuals.</li>
              <li>Download README.md and any required GitHub Actions workflow files.</li>
            </ul>
          </section>

          <section class="agent-homepage-section" aria-labelledby="fallback-privacy">
            <h2 id="fallback-privacy">Local first, with optional GitHub access</h2>
            <p>Drafts are saved in the browser instead of an application database. Connecting GitHub is optional and is only needed to open repositories, load account-backed contribution data, publish files, or authorize the remote MCP service. Browser connections use short-lived encrypted Readme Studio sessions. MCP client registrations and encrypted GitHub grant data are stored in Cloudflare KV; README content is not intentionally stored by the service.</p>
          </section>

          <section class="agent-homepage-section" aria-labelledby="fallback-resources">
            <h2 id="fallback-resources">Project and agent resources</h2>
            <p>Agents and text-only clients can use the concise <a href="/readme-studio/llms.txt">agent index</a>, read the <a href="/readme-studio/llms-full.txt">full product guide</a>, inspect the <a href="/readme-studio/README.md">project README</a>, or browse the <a href="/readme-studio/sitemap.xml">XML sitemap</a>.</p>
          </section>

          <footer class="agent-homepage-footer">
            <a href="/readme-studio/about/">About</a>
            <a href="/readme-studio/privacy/">Privacy</a>
            <a href="/readme-studio/contact/">Contact</a>
            <a href="https://github.com/octacity-org/readme-studio">Source on GitHub</a>
          </footer>
        </main>
        {props.children}
      </body>
    </html>
  );
}
