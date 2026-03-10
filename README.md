# Bay Area Girls Cricket Website

A full-stack website for Bay Area Girls Cricket featuring match statistics, player profiles, scorecard import, and an AI cricket assistant.

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** for styling
- **Supabase** (PostgreSQL) for data storage
- **Playwright** for scraping CricClubs scorecards
- **Claude API** (Anthropic) for the AI chatbot
- **Vercel** for hosting

---

## Setup

### 1. Install Node.js

Download and install from [nodejs.org](https://nodejs.org/) (LTS version recommended).

Or with Homebrew:
```bash
brew install node
```

### 2. Install dependencies

```bash
cd /Users/bv/bay-area-girls-cricket
npm install
npx playwright install chromium
```

### 3. Set up Supabase

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to **SQL Editor** and run the contents of `supabase/schema.sql`
4. Go to **Settings → API** and copy your project URL and keys

### 4. Configure environment variables

Edit `.env.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...   # Get from console.anthropic.com
ADMIN_PASSWORD=choose-a-password
```

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Importing Scorecards

### Option A — Admin UI (requires Playwright installed locally)

1. Go to [http://localhost:3000/admin](http://localhost:3000/admin)
2. Enter your admin password
3. Paste a CricClubs scorecard URL
4. Click **Import Scorecard**

### Option B — Local script

```bash
npm run scrape "https://cricclubs.com/strikersca/viewScorecard.do?matchId=1142&clubId=1095791"
```

---

## Deploying to Vercel

1. Push to GitHub
2. Connect repo at [vercel.com](https://vercel.com)
3. Add all environment variables from `.env.local` in Vercel's dashboard
4. Deploy

> **Note:** Playwright cannot run on Vercel's serverless functions due to size limits.
> Use the local `npm run scrape` script to import scorecards and push data to Supabase,
> then the deployed site reads from Supabase automatically.

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Home — upcoming matches, recent results |
| `/players` | Player roster with roles |
| `/schedule` | Upcoming fixtures |
| `/results` | Past match results |
| `/match/[id]` | Full scorecard for a match |
| `/stats` | Batting & bowling statistics |
| `/news` | News and announcements |
| `/gallery` | Photo gallery |
| `/about` | About the organization |
| `/admin` | Import scorecards (password protected) |

---

## Adding the Chatbot API Key

1. Sign up at [console.anthropic.com](https://console.anthropic.com/)
2. Create an API key
3. Add to `.env.local`: `ANTHROPIC_API_KEY=sk-ant-...`
4. The chatbot will automatically have access to all match and player data

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Home
│   ├── players/              # Player roster
│   ├── schedule/             # Upcoming matches
│   ├── results/              # Past results
│   ├── stats/                # Statistics tables
│   ├── match/[id]/           # Match scorecard
│   ├── news/                 # News
│   ├── gallery/              # Gallery
│   ├── about/                # About page
│   ├── admin/                # Scorecard importer
│   └── api/
│       ├── scrape/           # Scraper endpoint
│       ├── stats/            # Stats API
│       └── chat/             # AI chatbot endpoint
├── components/
│   ├── Navbar.tsx
│   ├── Footer.tsx
│   ├── MatchCard.tsx
│   ├── BattingScorecard.tsx
│   ├── BowlingScorecard.tsx
│   └── Chatbot.tsx
└── lib/
    ├── types.ts              # TypeScript types
    ├── supabase.ts           # Supabase client
    └── scraper.ts            # CricClubs HTML parser
scripts/
└── scrape.ts                 # Local scraper CLI
supabase/
└── schema.sql                # Database schema
```
