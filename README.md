# Rap Songless

A music guessing game focused on rap/hip-hop songs.

## Local Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`
4. Visit http://localhost:8000 in your browser

## Deploying to Vercel

### Prerequisites
- Vercel account
- Vercel CLI installed (`npm i -g vercel`)

### Deployment Steps

1. Login to Vercel CLI:
   ```
   vercel login
   ```

2. Deploy the project:
   ```
   vercel
   ```

3. For production deployment:
   ```
   vercel --prod
   ```

### Environment Variables

The following environment variables should be set in your Vercel project settings:
- Any API keys or configuration needed (if applicable)

## Project Structure

- `/api` - Vercel serverless API functions
- `/public` - Static frontend files
- `itunesService.js` - Service for fetching music data from iTunes API 