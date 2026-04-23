param(
    [string]$Base = 'http://localhost:3000',
    [string]$Password,
    [string]$Username
)

$pass = 0; $fail = 0
$script:ws = $null

function Check([string]$label, [bool]$ok, [string]$detail = '') {
    if ($ok) { Write-Host "  [PASS] $label" -ForegroundColor Green; $script:pass++ }
    else      { Write-Host "  [FAIL] $label$(if ($detail) { ': ' + $detail })" -ForegroundColor Red; $script:fail++ }
}

function CallApi([string]$method, [string]$path, $body = $null, [bool]$auth = $false) {
    $p = @{ Uri = "$Base$path"; Method = $method; UseBasicParsing = $true }
    if ($auth -and $script:ws) { $p.WebSession = $script:ws }
    if ($null -ne $body) { $p.Body = ($body | ConvertTo-Json -Depth 10); $p.ContentType = 'application/json' }
    try {
        $r    = Invoke-WebRequest @p -ErrorAction Stop
        $code = [int]$r.StatusCode
        try { $b = $r.Content | ConvertFrom-Json } catch { $b = [pscustomobject]@{ message = $r.Content } }
    } catch {
        $er   = $_.Exception.Response
        $code = if ($er) { [int]$er.StatusCode } else { 0 }
        try {
            $s = $er.GetResponseStream(); $rd = New-Object System.IO.StreamReader($s)
            $b = $rd.ReadToEnd() | ConvertFrom-Json
        } catch { $b = [pscustomobject]@{ message = "HTTP $code" } }
    }
    return [pscustomobject]@{ Code = $code; Body = $b }
}

