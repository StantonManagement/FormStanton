# Tenant Onboarding Form - Stanton Management

A multilingual (English, Spanish, Portuguese) tenant onboarding form built with Next.js, Supabase, and deployed on Vercel.

## Features

- **Multilingual Support**: English, Spanish, and Portuguese translations
- **Pet Registration**: Capture pet details, photos, vaccination records, and signatures
- **Insurance Tracking**: Collect renters insurance information or opt-in for management-provided coverage
- **Vehicle Registration**: Register vehicles for parking permits with digital signatures
- **Digital Signatures**: React Signature Canvas for legal agreement signatures
- **File Uploads**: Support for vaccination records, insurance documents, and pet photos
- **Automated Document Generation**: Creates filled Word documents from templates with embedded signatures
- **Email Confirmations**: Automatic confirmation emails via Resend
- **Audit Trail**: IP address and user agent tracking for submissions

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **Email**: Resend
- **Styling**: Tailwind CSS
- **Signatures**: react-signature-canvas
- **Document Generation**: docxtemplater + pizzip
- **AI Extraction**: Anthropic Claude (for scan processing)
- **Deployment**: Vercel

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the SQL schema in `supabase/schema.sql` in the Supabase SQL Editor
3. Create a storage bucket named `submissions` with the following folders:
   - `vaccinations/`
   - `pet_photos/`
   - `insurance/`
   - `signatures/`
   - `documents/` (for generated Word documents)

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory with all required variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Email Service
RESEND_API_KEY=your_resend_api_key

# Admin Authentication
ADMIN_PASSWORD=your_secure_admin_password
SESSION_SECRET=your_session_secret_at_least_32_characters_long

# AI Services (for scan extraction feature)
ANTHROPIC_API_KEY=your_anthropic_api_key
```

**Getting your keys:**
- **Supabase**: Project Settings → API
  - `NEXT_PUBLIC_SUPABASE_URL`: Your project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public anon key (safe for client-side)
  - `SUPABASE_SERVICE_ROLE_KEY`: Service role key (server-side only, bypasses RLS)
- **Resend**: Sign up at [resend.com](https://resend.com) and create an API key for email sending
- **Admin Password**: Choose a strong password for admin dashboard access
- **Session Secret**: Generate a random 32+ character string for session encryption
- **Anthropic**: Sign up at [anthropic.com](https://anthropic.com) for Claude API access (used for scan extraction feature)

**Note**: Copy `.env.local.example` as a template and fill in your values.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the form.

### 5. Deploy to Vercel

1. Push your code to GitHub
2. Import the repository in Vercel
3. Add the environment variables in Vercel project settings
4. Deploy

## Building Options

The form includes:

### Resident Information
- Full name
- Phone number (with new number indicator)
- Building address (dropdown)
- Unit number

### Pet Section
- Yes/No question
- If yes: type, name, breed, weight, color, spayed/neutered status
- Vaccination records upload
- Pet photo upload
- Digital signature on Pet Addendum

### Insurance Section
- Yes/No question
- If yes: provider name, policy number, proof upload
- If no: option to add insurance to rent
- Displays building LLC for Additional Insured

### Vehicle Section
- Yes/No question
- If yes: make, model, year, color, license plate
- Digital signature on Vehicle and Parking Addendum

### Final Confirmation
- Checkbox confirming accuracy
- Submit button

## Database Schema

See `supabase/schema.sql` for the complete database structure.

## Building Data

The form includes 11 buildings with their corresponding LLCs:
- 31-33 Park St → SREP Park 1 LLC
- 57 Park St → SREP Park 4 LLC
- 67-73 Park St → SREP Park 2 LLC
- 83-91 Park St → SREP Park 3 LLC
- 10 Wolcott St → SREP Park 5 LLC
- 144-146 Affleck St → SREP Park 7 LLC
- 178 Affleck St → SREP Park 7 LLC
- 182 Affleck St → SREP Park 7 LLC
- 190 Affleck St → SREP Park 7 LLC
- 179 Affleck St → SREP Park 6 LLC
- 195 Affleck St → SREP Park 8 LLC

## Document Generation

The system automatically generates Word documents from templates:
- **Pet Addendum**: For tenants with pets (includes pet details and signature)
- **No Pets Addendum**: For tenants without pets (confirmation signature)
- **Vehicle Addendum**: For tenants with vehicles (includes vehicle details and signature)

Documents are stored in Supabase storage and paths are saved in the database. See `DOCUMENT_GENERATION.md` for detailed information.

## Future Enhancements

- [ ] PDF conversion of generated Word documents
- [ ] Combine multiple addendums into single PDF
- [ ] Attach generated documents to confirmation email
- [ ] Admin dashboard to view submissions and download documents
- [ ] Export submissions to CSV
- [ ] SMS notifications via Twilio

## License

Proprietary - Stanton Management
