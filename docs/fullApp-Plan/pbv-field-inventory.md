# PBV Application Package — Field Inventory

**Source:** Full Application Package (5-28-2025 bilingual).pdf — HACH HCV packet, 40 pages, bilingual EN/ES
**Extracted:** Visual inspection of EN pages; ES pages mirror EN unless noted
**Forms in this packet:** 13 (12 in the PDF packet + zero_income_statement sourced separately from HACH)
**Forms NOT in this packet:** `vawa_certification` (HUD-5382), `reasonable_accommodation_request` — separate source needed

---

## main_application

EN pages: 1, 3, 5, 7, 9 | ES pages: 2, 4, 6, 8, 10

| field_name | field_type | label_on_form | page | position_hint | prefill_source | required | per_person_scope | trigger_form | trigger_upload | trigger_section | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| applicant_full_name | text_short | Name | 1 | top, first line after header block | intake.applicant.full_name | yes | head_of_household_only |  |  |  |  |
| applicant_email | email | Email Address | 1 | top right, same line as Name | intake.applicant.email | no | head_of_household_only |  |  |  |  |
| phone_home | phone | Phone Numbers – Home | 1 | second line, left | intake.applicant.phone | no | head_of_household_only |  |  |  | one of home/work/cell expected |
| phone_work | phone | Work | 1 | second line, middle | fresh_input | no | head_of_household_only |  |  |  |  |
| phone_cell | phone | Cell | 1 | second line, right | intake.applicant.phone | no | head_of_household_only |  |  |  |  |
| address_street | address | Address | 1 | third line, left | intake.applicant.address | yes | submission_level |  |  |  |  |
| address_city_state_zip | address | City, ST, Zip | 1 | third line, right | intake.applicant.address | yes | submission_level |  |  |  |  |
| alternate_contact_name | text_short | Provide an alternate contact name | 1 | fourth line, left | fresh_input | no | submission_level |  |  |  |  |
| alternate_contact_phone | phone | Phone Number | 1 | fourth line, right | fresh_input | no | submission_level |  |  |  |  |
| race_white | checkbox | White | 1 | Section I, Race row, option 1 | intake.applicant.race | yes | head_of_household_only |  |  |  | radio group with 6 options |
| race_african_american | checkbox | African American | 1 | Section I, Race row, option 2 | intake.applicant.race | yes | head_of_household_only |  |  |  |  |
| race_native_american | checkbox | Native American | 1 | Section I, Race row, option 3 | intake.applicant.race | yes | head_of_household_only |  |  |  |  |
| race_asian | checkbox | Asian | 1 | Section I, Race row, option 4 | intake.applicant.race | yes | head_of_household_only |  |  |  |  |
| race_pacific_islander | checkbox | Pacific Islander | 1 | Section I, Race row, option 5 | intake.applicant.race | yes | head_of_household_only |  |  |  |  |
| race_other | checkbox | Other | 1 | Section I, Race row, option 6 | intake.applicant.race | no | head_of_household_only |  |  |  | triggers race_other_text |
| race_other_text | text_short | Other: ___ | 1 | Section I, Race row, after Other checkbox | fresh_input | no | head_of_household_only |  |  |  | conditional on race_other |
| hispanic_yes | checkbox | Yes | 1 | Section I, "Are you Hispanic or Latin?" | intake.applicant.ethnicity | yes | head_of_household_only |  |  |  | radio pair |
| hispanic_no | checkbox | No | 1 | same line as hispanic_yes | intake.applicant.ethnicity | yes | head_of_household_only |  |  |  |  |
| marital_single | checkbox | Single | 1 | Section I, marital status line | intake.applicant.marital_status | yes | head_of_household_only |  |  |  | radio group of 4 |
| marital_married | checkbox | Married | 1 | same line | intake.applicant.marital_status | yes | head_of_household_only |  |  |  |  |
| marital_separated | checkbox | Separated | 1 | same line | intake.applicant.marital_status | yes | head_of_household_only |  |  |  |  |
| marital_divorced | checkbox | Divorced | 1 | same line | intake.applicant.marital_status | yes | head_of_household_only |  |  |  |  |
| adult_last_name | text_short | Last | 1 | Adults table, col 1 | intake.household.member_list | yes | each_adult |  |  |  | Adults table repeats 6 rows; first row pre-marked SELF in Relationship col |
| adult_first_name | text_short | First | 1 | Adults table, col 2 | intake.household.member_list | yes | each_adult |  |  |  | repeats per adult row |
| adult_middle_initial | text_short | MI | 1 | Adults table, col 3 | intake.household.member_list | no | each_adult |  |  |  | repeats per adult row |
| adult_dob | date | Date Of Birth | 1 | Adults table, col 4 | intake.household.member_list | yes | each_adult |  |  |  | repeats per adult row |
| adult_ssn | ssn | Social Security # | 1 | Adults table, col 5 | intake.applicant.ssn / intake.household.member_list | yes | each_adult |  |  |  | repeats per adult row |
| adult_relationship | text_short | Relationship | 1 | Adults table, col 6 | intake.household.member_list | yes | each_adult |  |  |  | first row prefilled "SELF"; repeats per adult row |
| adult_disabled | radio | Disabled Yes/No | 1 | Adults table, col 7 | intake.household.member_list | yes | each_adult |  |  | section_vi_conditional | repeats per adult row |
| adult_student | radio | Student Yes/No | 1 | Adults table, col 8 | intake.household.member_list | yes | each_adult |  |  |  | repeats per adult row |
| adult_age | text_short | Age | 1 | Adults table, col 9 | intake.household.member_list | yes | each_adult |  |  | section_vi_conditional | repeats per adult row |
| adult_us_citizen | radio | U.S. Citizen Yes/No | 1 | Adults table, col 10 | intake.citizenship.<member> | yes | each_adult |  |  |  | repeats per adult row |
| school_fulltime_yes | checkbox | Yes | 1 | below adults table, "Does any adult family member attend school full-time?" | fresh_input | yes | submission_level |  | student_schedule_or_letter |  | radio pair |
| school_fulltime_no | checkbox | No | 1 | same line | fresh_input | yes | submission_level |  |  |  |  |
| school_fulltime_who | text_short | If yes, who? | 1 | same line, end | fresh_input | no | submission_level |  |  |  | conditional on school_fulltime_yes |
| minor_last_name | text_short | Last | 1 | Minors table, col 1 | intake.household.member_list | yes | individual |  |  |  | Minors table repeats 8 rows |
| minor_first_name | text_short | First | 1 | Minors table, col 2 | intake.household.member_list | yes | individual |  |  |  |  |
| minor_middle_initial | text_short | MI | 1 | Minors table, col 3 | intake.household.member_list | no | individual |  |  |  |  |
| minor_dob | date | Date Of Birth | 1 | Minors table, col 4 | intake.household.member_list | yes | individual |  |  |  |  |
| minor_ssn | ssn | Social Security # | 1 | Minors table, col 5 | intake.household.member_list | yes | individual |  |  |  |  |
| minor_relationship | text_short | Relationship | 1 | Minors table, col 6 | intake.household.member_list | yes | individual |  |  |  |  |
| minor_disabled | radio | Disabled Yes/No | 1 | Minors table, col 7 | intake.household.member_list | yes | individual |  |  |  |  |
| minor_student | radio | Student Yes/No | 1 | Minors table, col 8 | intake.household.member_list | yes | individual |  |  |  |  |
| minor_age | text_short | Age | 1 | Minors table, col 9 | intake.household.member_list | yes | individual |  |  |  |  |
| minor_us_citizen | radio | U.S. Citizen Yes/No | 1 | Minors table, col 10 | intake.citizenship.<member> | yes | individual |  |  |  |  |
| income_employed_yes | checkbox | Yes (Employed) | 3 | Section II income table, row "Employed" — 3 rows for 3 jobs | intake.income.employment | no | submission_level |  | paystubs |  | Income table; 3 employment rows |
| income_employed_no | checkbox | No (Employed) | 3 | same | intake.income.employment | no | submission_level |  |  |  |  |
| income_employed_member | text_short | Family Member | 3 | Section II, col Family Member | intake.income.employment | no | submission_level |  |  |  | per row |
| income_employed_source | text_short | Source | 3 | Section II, col Source | intake.income.employment | no | submission_level |  |  |  | per row |
| income_employed_amount | currency | Amount per Month | 3 | Section II, col Amount per Month | intake.income.employment | no | submission_level |  |  |  | per row |
| income_pension_yes | checkbox | Yes (Pension or Retirement) | 3 | Section II, row Pension/Retirement | intake.income.pension | no | submission_level |  | pension_award_letter |  | full row pattern: yes/no/member/source/amount |
| income_pension_no | checkbox | No | 3 | same | intake.income.pension | no | submission_level |  |  |  |  |
| income_pension_member | text_short | Family Member | 3 | same | intake.income.pension | no | submission_level |  |  |  |  |
| income_pension_source | text_short | Source | 3 | same | intake.income.pension | no | submission_level |  |  |  |  |
| income_pension_amount | currency | Amount per Month | 3 | same | intake.income.pension | no | submission_level |  |  |  |  |
| income_ssi_yes | checkbox | Yes (SSI) | 3 | Section II, SSI row (2 rows) | intake.income.ssi | no | submission_level |  | ssi_award_letter |  | 2 SSI rows |
| income_ssi_no | checkbox | No | 3 | same | intake.income.ssi | no | submission_level |  |  |  |  |
| income_ssi_member | text_short | Family Member | 3 | same | intake.income.ssi | no | submission_level |  |  |  | per row |
| income_ssi_source | text_short | Source | 3 | same | intake.income.ssi | no | submission_level |  |  |  | per row |
| income_ssi_amount | currency | Amount per Month | 3 | same | intake.income.ssi | no | submission_level |  |  |  | per row |
| income_ss_yes | checkbox | Yes (Social Security) | 3 | Section II, Social Security row (2 rows) | intake.income.social_security | no | submission_level |  | ss_award_letter |  | 2 SS rows |
| income_ss_no | checkbox | No | 3 | same | intake.income.social_security | no | submission_level |  |  |  |  |
| income_ss_member | text_short | Family Member | 3 | same | intake.income.social_security | no | submission_level |  |  |  | per row |
| income_ss_source | text_short | Source | 3 | same | intake.income.social_security | no | submission_level |  |  |  | per row |
| income_ss_amount | currency | Amount per Month | 3 | same | intake.income.social_security | no | submission_level |  |  |  | per row |
| income_railroad_yes | checkbox | Yes (Railroad Retirement) | 3 | Section II, Railroad Retirement row | intake.income.railroad | no | submission_level |  | railroad_award_letter |  |  |
| income_railroad_no | checkbox | No | 3 | same | intake.income.railroad | no | submission_level |  |  |  |  |
| income_railroad_member | text_short | Family Member | 3 | same | intake.income.railroad | no | submission_level |  |  |  |  |
| income_railroad_source | text_short | Source | 3 | same | intake.income.railroad | no | submission_level |  |  |  |  |
| income_railroad_amount | currency | Amount per Month | 3 | same | intake.income.railroad | no | submission_level |  |  |  |  |
| income_child_support_yes | checkbox | Yes (Child Support/Alimony) | 3 | Section II, Child Support row | intake.income.child_support | no | submission_level | child_support_affidavit | child_support_doc |  | drives child_support_affidavit vs no_child_support_affidavit |
| income_child_support_no | checkbox | No | 3 | same | intake.income.child_support | no | submission_level | no_child_support_affidavit |  |  |  |
| income_child_support_member | text_short | Family Member | 3 | same | intake.income.child_support | no | submission_level |  |  |  |  |
| income_child_support_source | text_short | Source | 3 | same | intake.income.child_support | no | submission_level |  |  |  |  |
| income_child_support_amount | currency | Amount per Month | 3 | same | intake.income.child_support | no | submission_level |  |  |  |  |
| income_tanf_yes | checkbox | Yes (TANF) | 3 | Section II, TANF row | intake.income.tanf | no | submission_level |  | tanf_benefit_letter |  |  |
| income_tanf_no | checkbox | No | 3 | same | intake.income.tanf | no | submission_level |  |  |  |  |
| income_tanf_member | text_short | Family Member | 3 | same | intake.income.tanf | no | submission_level |  |  |  |  |
| income_tanf_source | text_short | Source | 3 | same | intake.income.tanf | no | submission_level |  |  |  |  |
| income_tanf_amount | currency | Amount per Month | 3 | same | intake.income.tanf | no | submission_level |  |  |  |  |
| income_snap_yes | checkbox | Yes (Food Stamp/SNAP) | 3 | Section II, SNAP row | intake.income.snap | no | submission_level |  | snap_benefit_letter |  |  |
| income_snap_no | checkbox | No | 3 | same | intake.income.snap | no | submission_level |  |  |  |  |
| income_snap_member | text_short | Family Member | 3 | same | intake.income.snap | no | submission_level |  |  |  |  |
| income_snap_source | text_short | Source | 3 | same | intake.income.snap | no | submission_level |  |  |  |  |
| income_snap_amount | currency | Amount per Month | 3 | same | intake.income.snap | no | submission_level |  |  |  |  |
| income_self_employed_yes | checkbox | Yes (Self-Employed) | 3 | Section II, Self-Employed row | intake.income.self_employment | no | submission_level | self_employment_worksheet | tax_return_or_worksheet |  |  |
| income_self_employed_no | checkbox | No | 3 | same | intake.income.self_employment | no | submission_level |  |  |  |  |
| income_self_employed_member | text_short | Family Member | 3 | same | intake.income.self_employment | no | submission_level |  |  |  |  |
| income_self_employed_source | text_short | Source | 3 | same | intake.income.self_employment | no | submission_level |  |  |  |  |
| income_self_employed_amount | currency | Amount per Month | 3 | same | intake.income.self_employment | no | submission_level |  |  |  |  |
| income_unemployment_yes | checkbox | Yes (Unemployment) | 3 | Section II, Unemployment row (2 rows) | intake.income.unemployment | no | submission_level |  | unemployment_letter |  | 2 unemployment rows |
| income_unemployment_no | checkbox | No | 3 | same | intake.income.unemployment | no | submission_level |  |  |  |  |
| income_unemployment_member | text_short | Family Member | 3 | same | intake.income.unemployment | no | submission_level |  |  |  | per row |
| income_unemployment_source | text_short | Source | 3 | same | intake.income.unemployment | no | submission_level |  |  |  | per row |
| income_unemployment_amount | currency | Amount per Month | 3 | same | intake.income.unemployment | no | submission_level |  |  |  | per row |
| income_workers_comp_yes | checkbox | Yes (Worker's Comp) | 3 | Section II, Workers Comp row | intake.income.workers_comp | no | submission_level |  | workers_comp_letter |  |  |
| income_workers_comp_no | checkbox | No | 3 | same | intake.income.workers_comp | no | submission_level |  |  |  |  |
| income_workers_comp_member | text_short | Family Member | 3 | same | intake.income.workers_comp | no | submission_level |  |  |  |  |
| income_workers_comp_source | text_short | Source | 3 | same | intake.income.workers_comp | no | submission_level |  |  |  |  |
| income_workers_comp_amount | currency | Amount per Month | 3 | same | intake.income.workers_comp | no | submission_level |  |  |  |  |
| income_rental_yes | checkbox | Yes (Rental/Other Assets) | 3 | Section II, Rental Income row | intake.income.rental | no | submission_level |  | rental_contract |  |  |
| income_rental_no | checkbox | No | 3 | same | intake.income.rental | no | submission_level |  |  |  |  |
| income_rental_member | text_short | Family Member | 3 | same | intake.income.rental | no | submission_level |  |  |  |  |
| income_rental_source | text_short | Source | 3 | same | intake.income.rental | no | submission_level |  |  |  |  |
| income_rental_amount | currency | Amount per Month | 3 | same | intake.income.rental | no | submission_level |  |  |  |  |
| income_gifts_yes | checkbox | Yes (Regular Contributions/Gifts) | 3 | Section II, Contributions/Gifts row | intake.income.gifts | no | submission_level | gift_income_worksheet |  |  |  |
| income_gifts_no | checkbox | No | 3 | same | intake.income.gifts | no | submission_level |  |  |  |  |
| income_gifts_member | text_short | Family Member | 3 | same | intake.income.gifts | no | submission_level |  |  |  |  |
| income_gifts_source | text_short | Source | 3 | same | intake.income.gifts | no | submission_level |  |  |  |  |
| income_gifts_amount | currency | Amount per Month | 3 | same | intake.income.gifts | no | submission_level |  |  |  |  |
| income_paid_training_yes | checkbox | Yes (Paid Training) | 3 | Section II, Paid Training row | intake.income.paid_training | no | submission_level |  |  |  |  |
| income_paid_training_no | checkbox | No | 3 | same | intake.income.paid_training | no | submission_level |  |  |  |  |
| income_paid_training_member | text_short | Family Member | 3 | same | intake.income.paid_training | no | submission_level |  |  |  |  |
| income_paid_training_source | text_short | Source | 3 | same | intake.income.paid_training | no | submission_level |  |  |  |  |
| income_paid_training_amount | currency | Amount per Month | 3 | same | intake.income.paid_training | no | submission_level |  |  |  |  |
| income_grants_yes | checkbox | Yes (Grants/Scholarships) | 3 | Section II, Grants/Scholarships row | intake.income.grants | no | submission_level |  | school_letter |  |  |
| income_grants_no | checkbox | No | 3 | same | intake.income.grants | no | submission_level |  |  |  |  |
| income_grants_member | text_short | Family Member | 3 | same | intake.income.grants | no | submission_level |  |  |  |  |
| income_grants_source | text_short | Source | 3 | same | intake.income.grants | no | submission_level |  |  |  |  |
| income_grants_amount | currency | Amount per Month | 3 | same | intake.income.grants | no | submission_level |  |  |  |  |
| income_cashapp_yes | checkbox | Yes (CashApp/Zelle/Venmo/PayPal) | 3 | Section II, CashApp row | intake.income.digital_wallet | no | submission_level |  | digital_wallet_statements_3mo |  |  |
| income_cashapp_no | checkbox | No | 3 | same | intake.income.digital_wallet | no | submission_level |  |  |  |  |
| income_cashapp_member | text_short | Family Member | 3 | same | intake.income.digital_wallet | no | submission_level |  |  |  |  |
| income_cashapp_source | text_short | Source | 3 | same | intake.income.digital_wallet | no | submission_level |  |  |  |  |
| income_cashapp_amount | currency | Amount per Month | 3 | same | intake.income.digital_wallet | no | submission_level |  |  |  |  |
| income_other_yes | checkbox | Yes (Other) | 3 | Section II, Other row | intake.income.other | no | submission_level |  | other_income_doc |  |  |
| income_other_no | checkbox | No | 3 | same | intake.income.other | no | submission_level |  |  |  |  |
| income_other_member | text_short | Family Member | 3 | same | intake.income.other | no | submission_level |  |  |  |  |
| income_other_source | text_short | Source | 3 | same | intake.income.other | no | submission_level |  |  |  |  |
| income_other_amount | currency | Amount per Month | 3 | same | intake.income.other | no | submission_level |  |  |  |  |
| zero_income_name | text_short | Name | 3 | Section III, list of names | intake.household.member_list | no | each_adult | zero_income_statement |  | section_viii_conditional | adults claiming zero income; multiple rows |
| q1_outside_help_yes | checkbox | Yes | 3 | Section III, Q1 | fresh_input | yes | submission_level |  |  |  | "Does anyone outside the household assist you with bills?" |
| q1_outside_help_no | checkbox | No | 3 | same | fresh_input | yes | submission_level |  |  |  |  |
| q1_outside_help_explain | text_long | If yes, explain | 3 | end of page 3 | fresh_input | no | submission_level |  |  |  | conditional on q1_yes |
| q2_pending_benefits_yes | checkbox | Yes | 5 | top of page 5, Q2 | fresh_input | yes | submission_level |  |  |  | "Has anyone in your household applied for benefits that are in the process of being approved?" |
| q2_pending_benefits_no | checkbox | No | 5 | same | fresh_input | yes | submission_level |  |  |  |  |
| q2_pending_benefits_explain | text_long | If yes, explain | 5 | below Q2 | fresh_input | no | submission_level |  |  |  | conditional on q2_yes |
| asset_real_estate_yes | checkbox | Yes (Real Estate/Land) | 5 | Section IV assets table, Real Estate row | intake.assets.real_estate | no | submission_level |  | deed_or_tax_statement |  | Assets table — 10 rows: yes/no, member, source, amount each |
| asset_real_estate_no | checkbox | No | 5 | same | intake.assets.real_estate | no | submission_level |  |  |  |  |
| asset_real_estate_member | text_short | Family Member | 5 | same | intake.assets.real_estate | no | submission_level |  |  |  |  |
| asset_real_estate_source | text_short | Source | 5 | same | intake.assets.real_estate | no | submission_level |  |  |  |  |
| asset_real_estate_value | currency | Amount or Market Value | 5 | same | intake.assets.real_estate | no | submission_level |  |  |  |  |
| asset_stocks_yes | checkbox | Yes (Stocks) | 5 | Section IV, Stocks row | intake.assets.stocks | no | submission_level |  | bank_statement |  |  |
| asset_stocks_no | checkbox | No | 5 | same | intake.assets.stocks | no | submission_level |  |  |  |  |
| asset_stocks_member | text_short | Family Member | 5 | same | intake.assets.stocks | no | submission_level |  |  |  |  |
| asset_stocks_source | text_short | Source | 5 | same | intake.assets.stocks | no | submission_level |  |  |  |  |
| asset_stocks_value | currency | Amount or Market Value | 5 | same | intake.assets.stocks | no | submission_level |  |  |  |  |
| asset_savings_yes | checkbox | Yes (Savings Account) | 5 | Section IV, Savings row | intake.assets.savings | no | submission_level |  | bank_statements_3mo |  |  |
| asset_savings_no | checkbox | No | 5 | same | intake.assets.savings | no | submission_level |  |  |  |  |
| asset_savings_member | text_short | Family Member | 5 | same | intake.assets.savings | no | submission_level |  |  |  |  |
| asset_savings_source | text_short | Source | 5 | same | intake.assets.savings | no | submission_level |  |  |  |  |
| asset_savings_value | currency | Amount or Market Value | 5 | same | intake.assets.savings | no | submission_level |  |  |  |  |
| asset_checking_yes | checkbox | Yes (Checking Account) | 5 | Section IV, Checking row | intake.assets.checking | no | submission_level |  | bank_statements_3mo |  |  |
| asset_checking_no | checkbox | No | 5 | same | intake.assets.checking | no | submission_level |  |  |  |  |
| asset_checking_member | text_short | Family Member | 5 | same | intake.assets.checking | no | submission_level |  |  |  |  |
| asset_checking_source | text_short | Source | 5 | same | intake.assets.checking | no | submission_level |  |  |  |  |
| asset_checking_value | currency | Amount or Market Value | 5 | same | intake.assets.checking | no | submission_level |  |  |  |  |
| asset_insurance_settlement_yes | checkbox | Yes (Insurance Settlement) | 5 | Section IV, Insurance Settlement row | intake.assets.insurance_settlement | no | submission_level |  | settlement_letter |  |  |
| asset_insurance_settlement_no | checkbox | No | 5 | same | intake.assets.insurance_settlement | no | submission_level |  |  |  |  |
| asset_insurance_settlement_member | text_short | Family Member | 5 | same | intake.assets.insurance_settlement | no | submission_level |  |  |  |  |
| asset_insurance_settlement_source | text_short | Source | 5 | same | intake.assets.insurance_settlement | no | submission_level |  |  |  |  |
| asset_insurance_settlement_value | currency | Amount or Market Value | 5 | same | intake.assets.insurance_settlement | no | submission_level |  |  |  |  |
| asset_cd_yes | checkbox | Yes (Certificate of Deposit) | 5 | Section IV, CD row | intake.assets.cd | no | submission_level |  | bank_statement |  |  |
| asset_cd_no | checkbox | No | 5 | same | intake.assets.cd | no | submission_level |  |  |  |  |
| asset_cd_member | text_short | Family Member | 5 | same | intake.assets.cd | no | submission_level |  |  |  |  |
| asset_cd_source | text_short | Source | 5 | same | intake.assets.cd | no | submission_level |  |  |  |  |
| asset_cd_value | currency | Amount or Market Value | 5 | same | intake.assets.cd | no | submission_level |  |  |  |  |
| asset_trust_yes | checkbox | Yes (Trust) | 5 | Section IV, Trust row | intake.assets.trust | no | submission_level |  | bank_statement |  |  |
| asset_trust_no | checkbox | No | 5 | same | intake.assets.trust | no | submission_level |  |  |  |  |
| asset_trust_member | text_short | Family Member | 5 | same | intake.assets.trust | no | submission_level |  |  |  |  |
| asset_trust_source | text_short | Source | 5 | same | intake.assets.trust | no | submission_level |  |  |  |  |
| asset_trust_value | currency | Amount or Market Value | 5 | same | intake.assets.trust | no | submission_level |  |  |  |  |
| asset_bonds_yes | checkbox | Yes (Bonds) | 5 | Section IV, Bonds row | intake.assets.bonds | no | submission_level |  | bank_statement |  |  |
| asset_bonds_no | checkbox | No | 5 | same | intake.assets.bonds | no | submission_level |  |  |  |  |
| asset_bonds_member | text_short | Family Member | 5 | same | intake.assets.bonds | no | submission_level |  |  |  |  |
| asset_bonds_source | text_short | Source | 5 | same | intake.assets.bonds | no | submission_level |  |  |  |  |
| asset_bonds_value | currency | Amount or Market Value | 5 | same | intake.assets.bonds | no | submission_level |  |  |  |  |
| asset_life_insurance_yes | checkbox | Yes (Life Insurance) | 5 | Section IV, Life Insurance row | intake.assets.life_insurance | no | submission_level |  | policy_showing_value |  |  |
| asset_life_insurance_no | checkbox | No | 5 | same | intake.assets.life_insurance | no | submission_level |  |  |  |  |
| asset_life_insurance_member | text_short | Family Member | 5 | same | intake.assets.life_insurance | no | submission_level |  |  |  |  |
| asset_life_insurance_source | text_short | Source | 5 | same | intake.assets.life_insurance | no | submission_level |  |  |  |  |
| asset_life_insurance_value | currency | Amount or Market Value | 5 | same | intake.assets.life_insurance | no | submission_level |  |  |  |  |
| asset_other_yes | checkbox | Yes (Other) | 5 | Section IV, Other row | intake.assets.other | no | submission_level |  | other_asset_doc |  |  |
| asset_other_no | checkbox | No | 5 | same | intake.assets.other | no | submission_level |  |  |  |  |
| asset_other_member | text_short | Family Member | 5 | same | intake.assets.other | no | submission_level |  |  |  |  |
| asset_other_source | text_short | Source | 5 | same | intake.assets.other | no | submission_level |  |  |  |  |
| asset_other_value | currency | Amount or Market Value | 5 | same | intake.assets.other | no | submission_level |  |  |  |  |
| q3_sold_assets_yes | checkbox | Yes | 5 | Section IV, Q3 | fresh_input | yes | submission_level |  |  |  | "Have you sold or given away any assets in the last two (2) years?" |
| q3_sold_assets_no | checkbox | No | 5 | same | fresh_input | yes | submission_level |  |  |  |  |
| q3_sold_assets_explain | text_long | If yes, explain | 5 | below Q3 | fresh_input | no | submission_level |  |  |  | conditional |
| q4_childcare_yes | checkbox | Yes | 5 | Section V, Q4 | fresh_input | yes | submission_level |  |  |  | "Do you pay for childcare..." |
| q4_childcare_no | checkbox | No | 5 | same | fresh_input | yes | submission_level |  |  |  |  |
| q5_care4kids_yes | checkbox | Yes | 5 | Section V, Q5 | fresh_input | yes | submission_level |  | care4kids_cert |  | triggers care4kids upload requirement |
| q5_care4kids_no | checkbox | No | 5 | same | fresh_input | yes | submission_level |  |  |  |  |
| q6_childcare_relative_yes | checkbox | Yes | 5 | Section V, Q6 | fresh_input | yes | submission_level | childcare_relative_form |  |  | triggers separate form provision |
| q6_childcare_relative_no | checkbox | No | 5 | same | fresh_input | yes | submission_level |  |  |  |  |
| medical_insurance_yes | checkbox | Yes (Medical Insurance) | 5 | Section VI medical table (4 rows) | intake.medical.insurance | no | submission_level |  | medical_insurance_doc |  | Section VI only required if HOH/spouse disabled or 62+ |
| medical_insurance_no | checkbox | No | 5 | same | intake.medical.insurance | no | submission_level |  |  |  |  |
| medical_insurance_member | text_short | Family Member | 5 | same | intake.medical.insurance | no | submission_level |  |  |  |  |
| medical_insurance_source | text_short | Source | 5 | same | intake.medical.insurance | no | submission_level |  |  |  |  |
| medical_insurance_amount | currency | Amount | 5 | same | intake.medical.insurance | no | submission_level |  |  |  |  |
| medical_doctor_visits_yes | checkbox | Yes (Doctor's Visits) | 5 | Section VI, Doctor's Visits row | intake.medical.doctor | no | submission_level |  | doctor_bills_1yr |  |  |
| medical_doctor_visits_no | checkbox | No | 5 | same | intake.medical.doctor | no | submission_level |  |  |  |  |
| medical_doctor_visits_member | text_short | Family Member | 5 | same | intake.medical.doctor | no | submission_level |  |  |  |  |
| medical_doctor_visits_source | text_short | Source | 5 | same | intake.medical.doctor | no | submission_level |  |  |  |  |
| medical_doctor_visits_amount | currency | Amount | 5 | same | intake.medical.doctor | no | submission_level |  |  |  |  |
| medical_prescription_yes | checkbox | Yes (Prescription Medicine) | 5 | Section VI, Prescription row | intake.medical.prescription | no | submission_level |  | pharmacy_statement_1yr |  |  |
| medical_prescription_no | checkbox | No | 5 | same | intake.medical.prescription | no | submission_level |  |  |  |  |
| medical_prescription_member | text_short | Family Member | 5 | same | intake.medical.prescription | no | submission_level |  |  |  |  |
| medical_prescription_source | text_short | Source | 5 | same | intake.medical.prescription | no | submission_level |  |  |  |  |
| medical_prescription_amount | currency | Amount | 5 | same | intake.medical.prescription | no | submission_level |  |  |  |  |
| medical_other_yes | checkbox | Yes (Other) | 5 | Section VI, Other row | intake.medical.other | no | submission_level |  | other_medical_doc |  |  |
| medical_other_no | checkbox | No | 5 | same | intake.medical.other | no | submission_level |  |  |  |  |
| medical_other_member | text_short | Family Member | 5 | same | intake.medical.other | no | submission_level |  |  |  |  |
| medical_other_source | text_short | Source | 5 | same | intake.medical.other | no | submission_level |  |  |  |  |
| medical_other_amount | currency | Amount | 5 | same | intake.medical.other | no | submission_level |  |  |  |  |
| q7_violent_crime_yes | checkbox | Yes (Violent Criminal Activity) | 5 | Section VII criminal table, row 1 | fresh_input | yes | submission_level |  |  |  | Criminal history table — per household member per row |
| q7_violent_crime_no | checkbox | No | 5 | same | fresh_input | yes | submission_level |  |  |  |  |
| q7_violent_crime_member | text_short | Family Member | 5 | same | fresh_input | no | submission_level |  |  |  |  |
| q7_violent_crime_details | text_long | Give Details | 5 | same | fresh_input | no | submission_level |  |  |  |  |
| q7_alcohol_yes | checkbox | Yes (Alcohol Related Activity) | 5 | Section VII, row 2 | fresh_input | yes | submission_level |  |  |  |  |
| q7_alcohol_no | checkbox | No | 5 | same | fresh_input | yes | submission_level |  |  |  |  |
| q7_alcohol_member | text_short | Family Member | 5 | same | fresh_input | no | submission_level |  |  |  |  |
| q7_alcohol_details | text_long | Give Details | 5 | same | fresh_input | no | submission_level |  |  |  |  |
| q7_meth_yes | checkbox | Yes (Manufacture of Methamphetamines) | 5 | Section VII, row 3 | fresh_input | yes | submission_level |  |  |  |  |
| q7_meth_no | checkbox | No | 5 | same | fresh_input | yes | submission_level |  |  |  |  |
| q7_meth_member | text_short | Family Member | 5 | same | fresh_input | no | submission_level |  |  |  |  |
| q7_meth_details | text_long | Give Details | 5 | same | fresh_input | no | submission_level |  |  |  |  |
| q7_drugs_yes | checkbox | Yes (Possession/Sale/Distribution of Illegal Drugs) | 5 | Section VII, row 4 | fresh_input | yes | submission_level |  |  |  |  |
| q7_drugs_no | checkbox | No | 5 | same | fresh_input | yes | submission_level |  |  |  |  |
| q7_drugs_member | text_short | Family Member | 5 | same | fresh_input | no | submission_level |  |  |  |  |
| q7_drugs_details | text_long | Give Details | 5 | same | fresh_input | no | submission_level |  |  |  |  |
| q7_sex_offender_yes | checkbox | Yes (Required to Register as Sex Offender) | 5 | Section VII, row 5 | fresh_input | yes | submission_level |  |  |  |  |
| q7_sex_offender_no | checkbox | No | 5 | same | fresh_input | yes | submission_level |  |  |  |  |
| q7_sex_offender_member | text_short | Family Member | 5 | same | fresh_input | no | submission_level |  |  |  |  |
| q7_sex_offender_details | text_long | Give Details | 5 | same | fresh_input | no | submission_level |  |  |  |  |
| q7_other_convictions_yes | checkbox | Yes (Other Convictions) | 5 | Section VII, row 6 | fresh_input | yes | submission_level |  |  |  |  |
| q7_other_convictions_no | checkbox | No | 5 | same | fresh_input | yes | submission_level |  |  |  |  |
| q7_other_convictions_member | text_short | Family Member | 5 | same | fresh_input | no | submission_level |  |  |  |  |
| q7_other_convictions_details | text_long | Give Details | 5 | same | fresh_input | no | submission_level |  |  |  |  |
| q8_dv_yes | checkbox | Yes | 7 | top of page 7, Q8 | fresh_input | yes | head_of_household_only | vawa_certification |  |  | "Are you a victim of domestic violence?" — TRIGGERS vawa_certification |
| q8_dv_no | checkbox | No | 7 | same | fresh_input | yes | head_of_household_only |  |  |  |  |
| q9_homeless_yes | checkbox | Yes | 7 | Q9 | fresh_input | yes | submission_level |  |  |  | "Are you homeless at admission to the program?" |
| q9_homeless_no | checkbox | No | 7 | same | fresh_input | yes | submission_level |  |  |  |  |
| q10_reasonable_accommodation_yes | checkbox | Yes | 7 | Q10 | fresh_input | yes | submission_level | reasonable_accommodation_request | ra_supporting_doc |  | TRIGGERS reasonable_accommodation_request |
| q10_reasonable_accommodation_no | checkbox | No | 7 | same | fresh_input | yes | submission_level |  |  |  |  |
| expense_rent_amount | currency | Amount Per Month (Rent) | 7 | Section VIII household expenses table, left col | fresh_input | no | submission_level |  |  |  | Section VIII only if zero income; 16 expense rows in left col, 14 in right col |
| expense_rent_who_pays | text_short | Who Pays For This | 7 | same | fresh_input | no | submission_level |  |  |  |  |
| expense_light_amount | currency | Amount Per Month (Light) | 7 | Section VIII, Light row | fresh_input | no | submission_level |  |  |  |  |
| expense_light_who_pays | text_short | Who Pays For This | 7 | same | fresh_input | no | submission_level |  |  |  |  |
| expense_gas_oil_amount | currency | Amount (Gas/Oil) | 7 | Section VIII, Gas/Oil row | fresh_input | no | submission_level |  |  |  |  |
| expense_gas_oil_who_pays | text_short | Who Pays | 7 | same | fresh_input | no | submission_level |  |  |  |  |
| expense_water_amount | currency | Amount (Water) | 7 | Section VIII, Water row | fresh_input | no | submission_level |  |  |  |  |
| expense_water_who_pays | text_short | Who Pays | 7 | same | fresh_input | no | submission_level |  |  |  |  |
| expense_vehicle_payment_amount | currency | Amount (Vehicle Payment) | 7 | Section VIII | fresh_input | no | submission_level |  |  |  |  |
| expense_vehicle_payment_who_pays | text_short | Who Pays | 7 | same | fresh_input | no | submission_level |  |  |  |  |
| expense_vehicle_insurance_amount | currency | Amount (Vehicle Insurance/Taxes) | 7 | Section VIII | fresh_input | no | submission_level |  |  |  |  |
| expense_vehicle_insurance_who_pays | text_short | Who Pays | 7 | same | fresh_input | no | submission_level |  |  |  |  |
| expense_cable_internet_amount | currency | Amount (Cable/Internet) | 7 | Section VIII | fresh_input | no | submission_level |  |  |  |  |
| expense_cable_internet_who_pays | text_short | Who Pays | 7 | same | fresh_input | no | submission_level |  |  |  |  |
| expense_phone_home_amount | currency | Amount (Phone Home) | 7 | Section VIII | fresh_input | no | submission_level |  |  |  |  |
| expense_phone_home_who_pays | text_short | Who Pays | 7 | same | fresh_input | no | submission_level |  |  |  |  |
| expense_phone_cell_amount | currency | Amount (Phone Cell) | 7 | Section VIII | fresh_input | no | submission_level |  |  |  |  |
| expense_phone_cell_who_pays | text_short | Who Pays | 7 | same | fresh_input | no | submission_level |  |  |  |  |
| expense_childcare_amount | currency | Amount (Child Care) | 7 | Section VIII | fresh_input | no | submission_level |  |  |  |  |
| expense_childcare_who_pays | text_short | Who Pays | 7 | same | fresh_input | no | submission_level |  |  |  |  |
| expense_furniture_rental_amount | currency | Amount (Furniture Rental) | 7 | Section VIII | fresh_input | no | submission_level |  |  |  |  |
| expense_furniture_rental_who_pays | text_short | Who Pays | 7 | same | fresh_input | no | submission_level |  |  |  |  |
| expense_misc_amount | currency | Amount (MISC: lottery, manicures, etc.) | 7 | Section VIII | fresh_input | no | submission_level |  |  |  |  |
| expense_misc_who_pays | text_short | Who Pays | 7 | same | fresh_input | no | submission_level |  |  |  |  |
| expense_baby_products_amount | currency | Amount (Baby Products) | 7 | Section VIII | fresh_input | no | submission_level |  |  |  |  |
| expense_baby_products_who_pays | text_short | Who Pays | 7 | same | fresh_input | no | submission_level |  |  |  |  |
| expense_credit_cards_amount | currency | Amount (Credit Cards) | 7 | Section VIII | fresh_input | no | submission_level |  |  |  | list all |
| expense_credit_cards_who_pays | text_short | Who Pays | 7 | same | fresh_input | no | submission_level |  |  |  |  |
| expense_other_left_amount | currency | Amount (Other) | 7 | Section VIII left col, Other row | fresh_input | no | submission_level |  |  |  |  |
| expense_other_left_who_pays | text_short | Who Pays | 7 | same | fresh_input | no | submission_level |  |  |  |  |
| expense_groceries_amount | currency | Amount (Groceries in Cash) | 7 | Section VIII right col | fresh_input | no | submission_level |  |  |  | right col: 14 expense rows |
| expense_groceries_who_pays | text_short | Who Pays | 7 | same | fresh_input | no | submission_level |  |  |  |  |
| expense_takeout_amount | currency | Amount (Take Out Food) | 7 | Section VIII right col | fresh_input | no | submission_level |  |  |  |  |
| expense_takeout_who_pays | text_short | Who Pays | 7 | same | fresh_input | no | submission_level |  |  |  |  |
| expense_paper_products_amount | currency | Amount (Paper Products, etc.) | 7 | Section VIII right col | fresh_input | no | submission_level |  |  |  |  |
| expense_paper_products_who_pays | text_short | Who Pays | 7 | same | fresh_input | no | submission_level |  |  |  |  |
| expense_grooming_amount | currency | Amount (Grooming Products) | 7 | Section VIII right col | fresh_input | no | submission_level |  |  |  |  |
| expense_grooming_who_pays | text_short | Who Pays | 7 | same | fresh_input | no | submission_level |  |  |  |  |
| expense_cleaning_amount | currency | Amount (Cleaning/Laundry) | 7 | Section VIII right col | fresh_input | no | submission_level |  |  |  |  |
| expense_cleaning_who_pays | text_short | Who Pays | 7 | same | fresh_input | no | submission_level |  |  |  |  |
| expense_gas_vehicle_amount | currency | Amount (Gas for Vehicle) | 7 | Section VIII right col | fresh_input | no | submission_level |  |  |  |  |
| expense_gas_vehicle_who_pays | text_short | Who Pays | 7 | same | fresh_input | no | submission_level |  |  |  |  |
| expense_clothing_amount | currency | Amount (Clothing/Shoes) | 7 | Section VIII right col | fresh_input | no | submission_level |  |  |  |  |
| expense_clothing_who_pays | text_short | Who Pays | 7 | same | fresh_input | no | submission_level |  |  |  |  |
| expense_entertainment_amount | currency | Amount (Entertainment) | 7 | Section VIII right col | fresh_input | no | submission_level |  |  |  |  |
| expense_entertainment_who_pays | text_short | Who Pays | 7 | same | fresh_input | no | submission_level |  |  |  |  |
| expense_public_transport_amount | currency | Amount (Public Transportation) | 7 | Section VIII right col | fresh_input | no | submission_level |  |  |  |  |
| expense_public_transport_who_pays | text_short | Who Pays | 7 | same | fresh_input | no | submission_level |  |  |  |  |
| expense_jewelry_amount | currency | Amount (Jewelry) | 7 | Section VIII right col | fresh_input | no | submission_level |  |  |  |  |
| expense_jewelry_who_pays | text_short | Who Pays | 7 | same | fresh_input | no | submission_level |  |  |  |  |
| expense_household_items_amount | currency | Amount (Household Items) | 7 | Section VIII right col | fresh_input | no | submission_level |  |  |  |  |
| expense_household_items_who_pays | text_short | Who Pays | 7 | same | fresh_input | no | submission_level |  |  |  |  |
| expense_vehicle_maintenance_amount | currency | Amount (Vehicle Maintenance) | 7 | Section VIII right col | fresh_input | no | submission_level |  |  |  |  |
| expense_vehicle_maintenance_who_pays | text_short | Who Pays | 7 | same | fresh_input | no | submission_level |  |  |  |  |
| expense_doctor_prescriptions_amount | currency | Amount (Doctor's/Prescriptions) | 7 | Section VIII right col | fresh_input | no | submission_level |  |  |  |  |
| expense_doctor_prescriptions_who_pays | text_short | Who Pays | 7 | same | fresh_input | no | submission_level |  |  |  |  |
| expense_loans_amount | currency | Amount (Loans) | 7 | Section VIII right col | fresh_input | no | submission_level |  |  |  | list all |
| expense_loans_who_pays | text_short | Who Pays | 7 | same | fresh_input | no | submission_level |  |  |  |  |
| expense_other_right_amount | currency | Amount (Other) | 7 | Section VIII right col, Other | fresh_input | no | submission_level |  |  |  |  |
| expense_other_right_who_pays | text_short | Who Pays | 7 | same | fresh_input | no | submission_level |  |  |  |  |
| notices_read_yes | checkbox | Yes | 9 | bottom of page 9, "I have read and understood the above important notices" | fresh_input | yes | submission_level |  |  |  | acknowledgment |
| notices_read_no | checkbox | No | 9 | same | fresh_input | yes | submission_level |  |  |  |  |
| hoh_signature | signature | Signature of Head of Household | 9 | first signature block | signature_capture | yes | head_of_household_only |  |  |  |  |
| hoh_signature_date | date | Date | 9 | same line, right | date_auto | yes | head_of_household_only |  |  |  |  |
| spouse_signature_1 | signature | Signature of Spouse of Head of Household, Co-Head, or Other Adult | 9 | second signature block | signature_capture | conditional | individual |  |  |  | required for each additional adult; 5 spouse/co-head/other adult lines provided |
| spouse_signature_1_date | date | Date | 9 | same line | date_auto | conditional | individual |  |  |  |  |
| spouse_signature_2 | signature | Signature of Spouse of Head of Household, Co-Head, or Other Adult | 9 | third signature block | signature_capture | conditional | individual |  |  |  |  |
| spouse_signature_2_date | date | Date | 9 | same line | date_auto | conditional | individual |  |  |  |  |
| spouse_signature_3 | signature | Signature of Spouse of Head of Household, Co-Head, or Other Adult | 9 | fourth signature block | signature_capture | conditional | individual |  |  |  |  |
| spouse_signature_3_date | date | Date | 9 | same line | date_auto | conditional | individual |  |  |  |  |
| spouse_signature_4 | signature | Signature of Spouse of Head of Household, Co-Head, or Other Adult | 9 | fifth signature block | signature_capture | conditional | individual |  |  |  |  |
| spouse_signature_4_date | date | Date | 9 | same line | date_auto | conditional | individual |  |  |  |  |
| spouse_signature_5 | signature | Signature of Spouse of Head of Household, Co-Head, or Other Adult | 9 | sixth signature block | signature_capture | conditional | individual |  |  |  |  |
| spouse_signature_5_date | date | Date | 9 | same line | date_auto | conditional | individual |  |  |  |  |

**Special handling:** This is the multi-page main application (5 EN pages: 1, 3, 5, 7, 9). All income/asset/expense tables use the same column pattern (yes/no checkbox pair, family member, source, amount) — for renderer efficiency, build one table component and parameterize the row labels. Question 7 (criminal history) is structured as a table where multiple household members may need to be reported per offense type — the per-row "Family Member" field should accept multiple entries. Question 8 (DV) triggers `vawa_certification`; Question 10 (accommodation) triggers `reasonable_accommodation_request`. Section VIII (Household Expenses) is only required if Section II shows zero income for the household; renderer should hide unless triggered. The 6 signature blocks on page 9 mean up to 6 adults can sign — minimum required is HOH; remaining 5 are conditional on number of adults in household.

---

## hud_9886a

EN pages: 11, 13 | ES pages: 12, 14

| field_name | field_type | label_on_form | page | position_hint | prefill_source | required | per_person_scope | trigger_form | trigger_upload | trigger_section | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| pha_contact_block | text_long | PHA or IHA requesting release of information (full address, name of contact person, and date) | 11 | top of page 11, just below title | fresh_input (HACH prefill) | yes | submission_level |  |  |  | HACH agency info — should be pre-populated by Stanton, not tenant input |
| hoh_signature | signature | Head of Household | 13 | top of page 13 signature block, left column | signature_capture | yes | head_of_household_only |  |  |  |  |
| hoh_signature_date | date | Date | 13 | same line, right of HOH signature | date_auto | yes | head_of_household_only |  |  |  |  |
| hoh_ssn | ssn | Social Security Number (if any) of Head of Household | 13 | below HOH signature line | intake.applicant.ssn | no | head_of_household_only |  |  |  | "if any" — explicitly optional |
| spouse_signature | signature | Spouse | 13 | second left signature block | signature_capture | conditional | individual |  |  |  | conditional on spouse in household |
| spouse_signature_date | date | Date | 13 | same line | date_auto | conditional | individual |  |  |  |  |
| other_adult_1_signature | signature | Other Family Member over age 18 | 13 | left col, 3rd signature block | signature_capture | conditional | each_adult |  |  |  | up to 6 other adult slots total (3 left, 3 right) |
| other_adult_1_signature_date | date | Date | 13 | same line | date_auto | conditional | each_adult |  |  |  |  |
| other_adult_2_signature | signature | Other Family Member over age 18 | 13 | right col, 1st signature block | signature_capture | conditional | each_adult |  |  |  |  |
| other_adult_2_signature_date | date | Date | 13 | same line | date_auto | conditional | each_adult |  |  |  |  |
| other_adult_3_signature | signature | Other Family Member over age 18 | 13 | right col, 2nd signature block | signature_capture | conditional | each_adult |  |  |  |  |
| other_adult_3_signature_date | date | Date | 13 | same line | date_auto | conditional | each_adult |  |  |  |  |
| other_adult_4_signature | signature | Other Family Member over age 18 | 13 | right col, 3rd signature block | signature_capture | conditional | each_adult |  |  |  |  |
| other_adult_4_signature_date | date | Date | 13 | same line | date_auto | conditional | each_adult |  |  |  |  |
| other_adult_5_signature | signature | Other Family Member over age 18 | 13 | left col, 4th signature block (if present) | signature_capture | conditional | each_adult |  |  |  |  |
| other_adult_5_signature_date | date | Date | 13 | same line | date_auto | conditional | each_adult |  |  |  |  |

**Special handling:** Page 11 is informational/legal preamble — only fillable element is the PHA contact block at top (HACH info, pre-populated by Stanton). Page 13 holds all signatures. Form HUD-9886-A explicitly requires "Each member of your family who is 18 years of age or older must sign" — `signer_scope = all_adults`. Layout provides Head of Household + Spouse + up to 5 Other Family Member slots in a 2-column signature grid. HOH SSN field on page 13 is the only non-signature data field. ES pages (12, 14) mirror EN structurally.

---

## hach_release

EN page: 15 | ES page: 16

| field_name | field_type | label_on_form | page | position_hint | prefill_source | required | per_person_scope | trigger_form | trigger_upload | trigger_section | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| applicant_name | text_short | Name | 15 | top left, below "To: The Housing Authority of the City of Hartford" | intake.applicant.full_name | yes | head_of_household_only |  |  |  |  |
| applicant_address_line1 | address | Address | 15 | below Name | intake.applicant.address | yes | head_of_household_only |  |  |  | first address line |
| applicant_address_line2 | address | (Address line 2) | 15 | below first address line | intake.applicant.address | no | head_of_household_only |  |  |  | continuation line |
| hoh_signature | signature | Signature and Printed Name of Head of Household | 15 | bottom of page, signature block 1 | signature_capture | yes | head_of_household_only |  |  |  |  |
| hoh_printed_name | text_short | (Printed Name) | 15 | combined with HOH signature line | intake.applicant.full_name | yes | head_of_household_only |  |  |  | label says "Signature and Printed Name" |
| hoh_signature_date | date | Date | 15 | right of HOH signature line | date_auto | yes | head_of_household_only |  |  |  |  |
| spouse_signature | signature | Signature and Printed Name of Spouse or Other Adult | 15 | signature block 2 | signature_capture | conditional | individual |  |  |  |  |
| spouse_printed_name | text_short | (Printed Name) | 15 | combined with spouse signature line | intake.household.member_list | conditional | individual |  |  |  |  |
| spouse_signature_date | date | Date | 15 | right of spouse signature line | date_auto | conditional | individual |  |  |  |  |
| other_adult_1_signature | signature | Signature and Printed Name of Other Adult | 15 | signature block 3 | signature_capture | conditional | each_adult |  |  |  | up to 2 additional other adult slots |
| other_adult_1_printed_name | text_short | (Printed Name) | 15 | combined with signature line | intake.household.member_list | conditional | each_adult |  |  |  |  |
| other_adult_1_signature_date | date | Date | 15 | right of signature line | date_auto | conditional | each_adult |  |  |  |  |
| other_adult_2_signature | signature | Signature and Printed Name of Other Adult | 15 | signature block 4 | signature_capture | conditional | each_adult |  |  |  |  |
| other_adult_2_printed_name | text_short | (Printed Name) | 15 | combined with signature line | intake.household.member_list | conditional | each_adult |  |  |  |  |
| other_adult_2_signature_date | date | Date | 15 | right of signature line | date_auto | conditional | each_adult |  |  |  |  |

**Special handling:** HACH's own release form. Has a 15-month expiration. The "To:" field is pre-filled (The Housing Authority of the City of Hartford) — not a fillable field. The form provides 4 signature blocks: HOH, Spouse/Other Adult, plus 2 additional Other Adult slots. Each signature line is labeled "Signature and Printed Name" — render as two adjacent fields. Signer scope per the form text: "HOH + other adults." Treat as `all_adults` for safety. ES page (16) mirrors EN.


---

## child_support_affidavit

EN page: 17 (top half) | ES page: 18 (top half)

| field_name | field_type | label_on_form | page | position_hint | prefill_source | required | per_person_scope | trigger_form | trigger_upload | trigger_section | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| affiant_name | text_short | I, ___ | 17 | top of top-half block, "I, ___, of Hartford, CT" | intake.applicant.full_name | yes | individual |  |  |  | the affiant — typically HOH or recipient parent |
| affiant_address | address | Your Name Address | 17 | upper right, address block | intake.applicant.address | yes | individual |  |  |  | header address block |
| affiant_zip | text_short | Zip Code | 17 | upper right, address block | intake.applicant.address | yes | individual |  |  |  |  |
| children_names | text_long | for my child(ren): ___ | 17 | mid-block, after "of Hartford, CT certify that I receive child support for my child(ren):" | intake.household.member_list | yes | individual |  |  |  | list of children covered |
| amount_weekly | currency | $ ___ weekly | 17 | "in the amount of $ ___ weekly" | intake.income.child_support | conditional | individual |  |  |  | one of weekly OR monthly |
| amount_monthly | currency | or $ ___ monthly | 17 | "or $ ___ monthly" | intake.income.child_support | conditional | individual |  |  |  | one of weekly OR monthly |
| signature | signature | Signature | 17 | bottom of top block | signature_capture | yes | individual |  |  |  |  |
| signature_date | date | Date | 17 | right of signature line | date_auto | yes | individual |  |  |  |  |

**Special handling:** This is the AFFIRMATIVE variant — used when the household receives child support. Lives on the top half of page 17. The header has a duplicated "Your Name Address / Zip Code" block that appears to be a fill-in for the affiant's mailing address (separate from the inline "of Hartford, CT" reference). Variant selection is driven by `income_child_support_yes` on the main application — if yes, render this form; if no, render `no_child_support_affidavit` below. Per-person scope is `individual` because either the HOH or the parent who actually receives the support signs — not necessarily all adults. ES page (18) mirrors EN.

---

## no_child_support_affidavit

EN page: 17 (bottom half) | ES page: 18 (bottom half)

| field_name | field_type | label_on_form | page | position_hint | prefill_source | required | per_person_scope | trigger_form | trigger_upload | trigger_section | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| affiant_name | text_short | I, ___ | 17 | top of bottom-half block, "I, ___, of Hartford, CT" | intake.applicant.full_name | yes | individual |  |  |  | the affiant |
| affiant_address | address | Your Name Address | 17 | bottom-half address block | intake.applicant.address | yes | individual |  |  |  | header address block (duplicated from top variant) |
| affiant_zip | text_short | Zip Code | 17 | bottom-half address block | intake.applicant.address | yes | individual |  |  |  |  |
| children_names | text_long | for my child(ren): ___ | 17 | mid-block, "certify that I do not receive child support for my child(ren):" | intake.household.member_list | yes | individual |  |  |  | list of children |
| signature | signature | Signature | 17 | bottom of page 17 | signature_capture | yes | individual |  |  |  |  |
| signature_date | date | Date | 17 | right of signature line | date_auto | yes | individual |  |  |  |  |

**Special handling:** This is the NEGATIVE variant — used when the household does NOT receive child support. Lives on the bottom half of page 17 below a horizontal `~~~` separator. Renderer should treat this as a separate form even though it shares the page with `child_support_affidavit`. No amount fields (since there is no support to report). Mutually exclusive with `child_support_affidavit` — driven by `income_child_support_no` on the main application. ES page (18) mirrors EN.

---

## citizenship_declaration

EN pages: 19, 21 (instructions only on 21) | ES pages: 20, 22

| field_name | field_type | label_on_form | page | position_hint | prefill_source | required | per_person_scope | trigger_form | trigger_upload | trigger_section | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| member_name | text_short | Family Member Name | 19 | member table, col 1 | intake.household.member_list | yes | individual |  |  |  | table repeats per household member; 9 rows shown |
| member_dob | date | Date of Birth | 19 | member table, col 2 | intake.household.member_list | yes | individual |  |  |  | per row |
| member_status_1 | checkbox | Status 1 (citizen) | 19 | member table, col 3 — status section, box "1" | intake.citizenship.<member> | yes | individual |  |  |  | radio group of 3: 1=citizen, 2=eligible non-citizen, 3=not declaring |
| member_status_2 | checkbox | Status 2 (eligible immigration status) | 19 | member table, col 3 — status section, box "2" | intake.citizenship.<member> | yes | individual |  | immigration_doc_set |  |  |
| member_status_3 | checkbox | Status 3 (choose not to declare) | 19 | member table, col 3 — status section, box "3" | intake.citizenship.<member> | yes | individual |  |  |  |  |
| member_signature | signature | Signature of Adult or parent/guardian on behalf of minor under 18 | 19 | member table, col 4 (last) | signature_capture | yes | individual |  |  |  | adults sign for themselves; parent/guardian signs for minors |
| hoh_certification_signature | signature | Head of Household Signature | 19 | bottom of page, separate from member table | signature_capture | yes | head_of_household_only |  |  |  | HOH penalty-of-perjury cert that household list is complete and accurate |
| hoh_certification_date | date | Date | 19 | right of HOH cert signature | date_auto | yes | head_of_household_only |  |  |  |  |

**Special handling:** This form has a household-member table on page 19 — every household member is listed and has a status (1/2/3) checkbox plus a signature. Adults 18+ sign for themselves; an adult parent/guardian signs on behalf of minors. The HOH also signs a separate certification at the bottom of page 19. Page 21 (EN) / 22 (ES) contains the "ELIGIBLE IMMIGRATION STATUS INSTRUCTIONS" — informational reference text explaining the categories (Section 1, 2, etc.) — no fillable elements. If a member checks status 2, the form references an attached evidence requirement (e.g., I-551, I-94) — these are document uploads handled outside this form, not fillable fields on this form itself.

---

## obligations_of_family

EN page: 23 | ES page: 24

| field_name | field_type | label_on_form | page | position_hint | prefill_source | required | per_person_scope | trigger_form | trigger_upload | trigger_section | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| hoh_name | text_short | Head of Household | 23 | bottom of page, left column, line 1 | intake.applicant.full_name | yes | head_of_household_only |  |  |  | printed name |
| hoh_signature_date | date | Date | 23 | bottom of page, right column, line 1 | date_auto | yes | head_of_household_only |  |  |  |  |
| hoh_signature | signature | Head of Household Signature | 23 | bottom of page, left column, line 2 | signature_capture | yes | head_of_household_only |  |  |  |  |
| hoh_phone | phone | Phone | 23 | bottom of page, right column, line 2 | intake.applicant.phone | yes | head_of_household_only |  |  |  |  |
| hoh_address | address | Address | 23 | bottom of page, last line | intake.applicant.address | yes | head_of_household_only |  |  |  |  |

**Special handling:** Acknowledge-only form. The entire page is rules text the HOH agrees to. Only HOH signs — `signer_scope = hoh_only`. Sparse field set: printed name, signature, date, phone, address — 5 fillable elements total. ES page (24) mirrors EN.

---

## eiv_guide_receipt

EN pages: 25, 27 | ES pages: 26, 28

| field_name | field_type | label_on_form | page | position_hint | prefill_source | required | per_person_scope | trigger_form | trigger_upload | trigger_section | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| signature | signature | Signature | 27 | bottom-right of page 27, end of the EIV guide content | signature_capture | yes | head_of_household_only |  |  |  | "My signature below is confirmation that I have received this Guide" |
| signature_date | date | Date | 27 | right of signature line on page 27 | date_auto | yes | head_of_household_only |  |  |  |  |

**Special handling:** Acknowledge-only form. Pages 25 and 27 (EN) are the full RHIIP "What You Should Know About EIV" guide — a multi-page informational brochure. The only fillable elements are at the very end (page 27): one signature + one date. Confirms receipt of the guide. Single signer (HOH per HACH practice; the form text says "Signature" without specifying scope but the briefing document certification on page 37 lists EIV Guide receipt as a single-acknowledgment item — treat as `hoh_only`). ES pages (26, 28) mirror EN.


---

## debts_owed_phas

EN pages: 29, 31 | ES pages: 30, 32 | Form HUD-52675

| field_name | field_type | label_on_form | page | position_hint | prefill_source | required | per_person_scope | trigger_form | trigger_upload | trigger_section | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| signature | signature | Signature | 31 | bottom of page 31, right side acknowledgment box | signature_capture | yes | each_adult |  |  |  | per HUD-52675 instruction "Each adult household member must sign this form" |
| signature_date | date | Date | 31 | right of signature line | date_auto | yes | each_adult |  |  |  |  |
| printed_name | text_short | Printed Name | 31 | below signature line | intake.household.member_list | yes | each_adult |  |  |  |  |

**Special handling:** Acknowledge-only form, HUD-52675 (OMB 2577-0266, exp 06/30/2026 per the packet — note an earlier exp date 06/30/2026 appears on page 29 and 08/31/2016 appears on the ES variant page 30; the form is current per the EN page 29 OMB block). Pages 29 and 31 (EN) are explanatory text about EIV debt records; only page 31 has fillable fields. The pre-populated "This Notice was provided by the below-listed PHA" block shows HACH info — not a tenant field. Each adult must sign per form instruction — `signer_scope = all_adults`. Layout shows one signature/date/printed-name block on page 31; in practice the renderer should generate one block per adult. ES pages (30, 32) mirror EN.

---

## hud_92006

EN pages: 33, 35 | ES pages: 34, 36 | HUD-92006 Supplemental & Optional Contact Information

| field_name | field_type | label_on_form | page | position_hint | prefill_source | required | per_person_scope | trigger_form | trigger_upload | trigger_section | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| applicant_name | text_short | Applicant Name | 35 | top of fillable section, left | intake.applicant.full_name | yes | head_of_household_only |  |  |  |  |
| applicant_mailing_address | address | Mailing Address | 35 | second line | intake.applicant.address | yes | head_of_household_only |  |  |  |  |
| applicant_phone | phone | Telephone No | 35 | third line, left | intake.applicant.phone | no | head_of_household_only |  |  |  |  |
| applicant_cell | phone | Cell Phone No | 35 | third line, right | intake.applicant.phone | no | head_of_household_only |  |  |  |  |
| contact_name | text_short | Name of Additional Contact Person or Organization | 35 | "Additional Contact" section, line 1 | fresh_input | conditional | submission_level |  |  |  | conditional on opt_out_checkbox NOT checked |
| contact_address | address | Address | 35 | "Additional Contact" section, line 2 | fresh_input | conditional | submission_level |  |  |  |  |
| contact_phone | phone | Telephone No | 35 | "Additional Contact" section, line 3 left | fresh_input | conditional | submission_level |  |  |  |  |
| contact_cell | phone | Cell Phone No | 35 | "Additional Contact" section, line 3 right | fresh_input | conditional | submission_level |  |  |  |  |
| contact_email | email | E-Mail Address (if applicable) | 35 | "Additional Contact" section, line 4 | fresh_input | no | submission_level |  |  |  |  |
| contact_relationship | text_short | Relationship to Applicant | 35 | "Additional Contact" section, line 5 | fresh_input | conditional | submission_level |  |  |  |  |
| reason_emergency | checkbox | Emergency | 35 | Reason for Contact, option 1 (left col) | fresh_input | no | submission_level |  |  |  | check all that apply — multi-select |
| reason_unable_to_contact | checkbox | Unable to contact you | 35 | Reason for Contact, option 2 (left col) | fresh_input | no | submission_level |  |  |  |  |
| reason_termination | checkbox | Termination of rental assistance | 35 | Reason for Contact, option 3 (left col) | fresh_input | no | submission_level |  |  |  |  |
| reason_eviction | checkbox | Eviction from unit | 35 | Reason for Contact, option 4 (left col) | fresh_input | no | submission_level |  |  |  |  |
| reason_late_payment | checkbox | Late payment of rent | 35 | Reason for Contact, option 5 (left col) | fresh_input | no | submission_level |  |  |  |  |
| reason_recertification | checkbox | Assist with Recertification Process | 35 | Reason for Contact, option 1 (right col) | fresh_input | no | submission_level |  |  |  |  |
| reason_lease_terms | checkbox | Change in lease terms | 35 | Reason for Contact, option 2 (right col) | fresh_input | no | submission_level |  |  |  |  |
| reason_house_rules | checkbox | Change in house rules | 35 | Reason for Contact, option 3 (right col) | fresh_input | no | submission_level |  |  |  |  |
| reason_other | checkbox | Other | 35 | Reason for Contact, option 4 (right col) | fresh_input | no | submission_level |  |  |  | triggers reason_other_text |
| reason_other_text | text_short | Other: ___ | 35 | next to "Other" checkbox | fresh_input | no | submission_level |  |  |  | conditional |
| opt_out_checkbox | checkbox | Check this box if you choose not to provide the contact information | 35 | bottom of fillable section, above signature | fresh_input | no | head_of_household_only |  |  |  | if checked, contact fields are not required |
| signature | signature | Signature of Applicant | 35 | bottom of page 35, signature line | signature_capture | yes | head_of_household_only |  |  |  | always required even if opt_out is checked |
| signature_date | date | Date | 35 | right of signature | date_auto | yes | head_of_household_only |  |  |  |  |

**Special handling:** HUD-92006 OMB 2502-0581 with an expiration date printed as 02/28/2019 in the EN packet — this is an expired OMB number, flagged in session-decisions for review with HACH. The instructional cover page is page 33 (EN); fillable form is page 35. The form is HOH-only signature. The "additional contact person/organization" section is optional — the tenant may opt out by checking the opt-out box, in which case all contact fields become non-required. Signature is required regardless. Reason for Contact is a multi-select checkbox group (9 options including Other + free text). ES pages (34, 36) mirror EN — note page 34 is blank decorative in the packet and the ES fillable form sits at page 36; ES form layout matches EN.

---

## briefing_docs_certification

EN page: 37 | ES page: 38

| field_name | field_type | label_on_form | page | position_hint | prefill_source | required | per_person_scope | trigger_form | trigger_upload | trigger_section | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| hoh_printed_name | text_short | Head of Household Printed Name | 37 | bottom of page, left | intake.applicant.full_name | yes | head_of_household_only |  |  |  |  |
| hoh_signature | signature | Signature | 37 | bottom of page, right of printed name | signature_capture | yes | head_of_household_only |  |  |  |  |
| hoh_signature_date | date | Date | 37 | below signature line | date_auto | yes | head_of_household_only |  |  |  |  |

**Special handling:** Acknowledge-only certification that the HOH received the 8 briefing documents listed (HUD-52675, HUD-92006, Things You Should Know, Reasonable Accommodation notice, VAWA notice, Lead Paint pamphlet, Is Fraud Worth It?, Housing Discrimination Complaint Form info). Single signer — `signer_scope = hoh_only`. Three fillable fields: printed name, signature, date. ES page (38) mirrors EN.

---

## criminal_background_release

EN page: 39 | ES page: 40

| field_name | field_type | label_on_form | page | position_hint | prefill_source | required | per_person_scope | trigger_form | trigger_upload | trigger_section | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| first_name | text_short | First Name | 39 | "Applicant Information" block, line 1 | intake.household.member_list | yes | each_adult |  |  |  | per the form footer: "All family members 18 years or older must complete and sign this form" |
| middle_initial | text_short | Middle Initial | 39 | line 1, middle | intake.household.member_list | no | each_adult |  |  |  |  |
| last_name | text_short | Last Name | 39 | line 1, right | intake.household.member_list | yes | each_adult |  |  |  |  |
| name_suffix_jr | checkbox | Jr. | 39 | line 2, left | intake.household.member_list | no | each_adult |  |  |  | radio: Jr/Sr/Other suffix |
| name_suffix_sr | checkbox | Sr. | 39 | line 2 | intake.household.member_list | no | each_adult |  |  |  |  |
| name_suffix_other | checkbox | Other name suffix | 39 | line 2 | intake.household.member_list | no | each_adult |  |  |  | triggers name_suffix_other_text |
| name_suffix_other_text | text_short | (Specify) | 39 | line 2, after Other checkbox | fresh_input | no | each_adult |  |  |  | conditional |
| dob | date | Date of Birth (mm/dd/yyyy) | 39 | line 2, right | intake.household.member_list | yes | each_adult |  |  |  |  |
| ssn | ssn | Social Security Number (SSN) | 39 | line 3 — 3-digit/2-digit/4-digit split | intake.household.member_list | yes | each_adult |  |  |  |  |
| current_address_street | address | Current Address | 39 | line 4, left | intake.applicant.address | yes | each_adult |  |  |  |  |
| current_address_apt | text_short | Apt. # | 39 | line 4, right | intake.applicant.address | no | each_adult |  |  |  |  |
| current_address_city | address | City | 39 | line 5, left | intake.applicant.address | yes | each_adult |  |  |  |  |
| current_address_state | text_short | State | 39 | line 5, middle | intake.applicant.address | yes | each_adult |  |  |  |  |
| current_address_zip | text_short | Zip | 39 | line 5, right | intake.applicant.address | yes | each_adult |  |  |  |  |
| previous_address_street | address | Previous Address | 39 | line 6, left | fresh_input | no | each_adult |  |  |  |  |
| previous_address_apt | text_short | Apt. # | 39 | line 6, right | fresh_input | no | each_adult |  |  |  |  |
| previous_address_city | address | City | 39 | line 7, left | fresh_input | no | each_adult |  |  |  |  |
| previous_address_state | text_short | State | 39 | line 7, middle | fresh_input | no | each_adult |  |  |  |  |
| previous_address_zip | text_short | Zip | 39 | line 7, right | fresh_input | no | each_adult |  |  |  |  |
| signature | signature | Signature | 39 | bottom of page, signature block 1 | signature_capture | yes | each_adult |  |  |  |  |
| signature_date | date | Date | 39 | right of signature line | date_auto | yes | each_adult |  |  |  |  |
| witness_signature | signature | Witness | 39 | bottom of page, signature block 2 | signature_capture | yes | submission_level |  |  |  | staff witness signature |
| witness_signature_date | date | Date | 39 | right of witness line | date_auto | yes | submission_level |  |  |  |  |

**Special handling:** Per the form's own footer text — "All family members 18 years or older must complete and sign this form" — `signer_scope = all_adults` and the renderer must generate one full form instance per adult in the household (not just one signature block). Each instance carries the full applicant information block (name, DOB, SSN, addresses). The witness signature is a staff-side field, not tenant — keep it on the form template but assign to staff in the workflow. SSN is captured as a structured 3-2-4 split per HUD convention. ES page (40) mirrors EN.


---

## zero_income_statement

**Status:** [Unverified] — HACH publishes this form bilingually but the PDF is image-based (no OCR available in this environment). Field set below is constructed from standard HUD/PHA zero-income statement practice and needs confirmation against the actual HACH PDF when sourced.

**Source:** Zero Income Statement-Bilingual.pdf — published on HACH's public Forms and Documents page

**Trigger:** any adult listed in `zero_income_name` on the main_application Section III

| field_name | field_type | label_on_form | page | position_hint | prefill_source | required | per_person_scope | trigger_form | trigger_upload | trigger_section | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| affiant_name | text_short | I, ___ | 1 | top of form, declarant line | intake.household.member_list | yes | each_adult | | | | [Unverified] one form per zero-income adult |
| affiant_address | address | Address | 1 | header block | intake.applicant.address | yes | each_adult | | | | [Unverified] |
| period_start_date | date | for the period beginning ___ | 1 | declaration line | date_auto | yes | each_adult | | | | [Inference] standard HUD pattern — period of zero income |
| has_no_income_checkbox | checkbox | I certify I have no income | 1 | certification statement | fresh_input | yes | each_adult | | | | [Unverified] structure |
| support_explanation | text_long | How are you supporting yourself? | 1 | open-text explanation block | fresh_input | yes | each_adult | | | | [Inference] standard zero-income forms ask this |
| outside_contributions | text_long | Are you receiving any contributions from outside the household? | 1 | open-text follow-up | fresh_input | no | each_adult | | | | [Inference] |
| signature | signature | Signature | 1 | bottom of form | signature_capture | yes | each_adult | | | | [Unverified] |
| signature_date | date | Date | 1 | right of signature | date_auto | yes | each_adult | | | | [Unverified] |

**Special handling:** [Unverified] structure — confirm fields against the actual HACH PDF before building the renderer. HACH also publishes a companion staff-facing form ("Zero Income Interview and Checklist" / "HACH Zero Income Questionnaire") which is completed at the intake interview, not by the tenant — that one is outside the tenant-facing form pipeline. Per HUD/HACH standard practice, the zero-income statement is re-signed every ~90 days during ongoing participation; for the initial application pipeline, one signing at intake is sufficient. Form is bilingual (EN/ES) per HACH publication.


---

## Summary — field counts

| form_id | field count |
|---|---|
| main_application | 320 |
| hud_9886a | 16 |
| hach_release | 15 |
| child_support_affidavit | 8 |
| no_child_support_affidavit | 6 |
| citizenship_declaration | 8 |
| obligations_of_family | 5 |
| eiv_guide_receipt | 2 |
| debts_owed_phas | 3 |
| hud_92006 | 23 |
| briefing_docs_certification | 3 |
| criminal_background_release | 23 |
| zero_income_statement | 8 |
| **GRAND TOTAL** | **440** |

**Notes on counting:**

- Every yes/no checkbox is counted as 2 separate fields (one per option) per the spec rule "Don't skip checkboxes or radio groups. Each option is a distinct field."
- Repeating-row tables (household members, income sources, asset categories, expense rows, criminal history) are counted by the visible row × column structure of the printed form. In the rendered web app, these become repeating components — the *renderable* field count per submission may be higher or lower than this static count depending on actual household size and number of income sources.
- The main_application count of 320 reflects the form's structural complexity: it includes ~80 fields for the income table (16 income types × 5 columns), ~50 for assets (10 categories × 5 columns), ~60 for the household expenses table (30 expense rows × 2 columns each), plus criminal history, household roster, signatures, and section-level Y/N questions.
- VAWA Certification (HUD-5382) and Reasonable Accommodation Request forms are **not in this packet** and are not counted. They are triggered by `q8_dv_yes` and `q10_reasonable_accommodation_yes` on the main_application.
- The `zero_income_statement` field set is [Unverified] — constructed from standard HUD/PHA practice. Confirm against the actual HACH bilingual PDF when sourced.

---

## Conditional Trigger Reference

Three columns in every field table drive renderer logic:

- **trigger_form** — when this field is set (typically `_yes` checked), generate the named form. Used by the form-fill pipeline.
- **trigger_upload** — when this field is set, require the named doc_type in `application_documents`. Used by the upload pipeline.
- **trigger_section** — when this field meets a threshold, unhide/render the named section. Compound conditions are computed at the form level (see Gating Rules below).

A field can populate any combination of these three columns. For example, `income_child_support_yes` fires both a form (`child_support_affidavit`) and an upload (`child_support_doc`); `q10_reasonable_accommodation_yes` fires both a form (`reasonable_accommodation_request`) and an upload (`ra_supporting_doc`).

### Form-level gating rules

Some sections of `main_application` are conditionally rendered based on compound criteria that span multiple fields. These aren't captured by per-field `trigger_section` because they require evaluating the full household roster.

| Section / Form variant | Activation rule |
|---|---|
| Section VI (medical expenses) | Active if any HOH or spouse row has `adult_disabled = yes` OR `adult_age >= 62` |
| Section VIII (household expenses) | Active if all adults in household appear in `zero_income_name` list (i.e., household-wide zero income) |
| `child_support_affidavit` vs `no_child_support_affidavit` | Mutually exclusive. Driven by `income_child_support_yes` vs `income_child_support_no`. Render exactly one. |
| `vawa_certification` | Render only if `q8_dv_yes` is checked |
| `reasonable_accommodation_request` | Render only if `q10_reasonable_accommodation_yes` is checked |
| `zero_income_statement` | Render once per adult listed in Section III `zero_income_name` |

### Doc-type slugs referenced in trigger_upload

Slugs are renderer/pipeline conventions, not HACH terminology. Map to `application_documents.doc_type`:

| trigger_upload slug | Description |
|---|---|
| paystubs | 4 weekly or 2 bi-weekly paystubs |
| pension_award_letter | Current pension or retirement award letter |
| ssi_award_letter | Current SSI award benefit letter |
| ss_award_letter | Current Social Security award benefit letter |
| railroad_award_letter | Current railroad retirement award letter |
| child_support_doc | Court order OR child support printout OR payment history |
| tanf_benefit_letter | Current TANF benefit letter from DSS |
| snap_benefit_letter | Current SNAP benefit letter from DSS |
| tax_return_or_worksheet | Last tax return filed, or HACH-provided self-employment worksheet if no return |
| unemployment_letter | Unemployment benefit letter |
| workers_comp_letter | Worker's compensation benefit letter |
| rental_contract | Rental income contract + amount of earnings |
| school_letter | Letter from school re: grants/scholarships |
| digital_wallet_statements_3mo | 3 months of CashApp/Zelle/Venmo/PayPal statements |
| other_income_doc | Written documentation of other income |
| deed_or_tax_statement | Property deed or tax statement showing value |
| bank_statement | Single bank statement (stocks/CD/trust/bonds) |
| bank_statements_3mo | 3 months of bank statements (savings/checking) |
| settlement_letter | Insurance settlement benefit letter |
| policy_showing_value | Life insurance policy with cash value |
| other_asset_doc | Written documentation of other asset |
| care4kids_cert | Care4Kids program certificate |
| medical_insurance_doc | Insurance statement and/or cancelled checks (past year) |
| doctor_bills_1yr | Doctor's bill showing 1-year payment total |
| pharmacy_statement_1yr | Pharmacy statement for last year |
| other_medical_doc | Written documentation of other medical expense |
| immigration_doc_set | One of: I-551, I-94, I-688, I-688B, or INS receipt |
| student_schedule_or_letter | Student detailed schedule OR letter from institution |
| ra_supporting_doc | Doctor's letter or third-party verification for RA request |

### Triggered forms NOT in this inventory

Some form-fill triggers point to forms outside the 13 inventoried here. Track these in your post-launch sourcing list:

| trigger_form slug | Source / Notes |
|---|---|
| vawa_certification | HUD-5382, downloadable from HUD.gov. Bilingual versions available. |
| reasonable_accommodation_request | HACH form — request from Section 504 Coordinator (860-723-8462). Likely combined with healthcare-provider release. |
| self_employment_worksheet | HACH interview-time handout. [Inference] not published as a PDF. |
| gift_income_worksheet | HACH interview-time handout. [Inference] not published as a PDF. |
| childcare_relative_form | HACH interview-time handout. [Inference] not published; may overlap with Child Care Expense Verification (bilingual, already published). |


---

## JSON output (programmatic)

```json
{
  "forms": [
    {
      "form_id": "main_application",
      "fields": [
        {
          "field_name": "applicant_full_name",
          "field_type": "text_short",
          "label_on_form": "Name",
          "page": 1,
          "position_hint": "top, first line after header block",
          "prefill_source": "intake.applicant.full_name",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "applicant_email",
          "field_type": "email",
          "label_on_form": "Email Address",
          "page": 1,
          "position_hint": "top right, same line as Name",
          "prefill_source": "intake.applicant.email",
          "required": "no",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "phone_home",
          "field_type": "phone",
          "label_on_form": "Phone Numbers \u2013 Home",
          "page": 1,
          "position_hint": "second line, left",
          "prefill_source": "intake.applicant.phone",
          "required": "no",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "one of home/work/cell expected"
        },
        {
          "field_name": "phone_work",
          "field_type": "phone",
          "label_on_form": "Work",
          "page": 1,
          "position_hint": "second line, middle",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "phone_cell",
          "field_type": "phone",
          "label_on_form": "Cell",
          "page": 1,
          "position_hint": "second line, right",
          "prefill_source": "intake.applicant.phone",
          "required": "no",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "address_street",
          "field_type": "address",
          "label_on_form": "Address",
          "page": 1,
          "position_hint": "third line, left",
          "prefill_source": "intake.applicant.address",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "address_city_state_zip",
          "field_type": "address",
          "label_on_form": "City, ST, Zip",
          "page": 1,
          "position_hint": "third line, right",
          "prefill_source": "intake.applicant.address",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "alternate_contact_name",
          "field_type": "text_short",
          "label_on_form": "Provide an alternate contact name",
          "page": 1,
          "position_hint": "fourth line, left",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "alternate_contact_phone",
          "field_type": "phone",
          "label_on_form": "Phone Number",
          "page": 1,
          "position_hint": "fourth line, right",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "race_white",
          "field_type": "checkbox",
          "label_on_form": "White",
          "page": 1,
          "position_hint": "Section I, Race row, option 1",
          "prefill_source": "intake.applicant.race",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "radio group with 6 options"
        },
        {
          "field_name": "race_african_american",
          "field_type": "checkbox",
          "label_on_form": "African American",
          "page": 1,
          "position_hint": "Section I, Race row, option 2",
          "prefill_source": "intake.applicant.race",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "race_native_american",
          "field_type": "checkbox",
          "label_on_form": "Native American",
          "page": 1,
          "position_hint": "Section I, Race row, option 3",
          "prefill_source": "intake.applicant.race",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "race_asian",
          "field_type": "checkbox",
          "label_on_form": "Asian",
          "page": 1,
          "position_hint": "Section I, Race row, option 4",
          "prefill_source": "intake.applicant.race",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "race_pacific_islander",
          "field_type": "checkbox",
          "label_on_form": "Pacific Islander",
          "page": 1,
          "position_hint": "Section I, Race row, option 5",
          "prefill_source": "intake.applicant.race",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "race_other",
          "field_type": "checkbox",
          "label_on_form": "Other",
          "page": 1,
          "position_hint": "Section I, Race row, option 6",
          "prefill_source": "intake.applicant.race",
          "required": "no",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "triggers race_other_text"
        },
        {
          "field_name": "race_other_text",
          "field_type": "text_short",
          "label_on_form": "Other: ___",
          "page": 1,
          "position_hint": "Section I, Race row, after Other checkbox",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "conditional on race_other"
        },
        {
          "field_name": "hispanic_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes",
          "page": 1,
          "position_hint": "Section I, \"Are you Hispanic or Latin?\"",
          "prefill_source": "intake.applicant.ethnicity",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "radio pair"
        },
        {
          "field_name": "hispanic_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 1,
          "position_hint": "same line as hispanic_yes",
          "prefill_source": "intake.applicant.ethnicity",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "marital_single",
          "field_type": "checkbox",
          "label_on_form": "Single",
          "page": 1,
          "position_hint": "Section I, marital status line",
          "prefill_source": "intake.applicant.marital_status",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "radio group of 4"
        },
        {
          "field_name": "marital_married",
          "field_type": "checkbox",
          "label_on_form": "Married",
          "page": 1,
          "position_hint": "same line",
          "prefill_source": "intake.applicant.marital_status",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "marital_separated",
          "field_type": "checkbox",
          "label_on_form": "Separated",
          "page": 1,
          "position_hint": "same line",
          "prefill_source": "intake.applicant.marital_status",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "marital_divorced",
          "field_type": "checkbox",
          "label_on_form": "Divorced",
          "page": 1,
          "position_hint": "same line",
          "prefill_source": "intake.applicant.marital_status",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "adult_last_name",
          "field_type": "text_short",
          "label_on_form": "Last",
          "page": 1,
          "position_hint": "Adults table, col 1",
          "prefill_source": "intake.household.member_list",
          "required": "yes",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "Adults table repeats 6 rows; first row pre-marked SELF in Relationship col"
        },
        {
          "field_name": "adult_first_name",
          "field_type": "text_short",
          "label_on_form": "First",
          "page": 1,
          "position_hint": "Adults table, col 2",
          "prefill_source": "intake.household.member_list",
          "required": "yes",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "repeats per adult row"
        },
        {
          "field_name": "adult_middle_initial",
          "field_type": "text_short",
          "label_on_form": "MI",
          "page": 1,
          "position_hint": "Adults table, col 3",
          "prefill_source": "intake.household.member_list",
          "required": "no",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "repeats per adult row"
        },
        {
          "field_name": "adult_dob",
          "field_type": "date",
          "label_on_form": "Date Of Birth",
          "page": 1,
          "position_hint": "Adults table, col 4",
          "prefill_source": "intake.household.member_list",
          "required": "yes",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "repeats per adult row"
        },
        {
          "field_name": "adult_ssn",
          "field_type": "ssn",
          "label_on_form": "Social Security #",
          "page": 1,
          "position_hint": "Adults table, col 5",
          "prefill_source": "intake.applicant.ssn / intake.household.member_list",
          "required": "yes",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "repeats per adult row"
        },
        {
          "field_name": "adult_relationship",
          "field_type": "text_short",
          "label_on_form": "Relationship",
          "page": 1,
          "position_hint": "Adults table, col 6",
          "prefill_source": "intake.household.member_list",
          "required": "yes",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "first row prefilled \"SELF\"; repeats per adult row"
        },
        {
          "field_name": "adult_disabled",
          "field_type": "radio",
          "label_on_form": "Disabled Yes/No",
          "page": 1,
          "position_hint": "Adults table, col 7",
          "prefill_source": "intake.household.member_list",
          "required": "yes",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": "section_vi_conditional",
          "notes": "repeats per adult row"
        },
        {
          "field_name": "adult_student",
          "field_type": "radio",
          "label_on_form": "Student Yes/No",
          "page": 1,
          "position_hint": "Adults table, col 8",
          "prefill_source": "intake.household.member_list",
          "required": "yes",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "repeats per adult row"
        },
        {
          "field_name": "adult_age",
          "field_type": "text_short",
          "label_on_form": "Age",
          "page": 1,
          "position_hint": "Adults table, col 9",
          "prefill_source": "intake.household.member_list",
          "required": "yes",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": "section_vi_conditional",
          "notes": "repeats per adult row"
        },
        {
          "field_name": "adult_us_citizen",
          "field_type": "radio",
          "label_on_form": "U.S. Citizen Yes/No",
          "page": 1,
          "position_hint": "Adults table, col 10",
          "prefill_source": "intake.citizenship.<member>",
          "required": "yes",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "repeats per adult row"
        },
        {
          "field_name": "school_fulltime_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes",
          "page": 1,
          "position_hint": "below adults table, \"Does any adult family member attend school full-time?\"",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": "student_schedule_or_letter",
          "trigger_section": null,
          "notes": "radio pair"
        },
        {
          "field_name": "school_fulltime_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 1,
          "position_hint": "same line",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "school_fulltime_who",
          "field_type": "text_short",
          "label_on_form": "If yes, who?",
          "page": 1,
          "position_hint": "same line, end",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "conditional on school_fulltime_yes"
        },
        {
          "field_name": "minor_last_name",
          "field_type": "text_short",
          "label_on_form": "Last",
          "page": 1,
          "position_hint": "Minors table, col 1",
          "prefill_source": "intake.household.member_list",
          "required": "yes",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "Minors table repeats 8 rows"
        },
        {
          "field_name": "minor_first_name",
          "field_type": "text_short",
          "label_on_form": "First",
          "page": 1,
          "position_hint": "Minors table, col 2",
          "prefill_source": "intake.household.member_list",
          "required": "yes",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "minor_middle_initial",
          "field_type": "text_short",
          "label_on_form": "MI",
          "page": 1,
          "position_hint": "Minors table, col 3",
          "prefill_source": "intake.household.member_list",
          "required": "no",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "minor_dob",
          "field_type": "date",
          "label_on_form": "Date Of Birth",
          "page": 1,
          "position_hint": "Minors table, col 4",
          "prefill_source": "intake.household.member_list",
          "required": "yes",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "minor_ssn",
          "field_type": "ssn",
          "label_on_form": "Social Security #",
          "page": 1,
          "position_hint": "Minors table, col 5",
          "prefill_source": "intake.household.member_list",
          "required": "yes",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "minor_relationship",
          "field_type": "text_short",
          "label_on_form": "Relationship",
          "page": 1,
          "position_hint": "Minors table, col 6",
          "prefill_source": "intake.household.member_list",
          "required": "yes",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "minor_disabled",
          "field_type": "radio",
          "label_on_form": "Disabled Yes/No",
          "page": 1,
          "position_hint": "Minors table, col 7",
          "prefill_source": "intake.household.member_list",
          "required": "yes",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "minor_student",
          "field_type": "radio",
          "label_on_form": "Student Yes/No",
          "page": 1,
          "position_hint": "Minors table, col 8",
          "prefill_source": "intake.household.member_list",
          "required": "yes",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "minor_age",
          "field_type": "text_short",
          "label_on_form": "Age",
          "page": 1,
          "position_hint": "Minors table, col 9",
          "prefill_source": "intake.household.member_list",
          "required": "yes",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "minor_us_citizen",
          "field_type": "radio",
          "label_on_form": "U.S. Citizen Yes/No",
          "page": 1,
          "position_hint": "Minors table, col 10",
          "prefill_source": "intake.citizenship.<member>",
          "required": "yes",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_employed_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (Employed)",
          "page": 3,
          "position_hint": "Section II income table, row \"Employed\" \u2014 3 rows for 3 jobs",
          "prefill_source": "intake.income.employment",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": "paystubs",
          "trigger_section": null,
          "notes": "Income table; 3 employment rows"
        },
        {
          "field_name": "income_employed_no",
          "field_type": "checkbox",
          "label_on_form": "No (Employed)",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.employment",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_employed_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 3,
          "position_hint": "Section II, col Family Member",
          "prefill_source": "intake.income.employment",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "per row"
        },
        {
          "field_name": "income_employed_source",
          "field_type": "text_short",
          "label_on_form": "Source",
          "page": 3,
          "position_hint": "Section II, col Source",
          "prefill_source": "intake.income.employment",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "per row"
        },
        {
          "field_name": "income_employed_amount",
          "field_type": "currency",
          "label_on_form": "Amount per Month",
          "page": 3,
          "position_hint": "Section II, col Amount per Month",
          "prefill_source": "intake.income.employment",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "per row"
        },
        {
          "field_name": "income_pension_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (Pension or Retirement)",
          "page": 3,
          "position_hint": "Section II, row Pension/Retirement",
          "prefill_source": "intake.income.pension",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": "pension_award_letter",
          "trigger_section": null,
          "notes": "full row pattern: yes/no/member/source/amount"
        },
        {
          "field_name": "income_pension_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.pension",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_pension_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.pension",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_pension_source",
          "field_type": "text_short",
          "label_on_form": "Source",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.pension",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_pension_amount",
          "field_type": "currency",
          "label_on_form": "Amount per Month",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.pension",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_ssi_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (SSI)",
          "page": 3,
          "position_hint": "Section II, SSI row (2 rows)",
          "prefill_source": "intake.income.ssi",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": "ssi_award_letter",
          "trigger_section": null,
          "notes": "2 SSI rows"
        },
        {
          "field_name": "income_ssi_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.ssi",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_ssi_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.ssi",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "per row"
        },
        {
          "field_name": "income_ssi_source",
          "field_type": "text_short",
          "label_on_form": "Source",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.ssi",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "per row"
        },
        {
          "field_name": "income_ssi_amount",
          "field_type": "currency",
          "label_on_form": "Amount per Month",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.ssi",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "per row"
        },
        {
          "field_name": "income_ss_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (Social Security)",
          "page": 3,
          "position_hint": "Section II, Social Security row (2 rows)",
          "prefill_source": "intake.income.social_security",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": "ss_award_letter",
          "trigger_section": null,
          "notes": "2 SS rows"
        },
        {
          "field_name": "income_ss_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.social_security",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_ss_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.social_security",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "per row"
        },
        {
          "field_name": "income_ss_source",
          "field_type": "text_short",
          "label_on_form": "Source",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.social_security",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "per row"
        },
        {
          "field_name": "income_ss_amount",
          "field_type": "currency",
          "label_on_form": "Amount per Month",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.social_security",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "per row"
        },
        {
          "field_name": "income_railroad_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (Railroad Retirement)",
          "page": 3,
          "position_hint": "Section II, Railroad Retirement row",
          "prefill_source": "intake.income.railroad",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": "railroad_award_letter",
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_railroad_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.railroad",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_railroad_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.railroad",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_railroad_source",
          "field_type": "text_short",
          "label_on_form": "Source",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.railroad",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_railroad_amount",
          "field_type": "currency",
          "label_on_form": "Amount per Month",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.railroad",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_child_support_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (Child Support/Alimony)",
          "page": 3,
          "position_hint": "Section II, Child Support row",
          "prefill_source": "intake.income.child_support",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": "child_support_affidavit",
          "trigger_upload": "child_support_doc",
          "trigger_section": null,
          "notes": "drives child_support_affidavit vs no_child_support_affidavit"
        },
        {
          "field_name": "income_child_support_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.child_support",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": "no_child_support_affidavit",
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_child_support_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.child_support",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_child_support_source",
          "field_type": "text_short",
          "label_on_form": "Source",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.child_support",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_child_support_amount",
          "field_type": "currency",
          "label_on_form": "Amount per Month",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.child_support",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_tanf_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (TANF)",
          "page": 3,
          "position_hint": "Section II, TANF row",
          "prefill_source": "intake.income.tanf",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": "tanf_benefit_letter",
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_tanf_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.tanf",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_tanf_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.tanf",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_tanf_source",
          "field_type": "text_short",
          "label_on_form": "Source",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.tanf",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_tanf_amount",
          "field_type": "currency",
          "label_on_form": "Amount per Month",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.tanf",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_snap_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (Food Stamp/SNAP)",
          "page": 3,
          "position_hint": "Section II, SNAP row",
          "prefill_source": "intake.income.snap",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": "snap_benefit_letter",
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_snap_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.snap",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_snap_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.snap",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_snap_source",
          "field_type": "text_short",
          "label_on_form": "Source",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.snap",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_snap_amount",
          "field_type": "currency",
          "label_on_form": "Amount per Month",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.snap",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_self_employed_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (Self-Employed)",
          "page": 3,
          "position_hint": "Section II, Self-Employed row",
          "prefill_source": "intake.income.self_employment",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": "self_employment_worksheet",
          "trigger_upload": "tax_return_or_worksheet",
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_self_employed_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.self_employment",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_self_employed_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.self_employment",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_self_employed_source",
          "field_type": "text_short",
          "label_on_form": "Source",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.self_employment",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_self_employed_amount",
          "field_type": "currency",
          "label_on_form": "Amount per Month",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.self_employment",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_unemployment_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (Unemployment)",
          "page": 3,
          "position_hint": "Section II, Unemployment row (2 rows)",
          "prefill_source": "intake.income.unemployment",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": "unemployment_letter",
          "trigger_section": null,
          "notes": "2 unemployment rows"
        },
        {
          "field_name": "income_unemployment_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.unemployment",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_unemployment_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.unemployment",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "per row"
        },
        {
          "field_name": "income_unemployment_source",
          "field_type": "text_short",
          "label_on_form": "Source",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.unemployment",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "per row"
        },
        {
          "field_name": "income_unemployment_amount",
          "field_type": "currency",
          "label_on_form": "Amount per Month",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.unemployment",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "per row"
        },
        {
          "field_name": "income_workers_comp_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (Worker's Comp)",
          "page": 3,
          "position_hint": "Section II, Workers Comp row",
          "prefill_source": "intake.income.workers_comp",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": "workers_comp_letter",
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_workers_comp_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.workers_comp",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_workers_comp_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.workers_comp",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_workers_comp_source",
          "field_type": "text_short",
          "label_on_form": "Source",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.workers_comp",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_workers_comp_amount",
          "field_type": "currency",
          "label_on_form": "Amount per Month",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.workers_comp",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_rental_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (Rental/Other Assets)",
          "page": 3,
          "position_hint": "Section II, Rental Income row",
          "prefill_source": "intake.income.rental",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": "rental_contract",
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_rental_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.rental",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_rental_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.rental",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_rental_source",
          "field_type": "text_short",
          "label_on_form": "Source",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.rental",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_rental_amount",
          "field_type": "currency",
          "label_on_form": "Amount per Month",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.rental",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_gifts_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (Regular Contributions/Gifts)",
          "page": 3,
          "position_hint": "Section II, Contributions/Gifts row",
          "prefill_source": "intake.income.gifts",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": "gift_income_worksheet",
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_gifts_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.gifts",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_gifts_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.gifts",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_gifts_source",
          "field_type": "text_short",
          "label_on_form": "Source",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.gifts",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_gifts_amount",
          "field_type": "currency",
          "label_on_form": "Amount per Month",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.gifts",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_paid_training_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (Paid Training)",
          "page": 3,
          "position_hint": "Section II, Paid Training row",
          "prefill_source": "intake.income.paid_training",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_paid_training_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.paid_training",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_paid_training_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.paid_training",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_paid_training_source",
          "field_type": "text_short",
          "label_on_form": "Source",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.paid_training",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_paid_training_amount",
          "field_type": "currency",
          "label_on_form": "Amount per Month",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.paid_training",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_grants_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (Grants/Scholarships)",
          "page": 3,
          "position_hint": "Section II, Grants/Scholarships row",
          "prefill_source": "intake.income.grants",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": "school_letter",
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_grants_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.grants",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_grants_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.grants",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_grants_source",
          "field_type": "text_short",
          "label_on_form": "Source",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.grants",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_grants_amount",
          "field_type": "currency",
          "label_on_form": "Amount per Month",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.grants",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_cashapp_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (CashApp/Zelle/Venmo/PayPal)",
          "page": 3,
          "position_hint": "Section II, CashApp row",
          "prefill_source": "intake.income.digital_wallet",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": "digital_wallet_statements_3mo",
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_cashapp_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.digital_wallet",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_cashapp_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.digital_wallet",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_cashapp_source",
          "field_type": "text_short",
          "label_on_form": "Source",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.digital_wallet",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_cashapp_amount",
          "field_type": "currency",
          "label_on_form": "Amount per Month",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.digital_wallet",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_other_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (Other)",
          "page": 3,
          "position_hint": "Section II, Other row",
          "prefill_source": "intake.income.other",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": "other_income_doc",
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_other_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.other",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_other_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.other",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_other_source",
          "field_type": "text_short",
          "label_on_form": "Source",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.other",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "income_other_amount",
          "field_type": "currency",
          "label_on_form": "Amount per Month",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "intake.income.other",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "zero_income_name",
          "field_type": "text_short",
          "label_on_form": "Name",
          "page": 3,
          "position_hint": "Section III, list of names",
          "prefill_source": "intake.household.member_list",
          "required": "no",
          "per_person_scope": "each_adult",
          "trigger_form": "zero_income_statement",
          "trigger_upload": null,
          "trigger_section": "section_viii_conditional",
          "notes": "adults claiming zero income; multiple rows"
        },
        {
          "field_name": "q1_outside_help_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes",
          "page": 3,
          "position_hint": "Section III, Q1",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "\"Does anyone outside the household assist you with bills?\""
        },
        {
          "field_name": "q1_outside_help_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 3,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "q1_outside_help_explain",
          "field_type": "text_long",
          "label_on_form": "If yes, explain",
          "page": 3,
          "position_hint": "end of page 3",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "conditional on q1_yes"
        },
        {
          "field_name": "q2_pending_benefits_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes",
          "page": 5,
          "position_hint": "top of page 5, Q2",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "\"Has anyone in your household applied for benefits that are in the process of being approved?\""
        },
        {
          "field_name": "q2_pending_benefits_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "q2_pending_benefits_explain",
          "field_type": "text_long",
          "label_on_form": "If yes, explain",
          "page": 5,
          "position_hint": "below Q2",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "conditional on q2_yes"
        },
        {
          "field_name": "asset_real_estate_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (Real Estate/Land)",
          "page": 5,
          "position_hint": "Section IV assets table, Real Estate row",
          "prefill_source": "intake.assets.real_estate",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": "deed_or_tax_statement",
          "trigger_section": null,
          "notes": "Assets table \u2014 10 rows: yes/no, member, source, amount each"
        },
        {
          "field_name": "asset_real_estate_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.real_estate",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_real_estate_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.real_estate",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_real_estate_source",
          "field_type": "text_short",
          "label_on_form": "Source",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.real_estate",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_real_estate_value",
          "field_type": "currency",
          "label_on_form": "Amount or Market Value",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.real_estate",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_stocks_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (Stocks)",
          "page": 5,
          "position_hint": "Section IV, Stocks row",
          "prefill_source": "intake.assets.stocks",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": "bank_statement",
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_stocks_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.stocks",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_stocks_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.stocks",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_stocks_source",
          "field_type": "text_short",
          "label_on_form": "Source",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.stocks",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_stocks_value",
          "field_type": "currency",
          "label_on_form": "Amount or Market Value",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.stocks",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_savings_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (Savings Account)",
          "page": 5,
          "position_hint": "Section IV, Savings row",
          "prefill_source": "intake.assets.savings",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": "bank_statements_3mo",
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_savings_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.savings",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_savings_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.savings",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_savings_source",
          "field_type": "text_short",
          "label_on_form": "Source",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.savings",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_savings_value",
          "field_type": "currency",
          "label_on_form": "Amount or Market Value",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.savings",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_checking_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (Checking Account)",
          "page": 5,
          "position_hint": "Section IV, Checking row",
          "prefill_source": "intake.assets.checking",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": "bank_statements_3mo",
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_checking_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.checking",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_checking_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.checking",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_checking_source",
          "field_type": "text_short",
          "label_on_form": "Source",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.checking",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_checking_value",
          "field_type": "currency",
          "label_on_form": "Amount or Market Value",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.checking",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_insurance_settlement_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (Insurance Settlement)",
          "page": 5,
          "position_hint": "Section IV, Insurance Settlement row",
          "prefill_source": "intake.assets.insurance_settlement",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": "settlement_letter",
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_insurance_settlement_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.insurance_settlement",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_insurance_settlement_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.insurance_settlement",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_insurance_settlement_source",
          "field_type": "text_short",
          "label_on_form": "Source",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.insurance_settlement",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_insurance_settlement_value",
          "field_type": "currency",
          "label_on_form": "Amount or Market Value",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.insurance_settlement",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_cd_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (Certificate of Deposit)",
          "page": 5,
          "position_hint": "Section IV, CD row",
          "prefill_source": "intake.assets.cd",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": "bank_statement",
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_cd_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.cd",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_cd_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.cd",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_cd_source",
          "field_type": "text_short",
          "label_on_form": "Source",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.cd",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_cd_value",
          "field_type": "currency",
          "label_on_form": "Amount or Market Value",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.cd",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_trust_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (Trust)",
          "page": 5,
          "position_hint": "Section IV, Trust row",
          "prefill_source": "intake.assets.trust",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": "bank_statement",
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_trust_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.trust",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_trust_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.trust",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_trust_source",
          "field_type": "text_short",
          "label_on_form": "Source",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.trust",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_trust_value",
          "field_type": "currency",
          "label_on_form": "Amount or Market Value",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.trust",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_bonds_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (Bonds)",
          "page": 5,
          "position_hint": "Section IV, Bonds row",
          "prefill_source": "intake.assets.bonds",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": "bank_statement",
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_bonds_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.bonds",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_bonds_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.bonds",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_bonds_source",
          "field_type": "text_short",
          "label_on_form": "Source",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.bonds",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_bonds_value",
          "field_type": "currency",
          "label_on_form": "Amount or Market Value",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.bonds",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_life_insurance_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (Life Insurance)",
          "page": 5,
          "position_hint": "Section IV, Life Insurance row",
          "prefill_source": "intake.assets.life_insurance",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": "policy_showing_value",
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_life_insurance_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.life_insurance",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_life_insurance_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.life_insurance",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_life_insurance_source",
          "field_type": "text_short",
          "label_on_form": "Source",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.life_insurance",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_life_insurance_value",
          "field_type": "currency",
          "label_on_form": "Amount or Market Value",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.life_insurance",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_other_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (Other)",
          "page": 5,
          "position_hint": "Section IV, Other row",
          "prefill_source": "intake.assets.other",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": "other_asset_doc",
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_other_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.other",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_other_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.other",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_other_source",
          "field_type": "text_short",
          "label_on_form": "Source",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.other",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "asset_other_value",
          "field_type": "currency",
          "label_on_form": "Amount or Market Value",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.assets.other",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "q3_sold_assets_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes",
          "page": 5,
          "position_hint": "Section IV, Q3",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "\"Have you sold or given away any assets in the last two (2) years?\""
        },
        {
          "field_name": "q3_sold_assets_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "q3_sold_assets_explain",
          "field_type": "text_long",
          "label_on_form": "If yes, explain",
          "page": 5,
          "position_hint": "below Q3",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "conditional"
        },
        {
          "field_name": "q4_childcare_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes",
          "page": 5,
          "position_hint": "Section V, Q4",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "\"Do you pay for childcare...\""
        },
        {
          "field_name": "q4_childcare_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "q5_care4kids_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes",
          "page": 5,
          "position_hint": "Section V, Q5",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": "care4kids_cert",
          "trigger_section": null,
          "notes": "triggers care4kids upload requirement"
        },
        {
          "field_name": "q5_care4kids_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "q6_childcare_relative_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes",
          "page": 5,
          "position_hint": "Section V, Q6",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": "childcare_relative_form",
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "triggers separate form provision"
        },
        {
          "field_name": "q6_childcare_relative_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "medical_insurance_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (Medical Insurance)",
          "page": 5,
          "position_hint": "Section VI medical table (4 rows)",
          "prefill_source": "intake.medical.insurance",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": "medical_insurance_doc",
          "trigger_section": null,
          "notes": "Section VI only required if HOH/spouse disabled or 62+"
        },
        {
          "field_name": "medical_insurance_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.medical.insurance",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "medical_insurance_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.medical.insurance",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "medical_insurance_source",
          "field_type": "text_short",
          "label_on_form": "Source",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.medical.insurance",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "medical_insurance_amount",
          "field_type": "currency",
          "label_on_form": "Amount",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.medical.insurance",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "medical_doctor_visits_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (Doctor's Visits)",
          "page": 5,
          "position_hint": "Section VI, Doctor's Visits row",
          "prefill_source": "intake.medical.doctor",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": "doctor_bills_1yr",
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "medical_doctor_visits_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.medical.doctor",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "medical_doctor_visits_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.medical.doctor",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "medical_doctor_visits_source",
          "field_type": "text_short",
          "label_on_form": "Source",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.medical.doctor",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "medical_doctor_visits_amount",
          "field_type": "currency",
          "label_on_form": "Amount",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.medical.doctor",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "medical_prescription_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (Prescription Medicine)",
          "page": 5,
          "position_hint": "Section VI, Prescription row",
          "prefill_source": "intake.medical.prescription",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": "pharmacy_statement_1yr",
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "medical_prescription_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.medical.prescription",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "medical_prescription_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.medical.prescription",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "medical_prescription_source",
          "field_type": "text_short",
          "label_on_form": "Source",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.medical.prescription",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "medical_prescription_amount",
          "field_type": "currency",
          "label_on_form": "Amount",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.medical.prescription",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "medical_other_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (Other)",
          "page": 5,
          "position_hint": "Section VI, Other row",
          "prefill_source": "intake.medical.other",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": "other_medical_doc",
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "medical_other_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.medical.other",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "medical_other_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.medical.other",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "medical_other_source",
          "field_type": "text_short",
          "label_on_form": "Source",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.medical.other",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "medical_other_amount",
          "field_type": "currency",
          "label_on_form": "Amount",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "intake.medical.other",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "q7_violent_crime_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (Violent Criminal Activity)",
          "page": 5,
          "position_hint": "Section VII criminal table, row 1",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "Criminal history table \u2014 per household member per row"
        },
        {
          "field_name": "q7_violent_crime_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "q7_violent_crime_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "q7_violent_crime_details",
          "field_type": "text_long",
          "label_on_form": "Give Details",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "q7_alcohol_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (Alcohol Related Activity)",
          "page": 5,
          "position_hint": "Section VII, row 2",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "q7_alcohol_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "q7_alcohol_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "q7_alcohol_details",
          "field_type": "text_long",
          "label_on_form": "Give Details",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "q7_meth_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (Manufacture of Methamphetamines)",
          "page": 5,
          "position_hint": "Section VII, row 3",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "q7_meth_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "q7_meth_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "q7_meth_details",
          "field_type": "text_long",
          "label_on_form": "Give Details",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "q7_drugs_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (Possession/Sale/Distribution of Illegal Drugs)",
          "page": 5,
          "position_hint": "Section VII, row 4",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "q7_drugs_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "q7_drugs_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "q7_drugs_details",
          "field_type": "text_long",
          "label_on_form": "Give Details",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "q7_sex_offender_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (Required to Register as Sex Offender)",
          "page": 5,
          "position_hint": "Section VII, row 5",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "q7_sex_offender_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "q7_sex_offender_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "q7_sex_offender_details",
          "field_type": "text_long",
          "label_on_form": "Give Details",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "q7_other_convictions_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes (Other Convictions)",
          "page": 5,
          "position_hint": "Section VII, row 6",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "q7_other_convictions_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "q7_other_convictions_member",
          "field_type": "text_short",
          "label_on_form": "Family Member",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "q7_other_convictions_details",
          "field_type": "text_long",
          "label_on_form": "Give Details",
          "page": 5,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "q8_dv_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes",
          "page": 7,
          "position_hint": "top of page 7, Q8",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": "vawa_certification",
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "\"Are you a victim of domestic violence?\" \u2014 TRIGGERS vawa_certification"
        },
        {
          "field_name": "q8_dv_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 7,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "q9_homeless_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes",
          "page": 7,
          "position_hint": "Q9",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "\"Are you homeless at admission to the program?\""
        },
        {
          "field_name": "q9_homeless_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 7,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "q10_reasonable_accommodation_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes",
          "page": 7,
          "position_hint": "Q10",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": "reasonable_accommodation_request",
          "trigger_upload": "ra_supporting_doc",
          "trigger_section": null,
          "notes": "TRIGGERS reasonable_accommodation_request"
        },
        {
          "field_name": "q10_reasonable_accommodation_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 7,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_rent_amount",
          "field_type": "currency",
          "label_on_form": "Amount Per Month (Rent)",
          "page": 7,
          "position_hint": "Section VIII household expenses table, left col",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "Section VIII only if zero income; 16 expense rows in left col, 14 in right col"
        },
        {
          "field_name": "expense_rent_who_pays",
          "field_type": "text_short",
          "label_on_form": "Who Pays For This",
          "page": 7,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_light_amount",
          "field_type": "currency",
          "label_on_form": "Amount Per Month (Light)",
          "page": 7,
          "position_hint": "Section VIII, Light row",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_light_who_pays",
          "field_type": "text_short",
          "label_on_form": "Who Pays For This",
          "page": 7,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_gas_oil_amount",
          "field_type": "currency",
          "label_on_form": "Amount (Gas/Oil)",
          "page": 7,
          "position_hint": "Section VIII, Gas/Oil row",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_gas_oil_who_pays",
          "field_type": "text_short",
          "label_on_form": "Who Pays",
          "page": 7,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_water_amount",
          "field_type": "currency",
          "label_on_form": "Amount (Water)",
          "page": 7,
          "position_hint": "Section VIII, Water row",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_water_who_pays",
          "field_type": "text_short",
          "label_on_form": "Who Pays",
          "page": 7,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_vehicle_payment_amount",
          "field_type": "currency",
          "label_on_form": "Amount (Vehicle Payment)",
          "page": 7,
          "position_hint": "Section VIII",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_vehicle_payment_who_pays",
          "field_type": "text_short",
          "label_on_form": "Who Pays",
          "page": 7,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_vehicle_insurance_amount",
          "field_type": "currency",
          "label_on_form": "Amount (Vehicle Insurance/Taxes)",
          "page": 7,
          "position_hint": "Section VIII",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_vehicle_insurance_who_pays",
          "field_type": "text_short",
          "label_on_form": "Who Pays",
          "page": 7,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_cable_internet_amount",
          "field_type": "currency",
          "label_on_form": "Amount (Cable/Internet)",
          "page": 7,
          "position_hint": "Section VIII",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_cable_internet_who_pays",
          "field_type": "text_short",
          "label_on_form": "Who Pays",
          "page": 7,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_phone_home_amount",
          "field_type": "currency",
          "label_on_form": "Amount (Phone Home)",
          "page": 7,
          "position_hint": "Section VIII",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_phone_home_who_pays",
          "field_type": "text_short",
          "label_on_form": "Who Pays",
          "page": 7,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_phone_cell_amount",
          "field_type": "currency",
          "label_on_form": "Amount (Phone Cell)",
          "page": 7,
          "position_hint": "Section VIII",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_phone_cell_who_pays",
          "field_type": "text_short",
          "label_on_form": "Who Pays",
          "page": 7,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_childcare_amount",
          "field_type": "currency",
          "label_on_form": "Amount (Child Care)",
          "page": 7,
          "position_hint": "Section VIII",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_childcare_who_pays",
          "field_type": "text_short",
          "label_on_form": "Who Pays",
          "page": 7,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_furniture_rental_amount",
          "field_type": "currency",
          "label_on_form": "Amount (Furniture Rental)",
          "page": 7,
          "position_hint": "Section VIII",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_furniture_rental_who_pays",
          "field_type": "text_short",
          "label_on_form": "Who Pays",
          "page": 7,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_misc_amount",
          "field_type": "currency",
          "label_on_form": "Amount (MISC: lottery, manicures, etc.)",
          "page": 7,
          "position_hint": "Section VIII",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_misc_who_pays",
          "field_type": "text_short",
          "label_on_form": "Who Pays",
          "page": 7,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_baby_products_amount",
          "field_type": "currency",
          "label_on_form": "Amount (Baby Products)",
          "page": 7,
          "position_hint": "Section VIII",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_baby_products_who_pays",
          "field_type": "text_short",
          "label_on_form": "Who Pays",
          "page": 7,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_credit_cards_amount",
          "field_type": "currency",
          "label_on_form": "Amount (Credit Cards)",
          "page": 7,
          "position_hint": "Section VIII",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "list all"
        },
        {
          "field_name": "expense_credit_cards_who_pays",
          "field_type": "text_short",
          "label_on_form": "Who Pays",
          "page": 7,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_other_left_amount",
          "field_type": "currency",
          "label_on_form": "Amount (Other)",
          "page": 7,
          "position_hint": "Section VIII left col, Other row",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_other_left_who_pays",
          "field_type": "text_short",
          "label_on_form": "Who Pays",
          "page": 7,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_groceries_amount",
          "field_type": "currency",
          "label_on_form": "Amount (Groceries in Cash)",
          "page": 7,
          "position_hint": "Section VIII right col",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "right col: 14 expense rows"
        },
        {
          "field_name": "expense_groceries_who_pays",
          "field_type": "text_short",
          "label_on_form": "Who Pays",
          "page": 7,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_takeout_amount",
          "field_type": "currency",
          "label_on_form": "Amount (Take Out Food)",
          "page": 7,
          "position_hint": "Section VIII right col",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_takeout_who_pays",
          "field_type": "text_short",
          "label_on_form": "Who Pays",
          "page": 7,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_paper_products_amount",
          "field_type": "currency",
          "label_on_form": "Amount (Paper Products, etc.)",
          "page": 7,
          "position_hint": "Section VIII right col",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_paper_products_who_pays",
          "field_type": "text_short",
          "label_on_form": "Who Pays",
          "page": 7,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_grooming_amount",
          "field_type": "currency",
          "label_on_form": "Amount (Grooming Products)",
          "page": 7,
          "position_hint": "Section VIII right col",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_grooming_who_pays",
          "field_type": "text_short",
          "label_on_form": "Who Pays",
          "page": 7,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_cleaning_amount",
          "field_type": "currency",
          "label_on_form": "Amount (Cleaning/Laundry)",
          "page": 7,
          "position_hint": "Section VIII right col",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_cleaning_who_pays",
          "field_type": "text_short",
          "label_on_form": "Who Pays",
          "page": 7,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_gas_vehicle_amount",
          "field_type": "currency",
          "label_on_form": "Amount (Gas for Vehicle)",
          "page": 7,
          "position_hint": "Section VIII right col",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_gas_vehicle_who_pays",
          "field_type": "text_short",
          "label_on_form": "Who Pays",
          "page": 7,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_clothing_amount",
          "field_type": "currency",
          "label_on_form": "Amount (Clothing/Shoes)",
          "page": 7,
          "position_hint": "Section VIII right col",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_clothing_who_pays",
          "field_type": "text_short",
          "label_on_form": "Who Pays",
          "page": 7,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_entertainment_amount",
          "field_type": "currency",
          "label_on_form": "Amount (Entertainment)",
          "page": 7,
          "position_hint": "Section VIII right col",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_entertainment_who_pays",
          "field_type": "text_short",
          "label_on_form": "Who Pays",
          "page": 7,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_public_transport_amount",
          "field_type": "currency",
          "label_on_form": "Amount (Public Transportation)",
          "page": 7,
          "position_hint": "Section VIII right col",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_public_transport_who_pays",
          "field_type": "text_short",
          "label_on_form": "Who Pays",
          "page": 7,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_jewelry_amount",
          "field_type": "currency",
          "label_on_form": "Amount (Jewelry)",
          "page": 7,
          "position_hint": "Section VIII right col",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_jewelry_who_pays",
          "field_type": "text_short",
          "label_on_form": "Who Pays",
          "page": 7,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_household_items_amount",
          "field_type": "currency",
          "label_on_form": "Amount (Household Items)",
          "page": 7,
          "position_hint": "Section VIII right col",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_household_items_who_pays",
          "field_type": "text_short",
          "label_on_form": "Who Pays",
          "page": 7,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_vehicle_maintenance_amount",
          "field_type": "currency",
          "label_on_form": "Amount (Vehicle Maintenance)",
          "page": 7,
          "position_hint": "Section VIII right col",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_vehicle_maintenance_who_pays",
          "field_type": "text_short",
          "label_on_form": "Who Pays",
          "page": 7,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_doctor_prescriptions_amount",
          "field_type": "currency",
          "label_on_form": "Amount (Doctor's/Prescriptions)",
          "page": 7,
          "position_hint": "Section VIII right col",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_doctor_prescriptions_who_pays",
          "field_type": "text_short",
          "label_on_form": "Who Pays",
          "page": 7,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_loans_amount",
          "field_type": "currency",
          "label_on_form": "Amount (Loans)",
          "page": 7,
          "position_hint": "Section VIII right col",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "list all"
        },
        {
          "field_name": "expense_loans_who_pays",
          "field_type": "text_short",
          "label_on_form": "Who Pays",
          "page": 7,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_other_right_amount",
          "field_type": "currency",
          "label_on_form": "Amount (Other)",
          "page": 7,
          "position_hint": "Section VIII right col, Other",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "expense_other_right_who_pays",
          "field_type": "text_short",
          "label_on_form": "Who Pays",
          "page": 7,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "notices_read_yes",
          "field_type": "checkbox",
          "label_on_form": "Yes",
          "page": 9,
          "position_hint": "bottom of page 9, \"I have read and understood the above important notices\"",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "acknowledgment"
        },
        {
          "field_name": "notices_read_no",
          "field_type": "checkbox",
          "label_on_form": "No",
          "page": 9,
          "position_hint": "same",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "hoh_signature",
          "field_type": "signature",
          "label_on_form": "Signature of Head of Household",
          "page": 9,
          "position_hint": "first signature block",
          "prefill_source": "signature_capture",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "hoh_signature_date",
          "field_type": "date",
          "label_on_form": "Date",
          "page": 9,
          "position_hint": "same line, right",
          "prefill_source": "date_auto",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "spouse_signature_1",
          "field_type": "signature",
          "label_on_form": "Signature of Spouse of Head of Household, Co-Head, or Other Adult",
          "page": 9,
          "position_hint": "second signature block",
          "prefill_source": "signature_capture",
          "required": "conditional",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "required for each additional adult; 5 spouse/co-head/other adult lines provided"
        },
        {
          "field_name": "spouse_signature_1_date",
          "field_type": "date",
          "label_on_form": "Date",
          "page": 9,
          "position_hint": "same line",
          "prefill_source": "date_auto",
          "required": "conditional",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "spouse_signature_2",
          "field_type": "signature",
          "label_on_form": "Signature of Spouse of Head of Household, Co-Head, or Other Adult",
          "page": 9,
          "position_hint": "third signature block",
          "prefill_source": "signature_capture",
          "required": "conditional",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "spouse_signature_2_date",
          "field_type": "date",
          "label_on_form": "Date",
          "page": 9,
          "position_hint": "same line",
          "prefill_source": "date_auto",
          "required": "conditional",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "spouse_signature_3",
          "field_type": "signature",
          "label_on_form": "Signature of Spouse of Head of Household, Co-Head, or Other Adult",
          "page": 9,
          "position_hint": "fourth signature block",
          "prefill_source": "signature_capture",
          "required": "conditional",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "spouse_signature_3_date",
          "field_type": "date",
          "label_on_form": "Date",
          "page": 9,
          "position_hint": "same line",
          "prefill_source": "date_auto",
          "required": "conditional",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "spouse_signature_4",
          "field_type": "signature",
          "label_on_form": "Signature of Spouse of Head of Household, Co-Head, or Other Adult",
          "page": 9,
          "position_hint": "fifth signature block",
          "prefill_source": "signature_capture",
          "required": "conditional",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "spouse_signature_4_date",
          "field_type": "date",
          "label_on_form": "Date",
          "page": 9,
          "position_hint": "same line",
          "prefill_source": "date_auto",
          "required": "conditional",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "spouse_signature_5",
          "field_type": "signature",
          "label_on_form": "Signature of Spouse of Head of Household, Co-Head, or Other Adult",
          "page": 9,
          "position_hint": "sixth signature block",
          "prefill_source": "signature_capture",
          "required": "conditional",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "spouse_signature_5_date",
          "field_type": "date",
          "label_on_form": "Date",
          "page": 9,
          "position_hint": "same line",
          "prefill_source": "date_auto",
          "required": "conditional",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        }
      ],
      "gating_rules": {
        "section_vi_active": "any HOH or spouse row has adult_disabled=yes OR adult_age>=62",
        "section_viii_active": "all adults in household are listed in zero_income_name"
      }
    },
    {
      "form_id": "hud_9886a",
      "fields": [
        {
          "field_name": "pha_contact_block",
          "field_type": "text_long",
          "label_on_form": "PHA or IHA requesting release of information (full address, name of contact person, and date)",
          "page": 11,
          "position_hint": "top of page 11, just below title",
          "prefill_source": "fresh_input (HACH prefill)",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "HACH agency info \u2014 should be pre-populated by Stanton, not tenant input"
        },
        {
          "field_name": "hoh_signature",
          "field_type": "signature",
          "label_on_form": "Head of Household",
          "page": 13,
          "position_hint": "top of page 13 signature block, left column",
          "prefill_source": "signature_capture",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "hoh_signature_date",
          "field_type": "date",
          "label_on_form": "Date",
          "page": 13,
          "position_hint": "same line, right of HOH signature",
          "prefill_source": "date_auto",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "hoh_ssn",
          "field_type": "ssn",
          "label_on_form": "Social Security Number (if any) of Head of Household",
          "page": 13,
          "position_hint": "below HOH signature line",
          "prefill_source": "intake.applicant.ssn",
          "required": "no",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "\"if any\" \u2014 explicitly optional"
        },
        {
          "field_name": "spouse_signature",
          "field_type": "signature",
          "label_on_form": "Spouse",
          "page": 13,
          "position_hint": "second left signature block",
          "prefill_source": "signature_capture",
          "required": "conditional",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "conditional on spouse in household"
        },
        {
          "field_name": "spouse_signature_date",
          "field_type": "date",
          "label_on_form": "Date",
          "page": 13,
          "position_hint": "same line",
          "prefill_source": "date_auto",
          "required": "conditional",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "other_adult_1_signature",
          "field_type": "signature",
          "label_on_form": "Other Family Member over age 18",
          "page": 13,
          "position_hint": "left col, 3rd signature block",
          "prefill_source": "signature_capture",
          "required": "conditional",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "up to 6 other adult slots total (3 left, 3 right)"
        },
        {
          "field_name": "other_adult_1_signature_date",
          "field_type": "date",
          "label_on_form": "Date",
          "page": 13,
          "position_hint": "same line",
          "prefill_source": "date_auto",
          "required": "conditional",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "other_adult_2_signature",
          "field_type": "signature",
          "label_on_form": "Other Family Member over age 18",
          "page": 13,
          "position_hint": "right col, 1st signature block",
          "prefill_source": "signature_capture",
          "required": "conditional",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "other_adult_2_signature_date",
          "field_type": "date",
          "label_on_form": "Date",
          "page": 13,
          "position_hint": "same line",
          "prefill_source": "date_auto",
          "required": "conditional",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "other_adult_3_signature",
          "field_type": "signature",
          "label_on_form": "Other Family Member over age 18",
          "page": 13,
          "position_hint": "right col, 2nd signature block",
          "prefill_source": "signature_capture",
          "required": "conditional",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "other_adult_3_signature_date",
          "field_type": "date",
          "label_on_form": "Date",
          "page": 13,
          "position_hint": "same line",
          "prefill_source": "date_auto",
          "required": "conditional",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "other_adult_4_signature",
          "field_type": "signature",
          "label_on_form": "Other Family Member over age 18",
          "page": 13,
          "position_hint": "right col, 3rd signature block",
          "prefill_source": "signature_capture",
          "required": "conditional",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "other_adult_4_signature_date",
          "field_type": "date",
          "label_on_form": "Date",
          "page": 13,
          "position_hint": "same line",
          "prefill_source": "date_auto",
          "required": "conditional",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "other_adult_5_signature",
          "field_type": "signature",
          "label_on_form": "Other Family Member over age 18",
          "page": 13,
          "position_hint": "left col, 4th signature block (if present)",
          "prefill_source": "signature_capture",
          "required": "conditional",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "other_adult_5_signature_date",
          "field_type": "date",
          "label_on_form": "Date",
          "page": 13,
          "position_hint": "same line",
          "prefill_source": "date_auto",
          "required": "conditional",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        }
      ]
    },
    {
      "form_id": "hach_release",
      "fields": [
        {
          "field_name": "applicant_name",
          "field_type": "text_short",
          "label_on_form": "Name",
          "page": 15,
          "position_hint": "top left, below \"To: The Housing Authority of the City of Hartford\"",
          "prefill_source": "intake.applicant.full_name",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "applicant_address_line1",
          "field_type": "address",
          "label_on_form": "Address",
          "page": 15,
          "position_hint": "below Name",
          "prefill_source": "intake.applicant.address",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "first address line"
        },
        {
          "field_name": "applicant_address_line2",
          "field_type": "address",
          "label_on_form": "(Address line 2)",
          "page": 15,
          "position_hint": "below first address line",
          "prefill_source": "intake.applicant.address",
          "required": "no",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "continuation line"
        },
        {
          "field_name": "hoh_signature",
          "field_type": "signature",
          "label_on_form": "Signature and Printed Name of Head of Household",
          "page": 15,
          "position_hint": "bottom of page, signature block 1",
          "prefill_source": "signature_capture",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "hoh_printed_name",
          "field_type": "text_short",
          "label_on_form": "(Printed Name)",
          "page": 15,
          "position_hint": "combined with HOH signature line",
          "prefill_source": "intake.applicant.full_name",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "label says \"Signature and Printed Name\""
        },
        {
          "field_name": "hoh_signature_date",
          "field_type": "date",
          "label_on_form": "Date",
          "page": 15,
          "position_hint": "right of HOH signature line",
          "prefill_source": "date_auto",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "spouse_signature",
          "field_type": "signature",
          "label_on_form": "Signature and Printed Name of Spouse or Other Adult",
          "page": 15,
          "position_hint": "signature block 2",
          "prefill_source": "signature_capture",
          "required": "conditional",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "spouse_printed_name",
          "field_type": "text_short",
          "label_on_form": "(Printed Name)",
          "page": 15,
          "position_hint": "combined with spouse signature line",
          "prefill_source": "intake.household.member_list",
          "required": "conditional",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "spouse_signature_date",
          "field_type": "date",
          "label_on_form": "Date",
          "page": 15,
          "position_hint": "right of spouse signature line",
          "prefill_source": "date_auto",
          "required": "conditional",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "other_adult_1_signature",
          "field_type": "signature",
          "label_on_form": "Signature and Printed Name of Other Adult",
          "page": 15,
          "position_hint": "signature block 3",
          "prefill_source": "signature_capture",
          "required": "conditional",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "up to 2 additional other adult slots"
        },
        {
          "field_name": "other_adult_1_printed_name",
          "field_type": "text_short",
          "label_on_form": "(Printed Name)",
          "page": 15,
          "position_hint": "combined with signature line",
          "prefill_source": "intake.household.member_list",
          "required": "conditional",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "other_adult_1_signature_date",
          "field_type": "date",
          "label_on_form": "Date",
          "page": 15,
          "position_hint": "right of signature line",
          "prefill_source": "date_auto",
          "required": "conditional",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "other_adult_2_signature",
          "field_type": "signature",
          "label_on_form": "Signature and Printed Name of Other Adult",
          "page": 15,
          "position_hint": "signature block 4",
          "prefill_source": "signature_capture",
          "required": "conditional",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "other_adult_2_printed_name",
          "field_type": "text_short",
          "label_on_form": "(Printed Name)",
          "page": 15,
          "position_hint": "combined with signature line",
          "prefill_source": "intake.household.member_list",
          "required": "conditional",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "other_adult_2_signature_date",
          "field_type": "date",
          "label_on_form": "Date",
          "page": 15,
          "position_hint": "right of signature line",
          "prefill_source": "date_auto",
          "required": "conditional",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        }
      ]
    },
    {
      "form_id": "child_support_affidavit",
      "fields": [
        {
          "field_name": "affiant_name",
          "field_type": "text_short",
          "label_on_form": "I, ___",
          "page": 17,
          "position_hint": "top of top-half block, \"I, ___, of Hartford, CT\"",
          "prefill_source": "intake.applicant.full_name",
          "required": "yes",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "the affiant \u2014 typically HOH or recipient parent"
        },
        {
          "field_name": "affiant_address",
          "field_type": "address",
          "label_on_form": "Your Name Address",
          "page": 17,
          "position_hint": "upper right, address block",
          "prefill_source": "intake.applicant.address",
          "required": "yes",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "header address block"
        },
        {
          "field_name": "affiant_zip",
          "field_type": "text_short",
          "label_on_form": "Zip Code",
          "page": 17,
          "position_hint": "upper right, address block",
          "prefill_source": "intake.applicant.address",
          "required": "yes",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "children_names",
          "field_type": "text_long",
          "label_on_form": "for my child(ren): ___",
          "page": 17,
          "position_hint": "mid-block, after \"of Hartford, CT certify that I receive child support for my child(ren):\"",
          "prefill_source": "intake.household.member_list",
          "required": "yes",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "list of children covered"
        },
        {
          "field_name": "amount_weekly",
          "field_type": "currency",
          "label_on_form": "$ ___ weekly",
          "page": 17,
          "position_hint": "\"in the amount of $ ___ weekly\"",
          "prefill_source": "intake.income.child_support",
          "required": "conditional",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "one of weekly OR monthly"
        },
        {
          "field_name": "amount_monthly",
          "field_type": "currency",
          "label_on_form": "or $ ___ monthly",
          "page": 17,
          "position_hint": "\"or $ ___ monthly\"",
          "prefill_source": "intake.income.child_support",
          "required": "conditional",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "one of weekly OR monthly"
        },
        {
          "field_name": "signature",
          "field_type": "signature",
          "label_on_form": "Signature",
          "page": 17,
          "position_hint": "bottom of top block",
          "prefill_source": "signature_capture",
          "required": "yes",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "signature_date",
          "field_type": "date",
          "label_on_form": "Date",
          "page": 17,
          "position_hint": "right of signature line",
          "prefill_source": "date_auto",
          "required": "yes",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        }
      ],
      "gating_rules": {
        "render_when": "income_child_support_yes is checked",
        "mutually_exclusive_with": "no_child_support_affidavit"
      }
    },
    {
      "form_id": "no_child_support_affidavit",
      "fields": [
        {
          "field_name": "affiant_name",
          "field_type": "text_short",
          "label_on_form": "I, ___",
          "page": 17,
          "position_hint": "top of bottom-half block, \"I, ___, of Hartford, CT\"",
          "prefill_source": "intake.applicant.full_name",
          "required": "yes",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "the affiant"
        },
        {
          "field_name": "affiant_address",
          "field_type": "address",
          "label_on_form": "Your Name Address",
          "page": 17,
          "position_hint": "bottom-half address block",
          "prefill_source": "intake.applicant.address",
          "required": "yes",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "header address block (duplicated from top variant)"
        },
        {
          "field_name": "affiant_zip",
          "field_type": "text_short",
          "label_on_form": "Zip Code",
          "page": 17,
          "position_hint": "bottom-half address block",
          "prefill_source": "intake.applicant.address",
          "required": "yes",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "children_names",
          "field_type": "text_long",
          "label_on_form": "for my child(ren): ___",
          "page": 17,
          "position_hint": "mid-block, \"certify that I do not receive child support for my child(ren):\"",
          "prefill_source": "intake.household.member_list",
          "required": "yes",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "list of children"
        },
        {
          "field_name": "signature",
          "field_type": "signature",
          "label_on_form": "Signature",
          "page": 17,
          "position_hint": "bottom of page 17",
          "prefill_source": "signature_capture",
          "required": "yes",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "signature_date",
          "field_type": "date",
          "label_on_form": "Date",
          "page": 17,
          "position_hint": "right of signature line",
          "prefill_source": "date_auto",
          "required": "yes",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        }
      ],
      "gating_rules": {
        "render_when": "income_child_support_no is checked",
        "mutually_exclusive_with": "child_support_affidavit"
      }
    },
    {
      "form_id": "citizenship_declaration",
      "fields": [
        {
          "field_name": "member_name",
          "field_type": "text_short",
          "label_on_form": "Family Member Name",
          "page": 19,
          "position_hint": "member table, col 1",
          "prefill_source": "intake.household.member_list",
          "required": "yes",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "table repeats per household member; 9 rows shown"
        },
        {
          "field_name": "member_dob",
          "field_type": "date",
          "label_on_form": "Date of Birth",
          "page": 19,
          "position_hint": "member table, col 2",
          "prefill_source": "intake.household.member_list",
          "required": "yes",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "per row"
        },
        {
          "field_name": "member_status_1",
          "field_type": "checkbox",
          "label_on_form": "Status 1 (citizen)",
          "page": 19,
          "position_hint": "member table, col 3 \u2014 status section, box \"1\"",
          "prefill_source": "intake.citizenship.<member>",
          "required": "yes",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "radio group of 3: 1=citizen, 2=eligible non-citizen, 3=not declaring"
        },
        {
          "field_name": "member_status_2",
          "field_type": "checkbox",
          "label_on_form": "Status 2 (eligible immigration status)",
          "page": 19,
          "position_hint": "member table, col 3 \u2014 status section, box \"2\"",
          "prefill_source": "intake.citizenship.<member>",
          "required": "yes",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": "immigration_doc_set",
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "member_status_3",
          "field_type": "checkbox",
          "label_on_form": "Status 3 (choose not to declare)",
          "page": 19,
          "position_hint": "member table, col 3 \u2014 status section, box \"3\"",
          "prefill_source": "intake.citizenship.<member>",
          "required": "yes",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "member_signature",
          "field_type": "signature",
          "label_on_form": "Signature of Adult or parent/guardian on behalf of minor under 18",
          "page": 19,
          "position_hint": "member table, col 4 (last)",
          "prefill_source": "signature_capture",
          "required": "yes",
          "per_person_scope": "individual",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "adults sign for themselves; parent/guardian signs for minors"
        },
        {
          "field_name": "hoh_certification_signature",
          "field_type": "signature",
          "label_on_form": "Head of Household Signature",
          "page": 19,
          "position_hint": "bottom of page, separate from member table",
          "prefill_source": "signature_capture",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "HOH penalty-of-perjury cert that household list is complete and accurate"
        },
        {
          "field_name": "hoh_certification_date",
          "field_type": "date",
          "label_on_form": "Date",
          "page": 19,
          "position_hint": "right of HOH cert signature",
          "prefill_source": "date_auto",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        }
      ]
    },
    {
      "form_id": "obligations_of_family",
      "fields": [
        {
          "field_name": "hoh_name",
          "field_type": "text_short",
          "label_on_form": "Head of Household",
          "page": 23,
          "position_hint": "bottom of page, left column, line 1",
          "prefill_source": "intake.applicant.full_name",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "printed name"
        },
        {
          "field_name": "hoh_signature_date",
          "field_type": "date",
          "label_on_form": "Date",
          "page": 23,
          "position_hint": "bottom of page, right column, line 1",
          "prefill_source": "date_auto",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "hoh_signature",
          "field_type": "signature",
          "label_on_form": "Head of Household Signature",
          "page": 23,
          "position_hint": "bottom of page, left column, line 2",
          "prefill_source": "signature_capture",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "hoh_phone",
          "field_type": "phone",
          "label_on_form": "Phone",
          "page": 23,
          "position_hint": "bottom of page, right column, line 2",
          "prefill_source": "intake.applicant.phone",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "hoh_address",
          "field_type": "address",
          "label_on_form": "Address",
          "page": 23,
          "position_hint": "bottom of page, last line",
          "prefill_source": "intake.applicant.address",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        }
      ]
    },
    {
      "form_id": "eiv_guide_receipt",
      "fields": [
        {
          "field_name": "signature",
          "field_type": "signature",
          "label_on_form": "Signature",
          "page": 27,
          "position_hint": "bottom-right of page 27, end of the EIV guide content",
          "prefill_source": "signature_capture",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "\"My signature below is confirmation that I have received this Guide\""
        },
        {
          "field_name": "signature_date",
          "field_type": "date",
          "label_on_form": "Date",
          "page": 27,
          "position_hint": "right of signature line on page 27",
          "prefill_source": "date_auto",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        }
      ]
    },
    {
      "form_id": "debts_owed_phas",
      "fields": [
        {
          "field_name": "signature",
          "field_type": "signature",
          "label_on_form": "Signature",
          "page": 31,
          "position_hint": "bottom of page 31, right side acknowledgment box",
          "prefill_source": "signature_capture",
          "required": "yes",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "per HUD-52675 instruction \"Each adult household member must sign this form\""
        },
        {
          "field_name": "signature_date",
          "field_type": "date",
          "label_on_form": "Date",
          "page": 31,
          "position_hint": "right of signature line",
          "prefill_source": "date_auto",
          "required": "yes",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "printed_name",
          "field_type": "text_short",
          "label_on_form": "Printed Name",
          "page": 31,
          "position_hint": "below signature line",
          "prefill_source": "intake.household.member_list",
          "required": "yes",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        }
      ]
    },
    {
      "form_id": "hud_92006",
      "fields": [
        {
          "field_name": "applicant_name",
          "field_type": "text_short",
          "label_on_form": "Applicant Name",
          "page": 35,
          "position_hint": "top of fillable section, left",
          "prefill_source": "intake.applicant.full_name",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "applicant_mailing_address",
          "field_type": "address",
          "label_on_form": "Mailing Address",
          "page": 35,
          "position_hint": "second line",
          "prefill_source": "intake.applicant.address",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "applicant_phone",
          "field_type": "phone",
          "label_on_form": "Telephone No",
          "page": 35,
          "position_hint": "third line, left",
          "prefill_source": "intake.applicant.phone",
          "required": "no",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "applicant_cell",
          "field_type": "phone",
          "label_on_form": "Cell Phone No",
          "page": 35,
          "position_hint": "third line, right",
          "prefill_source": "intake.applicant.phone",
          "required": "no",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "contact_name",
          "field_type": "text_short",
          "label_on_form": "Name of Additional Contact Person or Organization",
          "page": 35,
          "position_hint": "\"Additional Contact\" section, line 1",
          "prefill_source": "fresh_input",
          "required": "conditional",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "conditional on opt_out_checkbox NOT checked"
        },
        {
          "field_name": "contact_address",
          "field_type": "address",
          "label_on_form": "Address",
          "page": 35,
          "position_hint": "\"Additional Contact\" section, line 2",
          "prefill_source": "fresh_input",
          "required": "conditional",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "contact_phone",
          "field_type": "phone",
          "label_on_form": "Telephone No",
          "page": 35,
          "position_hint": "\"Additional Contact\" section, line 3 left",
          "prefill_source": "fresh_input",
          "required": "conditional",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "contact_cell",
          "field_type": "phone",
          "label_on_form": "Cell Phone No",
          "page": 35,
          "position_hint": "\"Additional Contact\" section, line 3 right",
          "prefill_source": "fresh_input",
          "required": "conditional",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "contact_email",
          "field_type": "email",
          "label_on_form": "E-Mail Address (if applicable)",
          "page": 35,
          "position_hint": "\"Additional Contact\" section, line 4",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "contact_relationship",
          "field_type": "text_short",
          "label_on_form": "Relationship to Applicant",
          "page": 35,
          "position_hint": "\"Additional Contact\" section, line 5",
          "prefill_source": "fresh_input",
          "required": "conditional",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "reason_emergency",
          "field_type": "checkbox",
          "label_on_form": "Emergency",
          "page": 35,
          "position_hint": "Reason for Contact, option 1 (left col)",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "check all that apply \u2014 multi-select"
        },
        {
          "field_name": "reason_unable_to_contact",
          "field_type": "checkbox",
          "label_on_form": "Unable to contact you",
          "page": 35,
          "position_hint": "Reason for Contact, option 2 (left col)",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "reason_termination",
          "field_type": "checkbox",
          "label_on_form": "Termination of rental assistance",
          "page": 35,
          "position_hint": "Reason for Contact, option 3 (left col)",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "reason_eviction",
          "field_type": "checkbox",
          "label_on_form": "Eviction from unit",
          "page": 35,
          "position_hint": "Reason for Contact, option 4 (left col)",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "reason_late_payment",
          "field_type": "checkbox",
          "label_on_form": "Late payment of rent",
          "page": 35,
          "position_hint": "Reason for Contact, option 5 (left col)",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "reason_recertification",
          "field_type": "checkbox",
          "label_on_form": "Assist with Recertification Process",
          "page": 35,
          "position_hint": "Reason for Contact, option 1 (right col)",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "reason_lease_terms",
          "field_type": "checkbox",
          "label_on_form": "Change in lease terms",
          "page": 35,
          "position_hint": "Reason for Contact, option 2 (right col)",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "reason_house_rules",
          "field_type": "checkbox",
          "label_on_form": "Change in house rules",
          "page": 35,
          "position_hint": "Reason for Contact, option 3 (right col)",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "reason_other",
          "field_type": "checkbox",
          "label_on_form": "Other",
          "page": 35,
          "position_hint": "Reason for Contact, option 4 (right col)",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "triggers reason_other_text"
        },
        {
          "field_name": "reason_other_text",
          "field_type": "text_short",
          "label_on_form": "Other: ___",
          "page": 35,
          "position_hint": "next to \"Other\" checkbox",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "conditional"
        },
        {
          "field_name": "opt_out_checkbox",
          "field_type": "checkbox",
          "label_on_form": "Check this box if you choose not to provide the contact information",
          "page": 35,
          "position_hint": "bottom of fillable section, above signature",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "if checked, contact fields are not required"
        },
        {
          "field_name": "signature",
          "field_type": "signature",
          "label_on_form": "Signature of Applicant",
          "page": 35,
          "position_hint": "bottom of page 35, signature line",
          "prefill_source": "signature_capture",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "always required even if opt_out is checked"
        },
        {
          "field_name": "signature_date",
          "field_type": "date",
          "label_on_form": "Date",
          "page": 35,
          "position_hint": "right of signature",
          "prefill_source": "date_auto",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        }
      ]
    },
    {
      "form_id": "briefing_docs_certification",
      "fields": [
        {
          "field_name": "hoh_printed_name",
          "field_type": "text_short",
          "label_on_form": "Head of Household Printed Name",
          "page": 37,
          "position_hint": "bottom of page, left",
          "prefill_source": "intake.applicant.full_name",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "hoh_signature",
          "field_type": "signature",
          "label_on_form": "Signature",
          "page": 37,
          "position_hint": "bottom of page, right of printed name",
          "prefill_source": "signature_capture",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "hoh_signature_date",
          "field_type": "date",
          "label_on_form": "Date",
          "page": 37,
          "position_hint": "below signature line",
          "prefill_source": "date_auto",
          "required": "yes",
          "per_person_scope": "head_of_household_only",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        }
      ]
    },
    {
      "form_id": "criminal_background_release",
      "fields": [
        {
          "field_name": "first_name",
          "field_type": "text_short",
          "label_on_form": "First Name",
          "page": 39,
          "position_hint": "\"Applicant Information\" block, line 1",
          "prefill_source": "intake.household.member_list",
          "required": "yes",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "per the form footer: \"All family members 18 years or older must complete and sign this form\""
        },
        {
          "field_name": "middle_initial",
          "field_type": "text_short",
          "label_on_form": "Middle Initial",
          "page": 39,
          "position_hint": "line 1, middle",
          "prefill_source": "intake.household.member_list",
          "required": "no",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "last_name",
          "field_type": "text_short",
          "label_on_form": "Last Name",
          "page": 39,
          "position_hint": "line 1, right",
          "prefill_source": "intake.household.member_list",
          "required": "yes",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "name_suffix_jr",
          "field_type": "checkbox",
          "label_on_form": "Jr.",
          "page": 39,
          "position_hint": "line 2, left",
          "prefill_source": "intake.household.member_list",
          "required": "no",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "radio: Jr/Sr/Other suffix"
        },
        {
          "field_name": "name_suffix_sr",
          "field_type": "checkbox",
          "label_on_form": "Sr.",
          "page": 39,
          "position_hint": "line 2",
          "prefill_source": "intake.household.member_list",
          "required": "no",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "name_suffix_other",
          "field_type": "checkbox",
          "label_on_form": "Other name suffix",
          "page": 39,
          "position_hint": "line 2",
          "prefill_source": "intake.household.member_list",
          "required": "no",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "triggers name_suffix_other_text"
        },
        {
          "field_name": "name_suffix_other_text",
          "field_type": "text_short",
          "label_on_form": "(Specify)",
          "page": 39,
          "position_hint": "line 2, after Other checkbox",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "conditional"
        },
        {
          "field_name": "dob",
          "field_type": "date",
          "label_on_form": "Date of Birth (mm/dd/yyyy)",
          "page": 39,
          "position_hint": "line 2, right",
          "prefill_source": "intake.household.member_list",
          "required": "yes",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "ssn",
          "field_type": "ssn",
          "label_on_form": "Social Security Number (SSN)",
          "page": 39,
          "position_hint": "line 3 \u2014 3-digit/2-digit/4-digit split",
          "prefill_source": "intake.household.member_list",
          "required": "yes",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "current_address_street",
          "field_type": "address",
          "label_on_form": "Current Address",
          "page": 39,
          "position_hint": "line 4, left",
          "prefill_source": "intake.applicant.address",
          "required": "yes",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "current_address_apt",
          "field_type": "text_short",
          "label_on_form": "Apt. #",
          "page": 39,
          "position_hint": "line 4, right",
          "prefill_source": "intake.applicant.address",
          "required": "no",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "current_address_city",
          "field_type": "address",
          "label_on_form": "City",
          "page": 39,
          "position_hint": "line 5, left",
          "prefill_source": "intake.applicant.address",
          "required": "yes",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "current_address_state",
          "field_type": "text_short",
          "label_on_form": "State",
          "page": 39,
          "position_hint": "line 5, middle",
          "prefill_source": "intake.applicant.address",
          "required": "yes",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "current_address_zip",
          "field_type": "text_short",
          "label_on_form": "Zip",
          "page": 39,
          "position_hint": "line 5, right",
          "prefill_source": "intake.applicant.address",
          "required": "yes",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "previous_address_street",
          "field_type": "address",
          "label_on_form": "Previous Address",
          "page": 39,
          "position_hint": "line 6, left",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "previous_address_apt",
          "field_type": "text_short",
          "label_on_form": "Apt. #",
          "page": 39,
          "position_hint": "line 6, right",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "previous_address_city",
          "field_type": "address",
          "label_on_form": "City",
          "page": 39,
          "position_hint": "line 7, left",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "previous_address_state",
          "field_type": "text_short",
          "label_on_form": "State",
          "page": 39,
          "position_hint": "line 7, middle",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "previous_address_zip",
          "field_type": "text_short",
          "label_on_form": "Zip",
          "page": 39,
          "position_hint": "line 7, right",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "signature",
          "field_type": "signature",
          "label_on_form": "Signature",
          "page": 39,
          "position_hint": "bottom of page, signature block 1",
          "prefill_source": "signature_capture",
          "required": "yes",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "signature_date",
          "field_type": "date",
          "label_on_form": "Date",
          "page": 39,
          "position_hint": "right of signature line",
          "prefill_source": "date_auto",
          "required": "yes",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        },
        {
          "field_name": "witness_signature",
          "field_type": "signature",
          "label_on_form": "Witness",
          "page": 39,
          "position_hint": "bottom of page, signature block 2",
          "prefill_source": "signature_capture",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "staff witness signature"
        },
        {
          "field_name": "witness_signature_date",
          "field_type": "date",
          "label_on_form": "Date",
          "page": 39,
          "position_hint": "right of witness line",
          "prefill_source": "date_auto",
          "required": "yes",
          "per_person_scope": "submission_level",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": ""
        }
      ]
    },
    {
      "form_id": "zero_income_statement",
      "fields": [
        {
          "field_name": "affiant_name",
          "field_type": "text_short",
          "label_on_form": "I, ___",
          "page": 1,
          "position_hint": "top of form, declarant line",
          "prefill_source": "intake.household.member_list",
          "required": "yes",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "[Unverified] one form per zero-income adult"
        },
        {
          "field_name": "affiant_address",
          "field_type": "address",
          "label_on_form": "Address",
          "page": 1,
          "position_hint": "header block",
          "prefill_source": "intake.applicant.address",
          "required": "yes",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "[Unverified]"
        },
        {
          "field_name": "period_start_date",
          "field_type": "date",
          "label_on_form": "for the period beginning ___",
          "page": 1,
          "position_hint": "declaration line",
          "prefill_source": "date_auto",
          "required": "yes",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "[Inference] standard HUD pattern \u2014 period of zero income"
        },
        {
          "field_name": "has_no_income_checkbox",
          "field_type": "checkbox",
          "label_on_form": "I certify I have no income",
          "page": 1,
          "position_hint": "certification statement",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "[Unverified] structure"
        },
        {
          "field_name": "support_explanation",
          "field_type": "text_long",
          "label_on_form": "How are you supporting yourself?",
          "page": 1,
          "position_hint": "open-text explanation block",
          "prefill_source": "fresh_input",
          "required": "yes",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "[Inference] standard zero-income forms ask this"
        },
        {
          "field_name": "outside_contributions",
          "field_type": "text_long",
          "label_on_form": "Are you receiving any contributions from outside the household?",
          "page": 1,
          "position_hint": "open-text follow-up",
          "prefill_source": "fresh_input",
          "required": "no",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "[Inference]"
        },
        {
          "field_name": "signature",
          "field_type": "signature",
          "label_on_form": "Signature",
          "page": 1,
          "position_hint": "bottom of form",
          "prefill_source": "signature_capture",
          "required": "yes",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "[Unverified]"
        },
        {
          "field_name": "signature_date",
          "field_type": "date",
          "label_on_form": "Date",
          "page": 1,
          "position_hint": "right of signature",
          "prefill_source": "date_auto",
          "required": "yes",
          "per_person_scope": "each_adult",
          "trigger_form": null,
          "trigger_upload": null,
          "trigger_section": null,
          "notes": "[Unverified]"
        }
      ],
      "gating_rules": {
        "render_when": "any adult is listed in main_application.zero_income_name",
        "instance_per": "each_adult_listed"
      }
    }
  ]
}
```
