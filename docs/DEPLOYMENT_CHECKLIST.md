# Deployment Checklist

Use this checklist before deploying to production.

## Pre-Deployment

### Code Review
- [ ] All TypeScript errors resolved
- [ ] No console.log statements in production code
- [ ] Error handling implemented for all API routes
- [ ] Form validation working correctly
- [ ] All translations complete and accurate

### Environment Setup
- [ ] Supabase project created
- [ ] Database schema executed successfully
- [ ] Storage bucket created with folders
- [ ] Resend account created and verified
- [ ] Domain verified in Resend (if using custom domain)

### Configuration
- [ ] All environment variables documented
- [ ] `.env.local.example` file updated
- [ ] `.gitignore` includes `.env.local`
- [ ] Vercel environment variables configured
- [ ] `ADMIN_PASSWORD_HASH` set for target environment(s) (Production/Preview)
- [ ] `SESSION_SECRET` set and 32+ characters
- [ ] `ADMIN_PASSWORD` only set if temporary migration fallback is intentionally enabled

### Testing
- [ ] Form submission works in development
- [ ] File uploads work correctly
- [ ] Signatures save properly
- [ ] Email confirmations send successfully
- [ ] All three languages tested
- [ ] Mobile responsive design verified
- [ ] Cross-browser testing completed (Chrome, Firefox, Safari, Edge)

### Security
- [ ] Service role key never exposed to client
- [ ] RLS policies enabled on Supabase
- [ ] File upload validation implemented
- [ ] CORS configured correctly
- [ ] HTTPS enforced in production

## Deployment

### Vercel Setup
- [ ] Repository connected to Vercel
- [ ] Environment variables added
- [ ] Environment variable scope verified (Production vs Preview)
- [ ] Redeploy triggered after any auth env change (`ADMIN_PASSWORD_HASH`, `ADMIN_PASSWORD`, `SESSION_SECRET`)
- [ ] Build succeeds without errors
- [ ] Preview deployment tested

### Domain Configuration
- [ ] Custom domain added (if applicable)
- [ ] DNS records configured
- [ ] SSL certificate active
- [ ] Domain redirects working

### Post-Deployment Testing
- [ ] Production URL accessible
- [ ] Form submission works in production
- [ ] `POST /api/admin/auth` rejects invalid password
- [ ] `POST /api/admin/auth` accepts valid password and admin session is created
- [ ] Admin logout (`DELETE /api/admin/auth`) clears session
- [ ] Files upload to Supabase storage
- [ ] Database records created correctly
- [ ] Emails send successfully
- [ ] All pages load without errors
- [ ] No console errors in browser

## Post-Deployment

### Monitoring Setup
- [ ] Vercel analytics enabled
- [ ] Error tracking configured
- [ ] Uptime monitoring set up
- [ ] Email delivery monitoring active

### Documentation
- [ ] README.md updated with production URL
- [ ] Setup guide reviewed and accurate
- [ ] Team trained on form management
- [ ] Support contact information added

### Backup & Recovery
- [ ] Database backup schedule configured
- [ ] Storage backup plan in place
- [ ] Recovery procedure documented
- [ ] Test restore performed

### Performance
- [ ] Page load time acceptable (<3 seconds)
- [ ] Form submission time reasonable
- [ ] File upload speed acceptable
- [ ] Mobile performance verified

## Ongoing Maintenance

### Weekly
- [ ] Check for failed submissions
- [ ] Review error logs
- [ ] Monitor email delivery rates
- [ ] Check storage usage

### Monthly
- [ ] Review and export submissions
- [ ] Update dependencies if needed
- [ ] Review and optimize database queries
- [ ] Check for security updates

### Quarterly
- [ ] Full backup and restore test
- [ ] Security audit
- [ ] Performance review
- [ ] User feedback review

## Emergency Contacts

- **Vercel Support**: https://vercel.com/support
- **Supabase Support**: https://supabase.com/support
- **Resend Support**: https://resend.com/support
- **Development Team**: [Add contact info]

## Rollback Plan

If issues occur after deployment:

1. **Immediate**: Revert to previous Vercel deployment
2. **Database**: Restore from latest backup if needed
3. **Communication**: Notify users of any downtime
4. **Investigation**: Review logs to identify issue
5. **Fix**: Implement fix in development
6. **Test**: Thoroughly test before redeploying
7. **Deploy**: Redeploy with fix

## Sign-Off

- [ ] Technical Lead Approval: _________________ Date: _______
- [ ] Project Manager Approval: _________________ Date: _______
- [ ] Client Approval: _________________ Date: _______

---

**Deployment Date**: _________________
**Deployed By**: _________________
**Production URL**: _________________
