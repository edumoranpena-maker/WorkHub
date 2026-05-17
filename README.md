# Workspace Platform

React + Vite workspace app.

## Stack
- React 18, Vite 5, Framer Motion, Lucide React, Tailwind CSS

## Setup

```bash
npm install
npm run dev
# → http://localhost:5173
```

## Structure

```
workspace-platform/
├── index.html
├── package.json
├── vite.config.js
├── postcss.config.cjs      ← .cjs required (package.json has type:module)
├── tailwind.config.cjs     ← .cjs required (package.json has type:module)
├── public/
│   ├── favicon.svg
│   └── workspace_logo.png
└── src/
    ├── main.jsx
    ├── index.css
    ├── App.jsx              ← Main Platform / navigation root
    └── sections/
        ├── Planning.jsx     ← Planning section
        └── Recaps.jsx       ← Recaps & Updates section
```
