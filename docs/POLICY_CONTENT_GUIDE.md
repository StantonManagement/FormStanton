# Policy Content Guide

This document describes all the informational content sections added to the tenant onboarding form.

## Overview

The form now includes comprehensive educational content about Stanton Management's new policies. All content is displayed in the user's selected language (English, Spanish, or Portuguese).

## Content Sections

### 1. Introduction Section (After Language Selector)

**Location**: Immediately after language selection, before resident information

**Content**:
- Welcome message explaining Stanton Management is now managing the building
- "WHAT IS CHANGING:" heading
- Three key policy changes:
  - Pet registration requirements and fees
  - Renters insurance requirement
  - New parking permits

**Styling**: Blue info box with left border accent

---

### 2. Pet Policy Section

**Location**: Before the "Do you have pets?" question

**Content**:
- **Policy Heading**: "PET POLICY"
- **Policy Text**: 
  - All tenants must confirm pet status
  - Registration requirements for dogs and cats
  - Small caged animals don't require registration
  - Prohibited animals list
  - Deadline: February 28th
  - Penalty for unregistered pets: $500 + back-owed rent

**Pet Rent Table**:
| Pet Type | Weight | Monthly Rent | One-Time Fee |
|----------|--------|--------------|--------------|
| Cat | N/A | $25 | $150 |
| Small Dog | Under 25 lbs | $25 | $200 |
| Medium Dog | 25-50 lbs | $35 | $250 |
| Large Dog | 50+ lbs | $45 | $300 |

**Styling**: Amber/yellow info box with table in white bordered container

---

### 3. Renters Insurance Section

**Location**: Before the "Do you have insurance?" question

**Content**:
- **Policy Heading**: "RENTERS INSURANCE"
- **Why Section**: Explains what insurance protects (belongings, liability, etc.)
- **Cost**: $10-25 per month
- **Deadline**: February 17th
- **Option 1**: Get your own insurance
  - Requirements: address, $100k-$300k liability, building LLC as Additional Insured
- **Option 2**: Management can add to rent via Appfolio

**LLC Table** (shown when user selects "Yes" to having insurance):
- Complete table of all 11 buildings with their corresponding LLCs
- Additional Insured Address: 421 Park St, Hartford CT 06106

**Styling**: Green info box with nested white boxes for options, yellow box for LLC table

---

### 4. Parking & Vehicle Section

**Location**: Before the "Do you have a vehicle?" question

**Content**:
- **Policy Heading**: "PARKING PERMITS & FEES"
- **Intro**: $50/month per vehicle, max 3 vehicles per household
- **Three-Step Process**:
  - Step 1: Submit vehicle info by Feb 8th
  - Step 2: Sign parking agreement (sent Feb 9th)
  - Step 3: Pick up permit Feb 17-20, 10 AM - 6:30 PM
    - Requirements: ID, insurance proof, pet registration
- **Deadlines Summary**: All key dates listed
- **Warning**: Vehicles towed after Feb 28th without permit
- **Display Requirement**: Upper driver's side windshield

**Parking Fee Table**:
| Vehicle Type | Monthly Fee |
|--------------|-------------|
| Moped, motorcycle, ATV, scooter | $20 |
| Sedan, SUV, Pickup (under 20 ft) | $50 |
| Oversized vehicles (over 20 ft) | $60 |
| Boats, trailers, equipment | $60+ (approval required) |

**Styling**: Purple info box with nested sections, red warning box, table in white bordered container

---

## Design Features

### Color Coding
- **Blue**: Introduction/general info
- **Amber/Yellow**: Pet policies and warnings
- **Green**: Insurance information
- **Purple**: Parking/vehicle information
- **Red**: Critical warnings and deadlines

### Mobile Optimization
- Responsive padding: `p-3 sm:p-4`
- Responsive text sizes: `text-sm`
- Whitespace handling: `whitespace-pre-line` for formatted text
- Tables: Horizontally scrollable on small screens
- Proper spacing between sections

### Typography
- **Headings**: Bold, larger text
- **Subheadings**: Semibold, smaller
- **Body text**: Regular weight, gray-700
- **Deadlines**: Bold, red-600 for emphasis
- **Warnings**: Bold, red-800 on red-50 background

### Accessibility
- Clear visual hierarchy
- High contrast text
- Proper heading structure
- Readable font sizes (minimum 14px/text-sm)
- Color not sole indicator (borders, bold text)

---

## Translation Support

All content is fully translated into three languages:
- **English** (en)
- **Spanish** (es)
- **Portuguese** (pt)

### Translation Files
- `lib/policyContent.ts` - All policy text content
- `lib/translations.ts` - Form labels and UI text

### Tables
- **Pet Rent Table**: Headers translated, data same
- **LLC Table**: English only (proper nouns)
- **Parking Fee Table**: Headers translated, data same

---

## Content Updates

To update policy content:

1. **Edit translations**: `lib/policyContent.ts`
2. **Update tables**: Modify table arrays in same file
3. **Change deadlines**: Update date strings in policy text
4. **Add new sections**: Follow existing pattern with color-coded boxes

### Example: Update Deadline
```typescript
// In lib/policyContent.ts
insuranceDeadline: "Deadline: February 17th", // Change date here
```

### Example: Update Fee
```typescript
// In lib/policyContent.ts
export const petRentTable = [
  ["Cat", "N/A", "$30", "$150"], // Changed from $25 to $30
  // ...
];
```

---

## Testing Checklist

- [ ] All three languages display correctly
- [ ] Tables render properly on mobile
- [ ] Content is readable without horizontal scroll
- [ ] Color coding is consistent
- [ ] Deadlines are highlighted
- [ ] Tables have proper borders and spacing
- [ ] Text wraps properly in narrow viewports
- [ ] No content overlap or cutoff
- [ ] Links/references are accurate
- [ ] LLC table shows correct building mappings

---

## Future Enhancements

### Potential Additions
- [ ] Collapsible sections for long content
- [ ] "Read more" links for detailed policies
- [ ] Print-friendly version
- [ ] PDF download of policies
- [ ] Video explanations (embedded)
- [ ] FAQ section
- [ ] Live chat support link
- [ ] Policy effective date display

### Accessibility Improvements
- [ ] Screen reader optimization
- [ ] Keyboard navigation for tables
- [ ] ARIA labels for info boxes
- [ ] Skip links for long content

---

## Support

For questions about policy content:
- **Technical**: Check `lib/policyContent.ts`
- **Design**: See color coding and styling sections above
- **Translations**: Verify all three languages in policy content file
- **Updates**: Follow content update procedures above