function UploadFile([string]$path, [string]$fname, [string]$content) {
    $nl   = "`r`n"
    $bnd  = "----Boundary$([guid]::NewGuid().ToString('N'))"
    $hdr  = "--$bnd$nl" +
            "Content-Disposition: form-data; name=`"file`"; filename=`"$fname`"$nl" +
            "Content-Type: application/pdf$nl$nl"
    $ftr  = "$nl--$bnd--$nl"
    $hb   = [System.Text.Encoding]::UTF8.GetBytes($hdr)
    $cb   = [System.Text.Encoding]::UTF8.GetBytes($content)
    $fb   = [System.Text.Encoding]::UTF8.GetBytes($ftr)
    $buf  = New-Object byte[] ($hb.Length + $cb.Length + $fb.Length)
    [System.Buffer]::BlockCopy($hb, 0, $buf, 0,                     $hb.Length)
    [System.Buffer]::BlockCopy($cb, 0, $buf, $hb.Length,            $cb.Length)
    [System.Buffer]::BlockCopy($fb, 0, $buf, $hb.Length+$cb.Length, $fb.Length)
    try {
        $r    = Invoke-WebRequest -Uri "$Base$path" -Method POST -Body $buf `
                -ContentType "multipart/form-data; boundary=$bnd" -UseBasicParsing -ErrorAction Stop
        $code = [int]$r.StatusCode
        try { $b = $r.Content | ConvertFrom-Json } catch { $b = [pscustomobject]@{ message = $r.Content } }
    } catch {
        $er   = $_.Exception.Response
        $code = if ($er) { [int]$er.StatusCode } else { 0 }
        try {
            $s = $er.GetResponseStream(); $rd = New-Object System.IO.StreamReader($s)
            $b = $rd.ReadToEnd() | ConvertFrom-Json
        } catch { $b = [pscustomobject]@{ message = "HTTP $code" } }
    }
    return [pscustomobject]@{ Code = $code; Body = $b }
}

Write-Host "`n=== Foundation Review Layer - Integration Tests ===" -ForegroundColor Cyan
Write-Host "Target: $Base`n"

# LOGIN - use SessionVariable so cookies persist via WebSession
Write-Host '[ LOGIN ]' -ForegroundColor Yellow
$lr = Invoke-WebRequest -Uri "$Base/api/admin/auth" -Method POST `
      -ContentType 'application/json' `
      -Body ([pscustomobject]@{ username = $Username; password = $Password } | ConvertTo-Json) `
      -SessionVariable 'ws' -UseBasicParsing -ErrorAction SilentlyContinue
$script:ws = $ws
Check 'login 200' ($lr.StatusCode -eq 200) "HTTP $($lr.StatusCode)"
if ($lr.StatusCode -ne 200) { Write-Host 'Stopping - no session.' -ForegroundColor Red; exit 1 }

# T1 - single adult, expect 3 slots
Write-Host "`n[ T1 ] Single-adult submission - 3 slots" -ForegroundColor Yellow
$t1 = CallApi POST '/api/forms/test-foundation-review/submissions' @{
    tenant_name      = 'Maria Garcia'
    building_address = '15 Whitney Ave'
    unit_number      = '1E'
    language         = 'en'
    form_data        = @{ asset_id = 'S0006'; household_members = @(@{ name='Maria Garcia'; age=35; employed=$true }) }
}
Check '201'              ($t1.Code -eq 201)                                "HTTP $($t1.Code) - $($t1.Body.message)"
Check 'submission_id'    ($null -ne $t1.Body.data.submission_id)
Check 'access_token'     ($null -ne $t1.Body.data.tenant_access_token)
Check '3 slots seeded'   ($t1.Body.data.document_slots_created -eq 3)     "got $($t1.Body.data.document_slots_created)"
$subId = $t1.Body.data.submission_id
$tok   = $t1.Body.data.tenant_access_token

# T2 - 3-person household (2 employed adults + 1 minor), expect 5 slots
Write-Host "`n[ T2 ] Multi-adult household - 5 slots" -ForegroundColor Yellow
$t2 = CallApi POST '/api/forms/test-foundation-review/submissions' @{
    tenant_name      = 'Juan Rodriguez'
    building_address = '15 Whitney Ave'
    unit_number      = '2A'
    language         = 'en'
    form_data        = @{ asset_id = 'S0006'; household_members = @(
        @{ name='Juan Rodriguez';  age=42; employed=$true  },
        @{ name='Ana Rodriguez';   age=38; employed=$true  },
        @{ name='Carlos Rodriguez'; age=16; employed=$false }
    )}
}
Check '201'    ($t2.Code -eq 201)                              "HTTP $($t2.Code)"
Check '5 slots' ($t2.Body.data.document_slots_created -eq 5)  "got $($t2.Body.data.document_slots_created)"

# T3 - tenant status: all missing at start
Write-Host "`n[ T3 ] Tenant status - all missing" -ForegroundColor Yellow
$t3 = CallApi GET "/api/t/$tok/status"
Check '200'           ($t3.Code -eq 200)
Check 'has documents' ($null -ne $t3.Body.data.documents)
Check 'all missing'   (($t3.Body.data.documents | Where-Object { $_.status -ne 'missing' }).Count -eq 0)
$proofDoc    = $t3.Body.data.documents | Where-Object { $_.doc_type -eq 'proof-of-id'  -and $_.person_slot -eq 0 } | Select-Object -First 1
$paystubsDoc = $t3.Body.data.documents | Where-Object { $_.doc_type -eq 'paystubs'     -and $_.person_slot -eq 1 } | Select-Object -First 1
Check 'proof-of-id at slot 0' ($null -ne $proofDoc)

# T3b - tenant uploads file
Write-Host "`n[ T3b ] Tenant upload - missing to submitted" -ForegroundColor Yellow
$u1 = UploadFile "/api/t/$tok/documents/$($proofDoc.id)" 'proof-of-id.pdf' '%PDF-1.4 fake proof of identity'
Check '201'        ($u1.Code -eq 201)       "HTTP $($u1.Code) - $($u1.Body.message)"
Check 'revision 1' ($u1.Body.data.revision -eq 1) "got $($u1.Body.data.revision)"
Check 'file_name'  ($null -ne $u1.Body.data.file_name)

# T4 - staff approves
Write-Host "`n[ T4 ] Staff approve" -ForegroundColor Yellow
$t4 = CallApi POST "/api/admin/submissions/$subId/documents/$($proofDoc.id)/review" @{ action='approve' } $true
Check '200'      ($t4.Code -eq 200)                       "HTTP $($t4.Code) - $($t4.Body.message)"
Check 'approved' ($t4.Body.data.status -eq 'approved')

# T5 - staff rejects (upload paystubs first)
Write-Host "`n[ T5 ] Staff reject with reason" -ForegroundColor Yellow
if ($paystubsDoc) {
    UploadFile "/api/t/$tok/documents/$($paystubsDoc.id)" 'paystubs.pdf' '%PDF-1.4 paystubs fake' | Out-Null
    $t5 = CallApi POST "/api/admin/submissions/$subId/documents/$($paystubsDoc.id)/review" @{
        action = 'reject'; rejection_reason = 'Document is more than 60 days old'
    } $true
    Check '200'      ($t5.Code -eq 200)                      "HTTP $($t5.Code) - $($t5.Body.message)"
    Check 'rejected' ($t5.Body.data.status -eq 'rejected')
} else { Write-Host '  (skip - no paystubs slot)' -ForegroundColor DarkYellow }

# T6 - tenant resubmits after rejection
Write-Host "`n[ T6 ] Resubmit cycle - rejected then submitted" -ForegroundColor Yellow
if ($paystubsDoc) {
    $u2 = UploadFile "/api/t/$tok/documents/$($paystubsDoc.id)" 'paystubs-v2.pdf' '%PDF-1.4 paystubs updated newer'
    Check '201'        ($u2.Code -eq 201)                  "HTTP $($u2.Code)"
    Check 'revision 2' ($u2.Body.data.revision -eq 2)     "got $($u2.Body.data.revision)"
    $t6s = CallApi GET "/api/t/$tok/status"
    $rd = $t6s.Body.data.documents | Where-Object { $_.id -eq $paystubsDoc.id } | Select-Object -First 1
    Check 'status back to submitted' ($rd.status -eq 'submitted') "got $($rd.status)"
} else { Write-Host '  (skip)' -ForegroundColor DarkYellow }

# T7 - staff waives a missing doc
Write-Host "`n[ T7 ] Staff waive" -ForegroundColor Yellow
$alldocs = (CallApi GET "/api/admin/submissions/$subId/documents" $null $true).Body.data.documents
$misDoc  = $alldocs | Where-Object { $_.status -eq 'missing' } | Select-Object -First 1
if ($misDoc) {
    $t7 = CallApi POST "/api/admin/submissions/$subId/documents/$($misDoc.id)/review" @{
        action = 'waive'; notes = 'Not applicable'
    } $true
    Check '200'    ($t7.Code -eq 200)                   "HTTP $($t7.Code) - $($t7.Body.message)"
    Check 'waived' ($t7.Body.data.status -eq 'waived')
} else { Write-Host '  (no missing docs left)' -ForegroundColor DarkYellow }

# T8 - parent status derived
Write-Host "`n[ T8 ] Parent status derived" -ForegroundColor Yellow
$par = CallApi GET "/api/admin/form-submissions/$subId" $null $true
Check '200'             ($par.Code -eq 200)
Check 'not pending_review' ($par.Body.data.status -ne 'pending_review') "got $($par.Body.data.status)"
Write-Host "  status  = $($par.Body.data.status)" -ForegroundColor Cyan
Write-Host "  summary = $($par.Body.data.document_review_summary | ConvertTo-Json -Compress)" -ForegroundColor Cyan

# T9 - RLS: token from submission B cannot touch documents from submission A
Write-Host "`n[ T9 ] RLS boundary" -ForegroundColor Yellow
$t9c = CallApi POST '/api/forms/test-foundation-review/submissions' @{
    tenant_name='Other'; building_address='15 Whitney Ave'; unit_number='9X'
    language='en'; form_data=@{ asset_id='S0006'; household_members=@() }
}
$otherTok = $t9c.Body.data.tenant_access_token
if ($otherTok -and $proofDoc) {
    $t9u = UploadFile "/api/t/$otherTok/documents/$($proofDoc.id)" 'bad.pdf' '%PDF fake'
    Check 'wrong-token 404' ($t9u.Code -eq 404) "HTTP $($t9u.Code)"
} else { Write-Host '  (skip)' -ForegroundColor DarkYellow }

# T10 - PATCH guard blocks direct status write on per_document submission
Write-Host "`n[ T10 ] PATCH guard" -ForegroundColor Yellow
$t10 = CallApi PATCH "/api/admin/form-submissions/$subId" @{ status='approved' } $true
Check '400'                   ($t10.Code -eq 400)                              "HTTP $($t10.Code)"
Check 'mentions per_document' ($t10.Body.message -like '*per_document*')       "$($t10.Body.message)"

Write-Host "`n=== Results: $pass passed, $fail failed ===" -ForegroundColor $(if ($fail -eq 0) { 'Green' } else { 'Yellow' })
if ($fail -gt 0) { exit 1 }
