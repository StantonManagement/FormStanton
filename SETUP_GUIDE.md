# Complete Setup Guide - Tenant Onboarding Form

## Prerequisites

- Node.js 18+ installed
- A Supabase account
- A Resend account
- A Vercel account (for deployment)

## Step-by-Step Setup

### 1. Install Dependencies

Open your terminal in the project directory and run:

```bash
npm install
```

This will install all required packages including:
- Next.js 14
- React 18
- Supabase client
- Resend
- react-signature-canvas
- Tailwind CSS
- TypeScript

### 2. Set Up Supabase

#### Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - Name: `tenant-onboarding` (or your preferred name)
   - Database Password: (generate a strong password)
   - Region: Choose closest to your users
5. Click "Create new project"

#### Run the Database Schema

1. Once your project is created, go to the SQL Editor
2. Open the file `supabase/schema.sql` from this project
3. Copy the entire contents
4. Paste into the Supabase SQL Editor
5. Click "Run" to execute the SQL

This creates:
- The `submissions` table with all required columns
- The `submissions` storage bucket
- Row Level Security policies

#### Create Storage Bucket Folders

1. Go to Storage in your Supabase dashboard
2. You should see a `submissions` bucket (created by the SQL script)
3. Click on the bucket
4. Create the following folders:
   - `vaccinations/`
   - `pet_photos/`
   - `insurance/`
   - `signatures/`

#### Get Your Supabase Keys

1. Go to Project Settings → API
2. Copy the following:
   - **Project URL** (starts with `https://`)
   - **anon public** key
   - **service_role** key (keep this secret!)

### 3. Set Up Resend

#### Create a Resend Account

1. Go to [resend.com](https://resend.com)
2. Sign up for a free account
3. Verify your email

#### Get Your API Key

1. Go to API Keys in your Resend dashboard
2. Click "Create API Key"
3. Name it: `tenant-onboarding-form`
4. Copy the API key (you won't see it again!)

#### Configure Domain (Optional but Recommended)

For production, you should verify your domain:

1. Go to Domains in Resend
2. Click "Add Domain"
3. Enter your domain (e.g., `stantonmanagement.com`)
4. Add the DNS records shown to your domain provider
5. Wait for verification

For testing, you can use the default Resend domain.

### 4. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Copy from .env.local.example
cp .env.local.example .env.local
```

Edit `.env.local` and add your keys:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
RESEND_API_KEY=re_your_resend_key_here
```

**Important:** Never commit `.env.local` to version control!

### 5. Test Locally

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

#### Test the Form

1. Select a language (English, Spanish, or Portuguese)
2. Fill in resident information
3. Answer pet questions (try both yes and no)
4. Answer insurance questions
5. Answer vehicle questions
6. Submit the form

#### Verify Submission

1. Check Supabase:
   - Go to Table Editor → submissions
   - You should see your submission
2. Check Storage:
   - Go to Storage → submissions
   - Check the folders for uploaded files
3. Check Email:
   - You should receive a confirmation email (if configured)

### 6. Deploy to Vercel

#### Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit - Tenant onboarding form"
git branch -M main
git remote add origin https://github.com/yourusername/tenant-onboarding.git
git push -u origin main
```

#### Deploy on Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Configure project:
   - Framework Preset: Next.js (auto-detected)
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: `.next`

5. Add Environment Variables:
   - Click "Environment Variables"
   - Add all four variables from your `.env.local`:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `RESEND_API_KEY`

6. Click "Deploy"

#### Configure Custom Domain (Optional)

1. Go to your project settings in Vercel
2. Click "Domains"
3. Add your custom domain
4. Follow the DNS configuration instructions

### 7. Update Resend Email Configuration

Once deployed, update the email sender in `app/api/submit/route.ts`:

```typescript
from: 'Stanton Management <onboarding@yourdomain.com>',
```

Replace with your verified domain.

### 8. Test Production Deployment

1. Visit your deployed URL
2. Submit a test form
3. Verify:
   - Data appears in Supabase
   - Files are uploaded to storage
   - Confirmation email is sent

## Troubleshooting

### Form Won't Submit

- Check browser console for errors
- Verify all environment variables are set correctly
- Check Supabase logs for errors
- Ensure storage bucket exists and has correct policies

### Files Not Uploading

- Verify storage bucket `submissions` exists
- Check that folders are created in the bucket
- Verify service role key has storage permissions
- Check file size limits (default is 50MB in Supabase)

### Emails Not Sending

- Verify Resend API key is correct
- Check Resend dashboard for logs
- Ensure "from" email is verified (or use Resend's test domain)
- Check spam folder

### TypeScript Errors

- Run `npm install` to ensure all dependencies are installed
- Delete `.next` folder and rebuild: `rm -rf .next && npm run build`

### Database Errors

- Verify schema was executed correctly in Supabase
- Check that RLS policies are enabled
- Ensure service role key is used for inserts

## Security Considerations

1. **Never expose service role key** - Only use in server-side code
2. **Enable RLS** - Row Level Security is enabled by default
3. **Validate file uploads** - Check file types and sizes
4. **Rate limiting** - Consider adding rate limiting to prevent abuse
5. **HTTPS only** - Always use HTTPS in production

## Maintenance

### Viewing Submissions

Access submissions in Supabase:
1. Go to Table Editor
2. Select `submissions` table
3. View, filter, and export data

### Backing Up Data

1. Use Supabase's built-in backup features
2. Or export data regularly:
   ```sql
   SELECT * FROM submissions;
   ```

### Monitoring

- Monitor Vercel deployment logs
- Check Supabase logs for database errors
- Review Resend dashboard for email delivery

## Support

For issues or questions:
- Check the README.md file
- Review Supabase documentation
- Review Next.js documentation
- Contact your development team

## Next Steps

Consider adding:
- Admin dashboard to view submissions
- PDF generation for completed forms
- SMS notifications
- Multi-pet support (currently supports one pet)
- Multi-vehicle support (currently supports one vehicle)
