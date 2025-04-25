# Bitcoin Mining Game

A web application that gamifies the Bitcoin mining process, allowing participants to understand how mining works through an interactive game.

## Features

- 2-minute mining rounds
- Multiple participants can join using their names
- Real-time hash generation and submission
- Automatic hash verification (first nibble zero check)
- Winner determination and blockchain updates
- Admin controls for game management

## Setup

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

4. Start production server:
```bash
npm start
```

## Deployment on Railway

1. Push your code to GitHub
2. Connect your GitHub repository to Railway
3. Railway will automatically deploy your application

## Tech Stack

- Next.js 14
- TypeScript
- Socket.IO for real-time communication
- TailwindCSS for styling
- CryptoJS for hash generation
