---
entity_type: project
name: FormsStanton
display_name: Stanton Management Tenant Onboarding Platform
summary: A multilingual digital tenant onboarding system that streamlines pet registration, insurance verification, vehicle permits, and automated document generation for property management operations across 11 residential buildings.
owner: Stanton Management
status: active
lifecycle_stage: Operate
category: Property Management Operations
tool_type: unknown
vendor: internal
priority: high
infrastructure_layer: presentation
user_facing: true
repository: unknown
primary_url: unknown
environment: production
used_by:
  - Stanton Management tenants
  - Property management staff
  - Compliance administrators
depends_on:
  - Supabase
  - Vercel
  - Resend
  - Anthropic Claude API
  - Next.js
integrates_with:
  - Supabase PostgreSQL
  - Supabase Storage
  - Resend Email API
  - Anthropic Claude
data_sources:
  - Tenant submissions
  - Building asset registry
  - Historical vehicle data
  - Rent roll imports
data_inputs:
  - Tenant personal information
  - Pet details and vaccination records
  - Insurance policy information
  - Vehicle registration data
  - Digital signatures
  - Document scans
outputs:
  - Generated Word documents (Pet/Vehicle/No-Pet Addendums)
  - Email confirmations
  - Compliance reports
  - Submission audit trails
data_outputs:
  - Supabase database records
  - Supabase storage files
  - Email notifications
  - CSV exports
tags:
  - property-management
  - tenant-onboarding
  - multilingual
  - document-automation
  - compliance
  - digital-signatures
last_updated: 2026-03-09
---

# Stanton Management Tenant Onboarding Platform

## Overview
FormsStanton is a production web application that digitizes the tenant onboarding process for Stanton Management's 11-building residential portfolio. The platform provides multilingual forms (English, Spanish, Portuguese) for collecting tenant information, pet registrations, insurance verification, and vehicle permits. It automates document generation, maintains compliance records, and provides administrative dashboards for property management staff.

## Purpose
The platform eliminates paper-based tenant onboarding by providing a secure, accessible digital workflow that ensures compliance with lease addendum requirements, maintains audit trails, and reduces administrative overhead. It supports property managers in tracking pet approvals, insurance coverage, parking permits, and generating legally-binding addendum documents with embedded digital signatures.

## Lifecycle Placement
**Operate** - This is a live production system actively used by tenants and property management staff for daily onboarding operations. The platform is mature, stable, and undergoing continuous enhancement with features like compliance dashboards, scan imports, and mobile optimizations.

## Current Status
**Active** - The platform is in production use with tenants submitting onboarding forms daily. Recent enhancements include institutional redesign, mobile optimizations, compliance tracking, duplicate submission detection, and AI-powered scan extraction for historical data migration.

## Users and Stakeholders
- **Primary Users**: New and existing tenants across 11 buildings submitting onboarding information
- **Administrators**: Property management staff accessing compliance dashboards and form libraries
- **Compliance Team**: Staff monitoring pet approvals, insurance verification, and parking permits
- **Owner**: Stanton Management organization

## Dependencies
- **Next.js 16**: React framework with App Router architecture
- **Supabase**: PostgreSQL database and file storage backend
- **Vercel**: Hosting and deployment platform
- **Resend**: Transactional email service for confirmations
- **Anthropic Claude API**: AI-powered document scan extraction
- **React Signature Canvas**: Digital signature capture
- **Docxtemplater**: Word document template generation
- **Tailwind CSS**: Styling framework
- **Iron Session**: Secure session management
- **Sharp**: Image processing

## Integrations
**Inbound**:
- Tenant form submissions via web interface
- Historical data imports (Excel rent rolls, CSV vehicle records)
- Scanned document processing via Claude API
- Admin authentication via iron-session

**Outbound**:
- Email notifications via Resend API
- Document storage to Supabase Storage buckets
- Database writes to Supabase PostgreSQL
- Generated Word documents with embedded signatures

## Inputs
- Tenant personal information (name, phone, building, unit)
- Pet details (type, breed, weight, photos, vaccination records)
- Insurance policies (provider, policy number, proof documents)
- Vehicle information (make, model, year, license plate)
- Digital signatures for legal addendums
- Historical data imports (Excel/CSV files)
- Scanned paper forms for AI extraction

## Outputs
- **Generated Documents**: Pet Addendum, No-Pet Addendum, Vehicle Addendum (DOCX format with embedded signatures)
- **Email Confirmations**: Automated tenant confirmation emails
- **Compliance Reports**: Dashboard views of pending approvals and missing documentation
- **Audit Trails**: IP addresses, timestamps, user agents for all submissions
- **CSV Exports**: Submission data exports for analysis
- **Duplicate Detection**: Accordion views of potential duplicate submissions

## Operational Notes
**Constraints**:
- Requires environment variables for Supabase, Resend, Anthropic, and admin credentials
- Storage bucket structure must match schema (vaccinations/, pet_photos/, insurance/, signatures/, documents/)
- Building asset IDs must align with Supabase asset registry
- Session secret must be 32+ characters for iron-session

**Maintenance**:
- Database migrations tracked in `supabase/migrations/`
- Schema updates require coordination with production data
- Document templates stored as DOCX files in project root
- Mobile styles maintained separately in `mobile-styles.css`

**Security**:
- Admin dashboard protected by bcrypt-hashed passwords
- Service role key used server-side only (bypasses RLS)
- File uploads validated and scanned
- Audit trails capture IP and user agent data

**Support Notes**:
- Comprehensive documentation in markdown files (SETUP_GUIDE.md, DESIGN_SYSTEM.md, etc.)
- Tab navigation implementation for accessibility
- Print styling for generated documents
- Tenant verification via building/unit lookup

## NavChart Mapping Notes
- **Name**: FormsStanton
- **Entity Type**: project
- **Lifecycle Stage**: Operate
- **Status**: active
- **User Facing**: true
- **Owner**: Stanton Management
- **Depends On**: Supabase, Vercel, Resend, Anthropic Claude API, Next.js
- **Integrates With**: Supabase PostgreSQL, Supabase Storage, Resend Email API, Anthropic Claude
- **Used By**: Stanton Management tenants, Property management staff, Compliance administrators
- **Infrastructure Layer**: presentation
- **Supports Projects**: unknown
