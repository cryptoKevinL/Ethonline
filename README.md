# PayStream - Web3 Payment Management

A modern Web3 payment management system for employers and employees, built with React, TypeScript, and Supabase.

## Features

- **Employer Dashboard**: Manage payment groups, process payments, and track transaction history
- **Employee Portal**: View payment history, monitor wallet transactions, and track employment details
- **Web3 Integration**: Support for multiple blockchains and tokens
- **Real-time Monitoring**: Track blockchain transactions and payment status
- **Database Integration**: Store payment records and employment data

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **UI**: shadcn/ui, Tailwind CSS
- **Web3**: Wagmi, Nexus SDK
- **Backend**: Supabase (Database, Auth, Edge Functions)
- **Blockchain**: Blockscout API integration

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- Web3 wallet (MetaMask, etc.)

### Installation

```bash
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to the project directory
cd paystream

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Start the development server
npm run dev
```

### Environment Variables

Create a `.env.local` file with the following variables:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_BLOCKSCOUT_API_KEY=your_blockscout_api_key
```

## Project Structure

```
src/
├── components/          # Reusable UI components
├── pages/              # Page components
│   ├── admin/          # Admin dashboard pages
│   ├── employee/       # Employee portal pages
│   └── Landing.tsx     # Landing page
├── lib/                # Utility functions and services
│   ├── supabase.ts     # Supabase client and types
│   └── profileService.ts # Business logic services
└── providers/          # React context providers
```

## Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment

The application can be deployed to any static hosting service:

- **Vercel**: Connect your GitHub repository
- **Netlify**: Deploy from Git or drag & drop
- **Supabase**: Use Supabase hosting

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.