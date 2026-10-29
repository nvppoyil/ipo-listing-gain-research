# IPO Verdict (Next.js)

No keys are needed. The Update button reads NSE directly.
(For AI updates, see .env.example.)

The **Check GMP sources** action separately reads public quotes from IPO Watch and IPOtick. These are unofficial grey-market estimates, not exchange data. The app shows each source and does not combine conflicting quotes; either tracker can block automated access or omit an IPO.

Run on your computer first:
1. Install Node.js 18 or newer.
2. Open a terminal in this folder.
3. Run: npm install
4. Run: npm run dev
5. Open http://localhost:3000 and press "Update all data".

Go live on Vercel:
1. Push this folder to GitHub. The file .env.local is not pushed on purpose.
2. In Vercel, import the repo.
3. Settings > Environment Variables > no keys are needed.
4. Deploy.
