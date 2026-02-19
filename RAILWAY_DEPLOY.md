# Deploying MyPODAgent to Railway

## Quick Start (15-20 minutes)

### 1. Push Your Code to GitHub
If your code isn't already on GitHub, create a repository and push it there. Railway connects directly to GitHub repos.

### 2. Create a Railway Account
- Go to [railway.com](https://railway.com) and sign up with your GitHub account
- The Hobby plan is $5/month and includes enough resources for this app

### 3. Create a New Project
- Click "New Project" in the Railway dashboard
- Select "Deploy from GitHub repo"
- Choose your repository

### 4. Add a PostgreSQL Database
- In your Railway project, click "New" > "Database" > "Add PostgreSQL"
- Railway will automatically create a `DATABASE_URL` variable that your app will use
- No additional database setup needed - tables are created automatically on first deploy

### 5. Add a Volume for File Storage
Your app stores uploaded images and generated content. Railway uses "Volumes" for persistent file storage:
- Click on your service in the Railway dashboard
- Go to the "Volumes" tab
- Click "Add Volume"
- Set the mount path to: `/app/uploads`
- Click "Add"

This gives you 10 GB of storage (included in the $5/month Hobby plan).

### 6. Set Environment Variables
In your Railway service settings, add these environment variables:

| Variable | Description |
|----------|-------------|
| `SESSION_SECRET` | Any random string (e.g. generate one at randomkeygen.com) |
| `OPENAI_API_KEY` | Your OpenAI API key (from platform.openai.com) |
| `KIE_AI_API_KEY` | Your Kie.ai API key |
| `PRINTFUL_API_TOKEN` | Your Printful API token |
| `STORAGE_DIR` | Set to `/app/uploads` (must match the volume mount path from step 5) |

That's it - just 5 variables! The database connection is handled automatically by Railway.

### 7. Deploy
Railway will automatically build and deploy your app. The build process:
1. Installs dependencies
2. Builds the frontend and backend
3. Creates database tables
4. Starts the server

### 8. Set APP_URL
After your first deploy, Railway gives you a public URL (something like `your-app.up.railway.app`):
- Copy that URL
- Add a new environment variable: `APP_URL` = `https://your-app.up.railway.app`
- This ensures image URLs work correctly for AI processing

Railway will automatically redeploy with the new variable.

---

## How File Storage Works

On Replit, your files are stored in Google Cloud Storage (managed automatically). On Railway, files are stored directly on a persistent volume attached to your server. This is simpler and doesn't require any cloud storage accounts.

The app automatically detects which environment it's running in and uses the right storage method.

---

## Costs

- **Railway Hobby Plan:** $5/month (includes compute, database, and 10 GB file storage)
- **OpenAI API:** Pay-as-you-go based on usage
- **Kie.ai API:** Based on your plan
- **Printful API:** Based on your plan

**Total: ~$5/month** plus your API usage costs (which you already pay)

---

## Troubleshooting

**App won't start:**
- Check the deploy logs in the Railway dashboard
- Make sure all 5 required environment variables are set
- Ensure the PostgreSQL database is connected

**Can't create an admin user:**
- Set `ADMIN_CREATION_KEY` if you plan to use the create-admin route

**Files/images not loading:**
- Make sure the Volume is mounted at `/app/uploads`
- Make sure `STORAGE_DIR` is set to `/app/uploads`
- Check that `APP_URL` is set to your Railway public URL

**Database errors:**
- Railway PostgreSQL connects automatically via `DATABASE_URL`
- Tables are created automatically on first deploy

---

## Optional: Custom Domain

Railway supports custom domains on the Hobby plan:
1. Go to your service settings
2. Click "Custom Domain"
3. Add your domain and update your DNS records
4. Update `APP_URL` to match your custom domain
