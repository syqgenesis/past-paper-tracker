# Chemistry Past Paper Tracker

A local-first web app for tracking past-paper revision progress — question by question. Originally built for Cambridge Part II Chemistry, but it works for any exam where you practise from past papers.

Built because manually scrolling through 290+ PDFs to find gaps in your revision is no fun.

> **Local-first & private.** Everything runs on your own machine. Your papers, attempts, scores and notes live in a local SQLite file that is never uploaded anywhere and is excluded from version control.

## What it does

- Browse all past papers (2016–2025, 5 papers per year) in a clean library view with health score badges
- Open any paper and manage questions: add them, edit topics and mark allocations, log every attempt
- Track scores, confidence, and completion status per question — not just per paper
- Mark questions for review when you're not confident; the review queue surfaces them later
- Auto-flags questions for review when your score is below 50% — so you never forget a rough one
- Settings page scans your local PDF folder in one click; safe to re-run at any time

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard — summary stats, cold-topic alerts, exam countdown (Stage 5) |
| `/papers` | Paper library — all papers grouped by year, with health score and completion |
| `/papers/[year]/[number]` | Paper detail — question table, inline editing, attempt logging |
| `/topics` | Topic index — every topic with attempted/total, accuracy, review count, last attempted |
| `/topics/[slug]` | Topic detail — all attempted questions on a topic with your notes side-by-side |
| `/resources` | Resources — generated study materials + course handouts, grouped by module |
| `/review` | Review queue — filterable list of questions marked for re-study, with dismiss |
| `/settings` | Scan local folder to populate the paper database |

## Setup

### Prerequisites

- Node.js 18+
- Your PDF folder accessible locally
- A `.env.local` file (see below)

### Install

```bash
npm install
```

### Configure

Copy `.env.example` to `.env.local` and set your own paths:

```bash
cp .env.example .env.local
```

```env
PAPERS_ROOT=/path/to/your/papers/folder
```

The scanner expects two subfolders inside `PAPERS_ROOT`:
- `Past Tripos Papers-*/` — question papers
- `Past Tripos Papers - Suggested Answers-*/` — mark schemes

See `.env.example` for the optional settings (`DATABASE_PATH`, `EXAM_DATE`, `CLAUDE_PLANNER_ENABLED`).

### Run (development)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Run (production)

```bash
npm run build
npm start
```

### Scan papers

Go to `/settings` and click **Scan Papers**. This detects all PDFs, matches them by year and paper number, and writes records to the SQLite database. Safe to run multiple times.

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | SQLite via `better-sqlite3` |
| ORM | Drizzle ORM |
| Charts | Recharts (Stage 5) |
| Tests | Vitest |

## Scripts

```bash
npm run dev        # Start dev server with HMR
npm run build      # Production build
npm start          # Serve production build
npm test           # Run unit tests
npm run test:watch # Watch mode
npm run lint       # ESLint
```

## Project status

All stages complete.

| Stage | Status | Description |
|-------|--------|-------------|
| 1 | ✅ | Scaffold — Next.js, Drizzle schema, all routes |
| 2 | ✅ | Data layer — file scanner, Settings page, unit tests |
| 3 | ✅ | Paper library + paper detail |
| 4 | ✅ | Attempt logging modal with optimistic UI |
| 5 | ✅ | Dashboard analytics — charts, cold-topic alerts, countdown |
| 6 | ✅ | Review queue — filters, sort, dismiss, full test coverage |

## Database

SQLite file lives at `data/tracker.db`. Schema:

- `papers` — one row per paper file (year, paper number, question/answer file paths)
- `questions` — questions within a paper (number, topic, max marks)
- `attempts` — individual attempt records (score, confidence, status, review flag, notes)

Analytics queries live in `lib/analytics.ts`.

## A note on past papers & copyright

This repository contains **only the application code**. It does **not** include any exam papers or mark schemes. Past papers are copyright their respective examining bodies (e.g. the University of Cambridge for the Chemistry Tripos) and are not redistributed here. Point `PAPERS_ROOT` at your own local copy of the materials you are entitled to use.

## Contributing

Contributions are welcome. Open an issue to discuss a change, or send a pull request. Please run `npm test` and `npm run lint` before submitting.

## License

[MIT](./LICENSE) © 2026 syqgenesis
