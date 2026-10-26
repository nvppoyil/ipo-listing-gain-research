# IPO Verdict (Next.js)

Create a file named .env.local next to package.json with one line:
OPENAI_API_KEY=your-key
(see .env.example)

Run on your computer first:
1. Install Node.js 18 or newer.
2. Open a terminal in this folder.
3. Run: npm install
4. Run: npm run dev
5. Open http://localhost:3000 and press "Update all data".

Go live on Vercel:
1. Push this folder to GitHub. The file .env.local is not pushed on purpose.
2. In Vercel, import the repo.
3. Settings > Environment Variables > add OPENAI_API_KEY with your key.
4. Deploy.
