# Lobby Mode - Office Staff Workflow

## What is Lobby Mode?

**Lobby mode** refers to office staff filling out digital forms on behalf of tenants who visit the office in person. This is distinct from tenants submitting forms online themselves.

## How It Works

1. **Tenant visits office** - They may not have internet access, prefer in-person service, or need assistance
2. **Staff opens form** - Office staff navigates to the appropriate form (e.g., `/pet-approval`, `/guest-disclosure`)
3. **Staff fills out form** - Information is collected from the tenant and entered by staff
4. **Form is submitted** - Data is saved to database
5. **PDF is generated** - A completed PDF document is automatically created with all collected information
6. **PDF is printed/stored** - Document can be printed for tenant signature or stored digitally

## All Forms Support Lobby Mode

The following forms all support lobby mode with automatic PDF generation:

### Compliance Forms
- Pet Approval Request (`/pet-approval`)
- Extended Guest Disclosure (`/guest-disclosure`)
- Common Area Violation Warning (`/common-area-violation`)
- Unauthorized Pet Notice (`/unauthorized-pet`)
- Smoke Detector Inspection (`/smoke-detector`)

### Property Management Forms
- Move-In Inspection (`/move-in-inspection`)
- Maintenance Request (`/maintenance-request`)

### Finance Forms
- Billing Dispute (`/billing-dispute`)
- Reimbursement Request (`/reimbursement`)
- Bulk Disposal Request (`/bulk-disposal`)

## Important: PDF Generation

When forms are submitted (either online or via lobby mode), the system automatically:

1. **Saves all data** to the database
2. **Generates PDF documents** with all collected information including:
   - Tenant name
   - Building address
   - Unit number
   - All form-specific data (pet details, vehicle info, etc.)
   - Signatures
   - Photos/attachments
3. **Stores PDFs** in Supabase storage for retrieval

## Field Name Consistency

All PDF generators now support multiple field name variations to ensure data appears correctly:
- `tenantName` / `fullName` / `full_name` / `tenant_name`
- `buildingAddress` / `building_address`
- `unitNumber` / `unit_number`

This ensures that regardless of which form is used or how it's submitted, all collected information will appear in the printed PDF version.
