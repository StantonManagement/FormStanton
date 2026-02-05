# Admin Dashboard Guide

## Overview

The admin dashboard provides a secure interface for viewing, filtering, and exporting tenant form submissions.

## Access

- **URL**: `/admin`
- **Authentication**: Password-protected with session-based authentication

## Features

### 1. Authentication

- Simple password gate on first access
- Session persists for 24 hours
- Logout button available in the header

### 2. Submissions Table

The main table displays all form submissions with the following columns:

- **Date**: Submission date
- **Name**: Tenant's full name
- **Phone**: Contact phone number
- **Email**: Contact email address
- **Building**: Building address
- **Unit**: Unit number
- **Pets**: Yes/No badge (blue for yes, gray for no)
- **Insurance**: Status badge with colors:
  - Green: Uploaded
  - Yellow: Pending upload
  - Purple: Added to rent
  - Gray: N/A
- **Vehicle**: Yes/No badge (blue for yes, gray for no)

### 3. Filtering

Filter submissions by:

- **Building Address**: Dropdown of all buildings with submissions
- **Date Range**: Start and end date filters
- **Has Pets**: All / Yes / No
- **Needs Insurance**: All / Pending Upload

The submission count updates dynamically as filters are applied.

### 4. Submission Details

Click on any row to view detailed information in a modal:

- **Basic Information**: All contact and unit details
- **Pet Information**: Complete pet details, vaccination records, photos, and signatures
- **Insurance Information**: Provider, policy number, upload status, and proof documents
- **Vehicle Information**: Vehicle details and signatures
- **Generated Documents**: Links to download pet/vehicle addendums
- **Technical Information**: Submission ID and IP address

### 5. File Access

All uploaded files are accessible through the detail modal:

- Vaccination records
- Pet photos
- Insurance proof documents
- Signature images (displayed inline)
- Generated addendum documents

### 6. Excel Export

Click the "Export to Excel" button to download submissions data:

- **Filename**: `tenant_submissions_YYYY-MM-DD.xlsx`
- **Content**: All visible submissions (respects active filters)
- **Columns**: All database fields formatted for readability
- **File URLs**: Includes full URLs to uploaded files
- **Formatting**: Proper column widths and date formatting

## Setup Instructions

### 1. Environment Variables

Add to your `.env.local` file:

```env
ADMIN_PASSWORD=your_secure_admin_password
SESSION_SECRET=your_session_secret_at_least_32_characters_long
```

**Important**: 
- Choose a strong admin password
- The session secret must be at least 32 characters long
- Never commit these values to version control

### 2. Database Permissions

The admin dashboard uses the Supabase service role key to access submissions. Ensure your `.env.local` has:

```env
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 3. Dependencies

The following packages are required (already installed):

- `xlsx`: Excel file generation
- `iron-session`: Secure session management

## API Routes

### Authentication

- `POST /api/admin/auth`: Login with password
- `GET /api/admin/auth`: Check authentication status
- `DELETE /api/admin/auth`: Logout

### Data Access

- `GET /api/admin/submissions`: Fetch all submissions with optional filters
- `GET /api/admin/buildings`: Get list of unique building addresses
- `GET /api/admin/file?path=<path>`: Download files from Supabase storage

## Security Features

1. **Password Protection**: Simple password gate prevents unauthorized access
2. **Session Management**: Secure, HTTP-only cookies with 24-hour expiration
3. **Server-Side Authentication**: All API routes verify authentication before serving data
4. **File Access Control**: Files can only be accessed by authenticated admin users

## Future Enhancements

Consider adding:

- Multi-user authentication with roles
- Email notifications for new submissions
- Bulk actions (delete, export selected)
- Advanced search functionality
- Submission editing capabilities
- Analytics and reporting dashboard

## Troubleshooting

### Cannot Login

- Verify `ADMIN_PASSWORD` is set in `.env.local`
- Check browser console for errors
- Ensure session secret is at least 32 characters

### Files Not Loading

- Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
- Check Supabase storage bucket permissions
- Ensure files were uploaded successfully during submission

### Export Not Working

- Check browser console for errors
- Verify `xlsx` package is installed
- Ensure submissions data is loading correctly

## Technical Details

### File Structure

```
app/
├── admin/
│   └── page.tsx                    # Main admin dashboard page
├── api/
│   └── admin/
│       ├── auth/
│       │   └── route.ts            # Authentication endpoints
│       ├── submissions/
│       │   └── route.ts            # Submissions data endpoint
│       ├── buildings/
│       │   └── route.ts            # Buildings list endpoint
│       └── file/
│           └── route.ts            # File download endpoint
components/
└── SubmissionDetailModal.tsx       # Submission detail modal component
lib/
├── auth.ts                         # Authentication utilities
└── excelExport.ts                  # Excel export functionality
```

### Session Configuration

Sessions are configured with:
- Cookie name: `admin_session`
- Max age: 24 hours (86400 seconds)
- HTTP-only: Yes
- Secure: Yes (production only)

### Data Flow

1. User enters password → `POST /api/admin/auth`
2. Session created and stored in cookie
3. Admin page loads → `GET /api/admin/auth` (verify session)
4. Fetch submissions → `GET /api/admin/submissions`
5. Fetch buildings → `GET /api/admin/buildings`
6. Click row → Open detail modal
7. Click file link → `GET /api/admin/file?path=...`
8. Click export → Generate Excel file client-side
