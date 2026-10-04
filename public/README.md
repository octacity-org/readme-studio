<div align="center">

# Readme Studio

**A fast, interactive visual editor for GitHub repository and profile READMEs.**

[![Deploy to GitHub Pages](https://img.shields.io/github/actions/workflow/status/octacity-org/readme-studio/deploy.yml?branch=main&style=flat-square&logo=github&label=deploy)](https://github.com/octacity-org/readme-studio/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![SolidJS](https://img.shields.io/badge/SolidJS-2.0-2c4f7c?style=flat-square&logo=solid)](https://solidjs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646cff?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Bun](https://img.shields.io/badge/Bun-1.3-14151a?style=flat-square&logo=bun)](https://bun.sh/)

[**Live Demo**](https://octacity-org.github.io/readme-studio/) • [**Report Bug**](https://github.com/octacity-org/readme-studio/issues) • [**Request Feature**](https://github.com/octacity-org/readme-studio/issues)

</div>

---

## ✨ Features

### 📝 Real-Time Markdown Editing & GitHub Preview
- **Focused editor & preview modes**: Write GFM (GitHub Flavored Markdown) or switch to a full-width sanitized preview.
- **Local persistence**: Automatic auto-save to browser local storage so your work is never lost.
- **Drag & drop imports**: Drop any `.md` file directly into the studio to edit existing documentation.
- **Document quality checks**: Real-time linting for document titles (H1), image alt text accessibility, and duplicate headings.
- **Document stats & outline**: Live word, character, and line counters alongside a clickable heading outline.

### 🛡️ Shields.io & Custom Badge Builder
- **Dynamic presets**: CI/CD build status, latest GitHub releases, npm downloads, code coverage (Codecov), license indicators, Discord members, Read the Docs builds, and GitHub star counters.
- **Custom badge designer**: Configure labels, messages, colors, badge styles (`flat-square`, `for-the-badge`, `plastic`, etc.), custom brand logos, and target links.

### 🎨 GitHub Profile README Suite
- **Capsule Banners**: Dynamic SVG header and footer banner generators powered by Capsule Render.
- **Contribution Graph Animations**: Interactive Contribution Snake generator and retro arcade graphs (Pac-Man, Breakout, Galaga, Bomberman, Puzzle Bobble).
- **Workflow generator**: Automatic creation and download of required GitHub Actions workflows (`snake.yml`, `arcade.yml`).
- **Stats & Cards**: GitHub profile stats cards, top languages, streak counters, trophies, and activity graphs with custom themes.
- **Tech Stack Badges**: Visual skill rows powered by Skill Icons, Devicons, Simple Icons, and Shields.io.
- **Social Links & View Counters**: One-click icon and badge generators for 35+ social networks, blogs, and visitor counters.

### 📂 Productivity Tools
- **Project Tree Generator**: Convert file lists into clean directory trees for your README.
- **Automatic Table of Contents**: Generate linked, slugified table-of-contents lists based on your document headings.
- **Keyboard Shortcuts**: Common editor shortcuts (`Cmd/Ctrl + S` to export, `Cmd/Ctrl + B` for bold, `Cmd/Ctrl + K` for links).

---

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (recommended) or Node.js >= 20

### Installation

```bash
# Clone the repository
git clone https://github.com/octacity-org/readme-studio.git
cd readme-studio

# Install dependencies
bun install
```

### Development Server

Start the local development server:

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🛠️ Scripts

| Command | Description |
| :--- | :--- |
| `bun run dev` (or `bun start`) | Starts the local Vite development server with HMR. |
| `bun run build` | Compiles the production static site into `dist/client`. |
| `bun run serve` | Serves the production build locally for previewing. |
| `bun run test` | Runs unit tests for profile generators, badge builders, and markdown helpers. |
| `bun run typecheck` | Runs the TypeScript compiler to verify all types without emitting files. |

---

## 📦 Deployment (GitHub Pages)

Readme Studio builds into a **pure static client** (`dist/client`).

The repository is configured with an automated [GitHub Actions deployment workflow](https://github.com/octacity-org/readme-studio/blob/main/.github/workflows/deploy.yml).

Whenever changes are pushed to the `main` branch:
1. Bun installs dependencies.
2. Unit tests and type checks are validated.
3. The static bundle is built via `bun run build`.
4. Artifacts are automatically published to **GitHub Pages** at `https://octacity-org.github.io/readme-studio/`.

---

## 📄 License

This project is licensed under the MIT License.
