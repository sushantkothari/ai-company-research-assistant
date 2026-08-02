# Relu Consultancy - Company Research Assistant

A full-stack web application built for the Relu Consultancy Hackathon that automates company research. By providing a company name or website URL, the application crawls the web, extracts structured data using LLMs, and generates a downloadable PDF report.

## Features
- **Concurrent Web Crawling**: Extracts text from multiple core pages of a company website concurrently to minimize processing time.
- **Deduplication**: Hashes scraped content to prevent duplicate text from bloating the LLM context window.
- **Structured Data Extraction**: Uses OpenRouter LLMs with strict JSON schema enforcement to parse the company summary, products, pain points, and competitors.
- **Search Integration**: Leverages Serper.dev to find official company websites and gather context from Google Search.
- **PDF Export**: Generates styled, downloadable PDF reports directly from the browser using html2pdf.js.
- **Discord Bot Integration**: Allows users to automatically post the generated PDF report and applicant details to a specified Discord channel via the Discord API v10.

## Tech Stack
- **Framework**: Next.js (App Router)
- **Styling**: Vanilla CSS (CSS Modules)
- **Web Scraping**: Axios, Cheerio
- **PDF Generation**: html2pdf.js
- **Icons**: Lucide React

## Setup & Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd ai-company-researcher
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Add your API keys to `.env.local`:
   ```env
   OPENROUTER_API_KEY="your_openrouter_api_key"
   SERPER_API_KEY="your_serper_api_key"
   ```

4. **Run the Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Testing Discord Integration
To test the Discord bot integration:
1. Generate a Discord Bot Token from the Discord Developer Portal and invite the bot to your server.
2. Copy the Channel ID where you want the bot to post.
3. In the web application, click the **Settings** icon (top right).
4. Enter your applicant details, Discord Bot Token, and Channel ID.
5. Generate a report and click **Send to Discord**.

## Deployment
The application is optimized for Vercel. Connect your GitHub repository to Vercel and add `OPENROUTER_API_KEY` and `SERPER_API_KEY` to the Vercel Environment Variables before deploying.
