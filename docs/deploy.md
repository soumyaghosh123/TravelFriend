# Deploying TripSaver (free plans)

| Part | Host | Config in repo |
|---|---|---|
| Database (PostgreSQL) | Neon, free plan | none |
| API (NestJS) | Render, free web service | `render.yaml` |
| Website (Next.js) | Vercel, Hobby plan | `apps/web/vercel.json` |

Redis is optional and is left out for now. Without it:
- searches are kept in the API's memory and are lost when the free API sleeps
- the daily price-alert check does not run (users can still set alerts)

Add Upstash Redis later and set `REDIS_URL` on Render to turn both on.

Sign up for Neon, Render and Vercel with **Continue with GitHub**. Do them in this order, because each step needs a value from the one before.

## 1. Neon: the database

1. Create a project named `tripsaver`, choosing the region **AWS Asia Pacific (Singapore)**.
2. On the dashboard, click **Connect**.
3. Turn **Connection pooling off** and copy the connection string. It starts with `postgresql://` and ends with `?sslmode=require`. This is `DATABASE_URL`.

## 2. Render: the API

1. Click **New → Blueprint** and pick the `TravelFriend` repository. Render reads `render.yaml`.
2. Render then asks for the values not stored in the repo:
   - `DATABASE_URL`: the Neon string from step 1.
   - `WEB_ORIGIN`: the website address, with no trailing slash. Enter `https://tripsaver.vercel.app` for now, or whatever Vercel gives you in step 3, and update it afterwards if it differs.
   - `SMTP_URL` and `MAIL_FROM`: the same values as in your local `.env`.
3. Click **Apply**. The first build takes about 5 minutes. It creates the tables in Neon and loads the sample data.
4. Copy the service address, e.g. `https://tripsaver-api.onrender.com`. Opening `<address>/api/auth/config` in a browser should show a short JSON reply.

## 3. Vercel: the website

1. Click **Add New → Project** and import `TravelFriend`.
2. Set **Root Directory** to `apps/web`. Vercel finds the framework, install command and build command in `apps/web/vercel.json`.
3. Under **Environment Variables**, add `API_URL` set to the Render address from step 2, with no trailing slash.
4. Click **Deploy**. When it finishes, Vercel shows the public link, e.g. `https://tripsaver.vercel.app`.
5. If that link differs from the `WEB_ORIGIN` you gave Render, update `WEB_ORIGIN` on Render (**Environment** tab), then save and redeploy. Sign-in and saving trips fail until the two match.

## After that

Every push to `main` redeploys both the website and the API.

| Problem | Cause |
|---|---|
| Changes to `API_URL` don't take effect | It is read when the site is built: change it on Vercel, then redeploy. |
| First search after a quiet spell is slow | The free API sleeps after 15 minutes idle; it takes about a minute to wake. |
| Sign-in gives "403" | `WEB_ORIGIN` on Render doesn't match the Vercel link exactly. |
