# Distributed Node

A browser-based Progressive Web App scaffold for a distributed computing network.  
Each browser tab becomes a **node** — capable of connecting to peers, receiving compute
tasks, and contributing to a shared cache.

> **Status:** Scaffold only — networking, peer discovery, and distributed computation
> are not yet implemented. This repository tracks the initial project setup and UI shell.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm v9 or later (bundled with Node.js)

### Install dependencies

```bash
npm install
```

### Run the development server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.  
Hot Module Replacement (HMR) is enabled — edits appear instantly without a full reload.

### Build for production

```bash
npm run build
```

Output is written to `dist/`. Preview the production build locally with:

```bash
npm run preview
```

### Lint

```bash
npm run lint
```

---

## Project Structure

```
src/
├── app/
│   ├── App.tsx           # Root component and layout wrapper
│   └── NodeDashboard.tsx # Main dashboard UI (node status, peers, compute, cache)
│
├── network/              # [ placeholder ] Peer-to-peer / WebRTC layer
├── compute/              # [ placeholder ] Distributed task scheduler & executor
├── storage/              # [ placeholder ] Distributed cache & IndexedDB layer
│
├── hooks/                # [ placeholder ] Custom React hooks for subsystems
├── utils/                # [ placeholder ] Shared utility functions
├── components/           # [ placeholder ] Shared UI components
│
├── main.tsx              # Application entry point + service worker registration
├── index.css             # Tailwind CSS directives
└── vite-env.d.ts         # Vite environment type declarations

public/
├── manifest.json         # Web App Manifest (PWA)
├── sw.js                 # Minimal service worker (pass-through, no caching yet)
└── favicon.svg           # App icon
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Build tool | [Vite 5](https://vitejs.dev/) |
| UI framework | [React 18](https://react.dev/) + [TypeScript 5](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS 3](https://tailwindcss.com/) via PostCSS |
| Linting | [ESLint 9](https://eslint.org/) with typescript-eslint |
| PWA | Web App Manifest + Service Worker |

---

## Roadmap

The following subsystems will be implemented in subsequent steps:

1. **Peer networking** — WebRTC data channels, signaling server, peer discovery
2. **Compute system** — Task definition, work-stealing scheduler, Worker/WASM execution
3. **Cache system** — Distributed key-value store backed by IndexedDB
4. **Node identity** — Deterministic node ID, device fingerprint, compute score
5. **Advanced PWA** — Offline caching strategies, background sync

---

## License

MIT
