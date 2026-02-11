# Marcko - Markdown Editor

A professional markdown editor with real-time preview and sharing capabilities.

[![GitHub stars](https://img.shields.io/github/stars/soummyaanon/Marcko?style=social)](https://github.com/soummyaanon/Marcko)

> 💫 **If you find this project useful, please consider giving it a star!** [⭐ Star on GitHub](https://github.com/soummyaanon/Marcko)

## Created by

**[soummyaanon](https://github.com/soummyaanon)** - *Full Stack Developer*

## Preview

![Marcko Editor](https://via.placeholder.com/800x450?text=Marcko+Editor+Preview)

> 🚀 **Live Demo**: [Marcko](marcko.vercel.app)

## Features

- **Real-time Preview**: See your markdown rendered instantly as you type
- **Syntax Highlighting**: Code blocks with proper syntax highlighting
- **Clean Interface**: Distraction-free writing experience
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm

### Installation

```bash
# Clone the repository
git clone https://github.com/soummyaanon/Marcko.git

# Navigate to the project
cd marcko

# Install dependencies
pnpm install

# Start the development server
pnpm dev
```

### Environment Variables

Create a `.env` file with:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000

BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=your-long-secret
BETTER_AUTH_DATABASE_URL=postgresql://...
BETTER_AUTH_DB_SSL_REJECT_UNAUTHORIZED=false
DOCUMENT_ENCRYPTION_KEY=replace-with-a-long-random-secret
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

`BETTER_AUTH_DATABASE_URL` should be your Supabase Postgres connection string.
Use the Supabase database URL from project settings (prefer the pooler URL for hosted environments).
Set `BETTER_AUTH_DB_SSL_REJECT_UNAUTHORIZED=true` in production if your environment has a trusted CA chain configured.
`DOCUMENT_ENCRYPTION_KEY` is used to encrypt shared document content at rest in the database and is required in production.
Signed-in users also get encrypted server-side draft autosave via `/api/draft`.

### Database Setup

Run existing document schema and the new share-limit migration in Supabase SQL editor:

```sql
-- scripts/001_create_documents.sql
-- scripts/002_add_share_limits_and_document_owner.sql
```

Google OAuth redirect URI:

```txt
http://localhost:3000/api/auth/callback/google
```

### Building for Production

```bash
pnpm build
pnpm start
```

## Tech Stack

- **Framework**: Next.js 16
- **Styling**: TailwindCSS
- **UI Components**: Radix UI + shadcn/ui
- **Markdown**: Marked
- **Syntax Highlighting**: Highlight.js

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see the [LICENSE](LICENSE) file for details.
