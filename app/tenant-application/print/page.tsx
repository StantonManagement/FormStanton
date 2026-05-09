'use client';

function PrintStyles() {
  return (
    <style>{`
      @media print {
        .no-print { display: none !important; }
        .page-break { page-break-after: always; }
        body { margin: 0; }
      }
      * { box-sizing: border-box; }
      body { font-family: 'Times New Roman', Times, serif; background: #fff; color: #000; margin: 0; padding: 0; font-size: 10pt; line-height: 1.35; }
      .form-page { max-width: 8.5in; margin: 0 auto; padding: 0.55in 0.7in 0.55in 0.7in; }
      .header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 2.5px solid #000; padding-bottom: 7pt; margin-bottom: 12pt; }
      .header-left { font-size: 8.5pt; line-height: 1.5; }
      .header-right { text-align: right; }
      .header-title { font-size: 14pt; font-weight: bold; letter-spacing: 0.04em; }
      .header-sub { font-size: 8.5pt; color: #555; }
      .section-title { font-size: 10pt; font-weight: bold; background: #000; color: #fff; padding: 2pt 6pt; margin: 12pt 0 7pt 0; text-transform: uppercase; letter-spacing: 0.06em; }
      .row { display: flex; gap: 14pt; margin-bottom: 9pt; }
      .field { flex: 1; }
      .field.w-half { flex: 0 0 48%; }
      .field.w-third { flex: 0 0 31%; }
      .field-label { font-size: 8pt; margin-bottom: 1.5pt; color: #333; }
      .field-line { border-bottom: 1px solid #000; min-height: 15pt; }
      .field-line-tall { border-bottom: 1px solid #000; min-height: 20pt; }
      .field-line-xl { border-bottom: 1px solid #000; min-height: 26pt; }
      .cb-row { display: flex; flex-wrap: wrap; gap: 3pt 14pt; margin: 3pt 0 6pt 0; align-items: center; }
      .cb { display: inline-flex; align-items: center; gap: 3pt; font-size: 9.5pt; white-space: nowrap; }
      .cb-box { width: 9pt; height: 9pt; border: 1pt solid #000; display: inline-block; flex-shrink: 0; }
      .indent { margin-left: 14pt; }
      .income-block { border: 1px solid #000; padding: 7pt 10pt; margin-bottom: 9pt; }
      .income-block-title { font-size: 9pt; font-weight: bold; margin-bottom: 6pt; border-bottom: 1px solid #ccc; padding-bottom: 3pt; }
      .table { width: 100%; border-collapse: collapse; margin-bottom: 8pt; }
      .table th { font-size: 8.5pt; font-weight: bold; border-bottom: 1.5px solid #000; padding: 2pt 4pt; text-align: left; }
      .table td { border-bottom: 1px solid #ccc; padding: 3pt 4pt; min-height: 18pt; font-size: 9pt; }
      .office-use { border-top: 2px solid #000; margin-top: 14pt; padding-top: 6pt; font-size: 8.5pt; }
      .office-field { display: inline-block; border-bottom: 1px solid #000; min-width: 80pt; margin: 0 3pt; }
      .office-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6pt; margin-top: 5pt; }
      .page-break { page-break-after: always; }
      .lang-tag { font-size: 7.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.12em; color: #888; margin-bottom: 3pt; }
      .note { font-size: 8.5pt; font-style: italic; color: #444; margin: 0 0 4pt 0; }
      .sig-box { border: 1px solid #000; height: 52pt; width: 100%; margin-top: 3pt; }
      p { margin: 0 0 5pt 0; }
    `}</style>
  );
}

function IncomeBlock({ n, lang }: { n: number; lang: 'en' | 'es' | 'pt' }) {
  const labels = {
    en: { title: `Income Source ${n}`, employer: 'Employer / Source Name', phone: 'Phone', position: 'Position / Job Title', duration: 'How Long?', proof: 'Proof of income attached:' },
    es: { title: `Fuente de Ingresos ${n}`, employer: 'Empleador / Fuente', phone: 'Telefono', position: 'Cargo / Titulo', duration: 'Cuanto tiempo?', proof: 'Comprobante adjunto:' },
    pt: { title: `Fonte de Renda ${n}`, employer: 'Empregador / Fonte', phone: 'Telefone', position: 'Cargo / Titulo', duration: 'Ha quanto tempo?', proof: 'Comprovante anexado:' },
  }[lang];

  return (
    <div className="income-block">
      <div className="income-block-title">{labels.title}</div>
      <div className="row">
        <div className="field">
          <div className="field-label">{labels.employer}</div>
          <div className="field-line-tall" />
        </div>
        <div className="field w-half">
          <div className="field-label">{labels.phone}</div>
          <div className="field-line-tall" />
        </div>
      </div>
      <div className="row">
        <div className="field">
          <div className="field-label">{labels.position}</div>
          <div className="field-line" />
        </div>
        <div className="field w-half">
          <div className="field-label">{labels.duration}</div>
          <div className="field-line" />
        </div>
      </div>
      <p style={{ marginTop: '5pt', fontSize: '8.5pt' }}>
        {labels.proof}&nbsp;
        <span className="cb"><span className="cb-box" /> {lang === 'en' ? 'Yes' : lang === 'es' ? 'Si' : 'Sim'}</span>&nbsp;&nbsp;
        <span className="cb"><span className="cb-box" /> {lang === 'en' ? 'No' : 'No'}</span>
      </p>
    </div>
  );
}

function ApplicationForm({ lang }: { lang: 'en' | 'es' | 'pt' }) {
  const L = {
    en: {
      langTag: 'English',
      title: 'FULL TENANT APPLICATION',
      sA: 'Section A: Personal Information',
      fullName: 'Full Name *', dob: 'Date of Birth', phone: 'Phone *', email: 'Email', address: 'Current Address', timeAt: 'How long at current address?',
      sB: 'Section B: Employment & Income',
      totalIncome: 'Approximate total monthly household income',
      incomeOptions: ['Under $1,500', '$1,500 – $2,500', '$2,500 – $3,500', '$3,500 – $5,000', '$5,000 – $7,500', '$7,500+'],
      sC: 'Section C: Household',
      numOccupants: 'Number of people in unit (including yourself) *',
      occupantCols: ['Full Name *', 'Date of Birth', 'Relationship'],
      sD: 'Section D: Pets',
      hasPets: 'Do you have any pets?',
      petCols: ['Type', 'Approximate Weight'],
      petTypes: 'Dog / Cat / Other',
      sE: 'Section E: Rental History',
      landlord: 'Landlord Name', landlordPhone: 'Landlord Phone', reason: 'Reason for Moving',
      sF: 'Section F: What Are You Applying For?',
      bedrooms: 'Bedrooms Needed *',
      bedroomOpts: ['Studio', '1 BR', '2 BR', '3 BR', '4 BR'],
      areas: 'Areas of Interest',
      areaOpts: ['North End', 'South End', 'West End', 'Park Street Corridor', 'No Preference'],
      moveIn: 'Desired Move-In Date',
      sG: 'Section G: Payment Type *',
      market: 'Market Rate',
      s8: 'Section 8 / Housing Voucher',
      sH: 'Section H: Market Rate',
      authMarket: 'I authorize Stanton Management to verify the information provided in this application, including contacting my employer and landlord references.',
      sI: 'Section I: Section 8 / Voucher Track',
      ha: 'Housing Authority', vBed: 'Voucher Bedroom Size', vStd: 'Payment Standard (if known)', vExp: 'Expiration Date (if known)',
      cw: 'Caseworker Name', cwPhone: 'Caseworker Phone', cwEmail: 'Caseworker Email',
      docsAttached: 'Documents attached:',
      docVoucher: 'Voucher or approval letter', docMoving: 'Moving packet / moving papers', docBank: 'Bank statement(s)',
      authS8: 'I authorize Stanton Management to verify the information provided, including contacting my employer, landlord references, and housing authority caseworker.',
      sJ: 'Section J: Additional Information (Optional — helps speed up processing)',
      ssn: 'Social Security Number or Tax ID', idDoc: 'Photo ID attached', ssnDoc: 'SSN card / Tax ID attached',
      sig: 'Signature',
      sigStmt: 'By signing, I confirm all information is accurate to the best of my knowledge.',
      sigLine: 'Signature', dateLine: 'Date',
      office: 'For office use:',
      officeFields: ['Received', 'Contacted', 'By', 'Showing date', 'Unit(s)', 'Background check', 'Credit check', 'Outcome'],
    },
    es: {
      langTag: 'Español',
      title: 'SOLICITUD COMPLETA DE INQUILINO',
      sA: 'Seccion A: Informacion Personal',
      fullName: 'Nombre Completo *', dob: 'Fecha de Nacimiento', phone: 'Telefono *', email: 'Correo', address: 'Direccion Actual', timeAt: 'Cuanto tiempo en su direccion actual?',
      sB: 'Seccion B: Empleo e Ingresos',
      totalIncome: 'Ingresos mensuales totales aproximados del hogar',
      incomeOptions: ['Menos de $1,500', '$1,500 – $2,500', '$2,500 – $3,500', '$3,500 – $5,000', '$5,000 – $7,500', '$7,500+'],
      sC: 'Seccion C: Hogar',
      numOccupants: 'Numero de personas en la unidad (incluido usted) *',
      occupantCols: ['Nombre Completo *', 'Fecha de Nacimiento', 'Parentesco'],
      sD: 'Seccion D: Mascotas',
      hasPets: 'Tiene mascotas?',
      petCols: ['Tipo', 'Peso Aproximado'],
      petTypes: 'Perro / Gato / Otro',
      sE: 'Seccion E: Historial de Alquiler',
      landlord: 'Nombre del Propietario', landlordPhone: 'Telefono del Propietario', reason: 'Razon para Mudarse',
      sF: 'Seccion F: Para Que Esta Solicitando?',
      bedrooms: 'Habitaciones Necesarias *',
      bedroomOpts: ['Estudio', '1 Hab.', '2 Hab.', '3 Hab.', '4 Hab.'],
      areas: 'Areas de Interes',
      areaOpts: ['North End', 'South End', 'West End', 'Corredor Park St', 'Sin Preferencia'],
      moveIn: 'Fecha Deseada de Mudanza',
      sG: 'Seccion G: Tipo de Pago *',
      market: 'Tarifa de Mercado',
      s8: 'Seccion 8 / Vale de Vivienda',
      sH: 'Seccion H: Tarifa de Mercado',
      authMarket: 'Autorizo a Stanton Management a verificar la informacion proporcionada, incluyendo contactar a mi empleador y referencias de propietarios.',
      sI: 'Seccion I: Pista de Seccion 8 / Vale',
      ha: 'Autoridad de Vivienda', vBed: 'Habitaciones del Vale', vStd: 'Estandar de Pago (si se conoce)', vExp: 'Fecha de Vencimiento (si se conoce)',
      cw: 'Trabajador Social', cwPhone: 'Tel. Trabajador Social', cwEmail: 'Email Trabajador Social',
      docsAttached: 'Documentos adjuntos:',
      docVoucher: 'Vale o carta de aprobacion', docMoving: 'Paquete de mudanza', docBank: 'Estado(s) de cuenta',
      authS8: 'Autorizo a Stanton Management a verificar la informacion, incluyendo contactar a mi empleador, referencias de propietarios y trabajador social.',
      sJ: 'Seccion J: Informacion Adicional (Opcional)',
      ssn: 'Numero de Seguro Social o ID Fiscal', idDoc: 'ID con foto adjunta', ssnDoc: 'Tarjeta SSN / ID Fiscal adjunta',
      sig: 'Firma',
      sigStmt: 'Al firmar, confirmo que toda la informacion es precisa a mi leal saber y entender.',
      sigLine: 'Firma', dateLine: 'Fecha',
      office: 'Para uso de la oficina:',
      officeFields: ['Recibido', 'Contactado', 'Por', 'Fecha visita', 'Unidad(es)', 'Verificacion antecedentes', 'Verificacion credito', 'Resultado'],
    },
    pt: {
      langTag: 'Português',
      title: 'SOLICITACAO COMPLETA DE INQUILINO',
      sA: 'Secao A: Informacoes Pessoais',
      fullName: 'Nome Completo *', dob: 'Data de Nascimento', phone: 'Telefone *', email: 'Email', address: 'Endereco Atual', timeAt: 'Ha quanto tempo no endereco atual?',
      sB: 'Secao B: Emprego e Renda',
      totalIncome: 'Renda mensal familiar total aproximada',
      incomeOptions: ['Menos de $1.500', '$1.500 – $2.500', '$2.500 – $3.500', '$3.500 – $5.000', '$5.000 – $7.500', '$7.500+'],
      sC: 'Secao C: Residentes',
      numOccupants: 'Numero de pessoas na unidade (incluindo voce) *',
      occupantCols: ['Nome Completo *', 'Data de Nascimento', 'Parentesco'],
      sD: 'Secao D: Animais de Estimacao',
      hasPets: 'Voce tem animais de estimacao?',
      petCols: ['Tipo', 'Peso Aproximado'],
      petTypes: 'Cachorro / Gato / Outro',
      sE: 'Secao E: Historico de Aluguel',
      landlord: 'Nome do Proprietario', landlordPhone: 'Telefone do Proprietario', reason: 'Motivo da Mudanca',
      sF: 'Secao F: Para O Que Esta Solicitando?',
      bedrooms: 'Quartos Necessarios *',
      bedroomOpts: ['Estudio', '1 Qto', '2 Qtos', '3 Qtos', '4 Qtos'],
      areas: 'Areas de Interesse',
      areaOpts: ['North End', 'South End', 'West End', 'Corredor Park St', 'Sem Preferencia'],
      moveIn: 'Data Desejada de Mudanca',
      sG: 'Secao G: Tipo de Pagamento *',
      market: 'Tarifa de Mercado',
      s8: 'Secao 8 / Voucher de Moradia',
      sH: 'Secao H: Tarifa de Mercado',
      authMarket: 'Autorizo a Stanton Management a verificar as informacoes fornecidas, incluindo contatar meu empregador e referencias de proprietarios.',
      sI: 'Secao I: Trilha Secao 8 / Voucher',
      ha: 'Autoridade Habitacional', vBed: 'Quartos do Voucher', vStd: 'Padrao de Pagamento (se conhecido)', vExp: 'Vencimento (se conhecido)',
      cw: 'Assistente Social', cwPhone: 'Tel. Assistente Social', cwEmail: 'Email Assistente Social',
      docsAttached: 'Documentos anexados:',
      docVoucher: 'Voucher ou carta de aprovacao', docMoving: 'Pacote de mudanca', docBank: 'Extrato(s) bancario(s)',
      authS8: 'Autorizo a Stanton Management a verificar as informacoes, incluindo contatar meu empregador, referencias de proprietarios e assistente social.',
      sJ: 'Secao J: Informacoes Adicionais (Opcional)',
      ssn: 'Seguro Social ou ID Fiscal', idDoc: 'ID com foto anexado', ssnDoc: 'Cartao SSN / ID Fiscal anexado',
      sig: 'Assinatura',
      sigStmt: 'Ao assinar, confirmo que todas as informacoes sao precisas ao meu melhor conhecimento.',
      sigLine: 'Assinatura', dateLine: 'Data',
      office: 'Para uso do escritorio:',
      officeFields: ['Recebido', 'Contatado', 'Por', 'Data visita', 'Unidade(s)', 'Verificacao antecedentes', 'Verificacao credito', 'Resultado'],
    },
  }[lang];

  const yes = lang === 'es' ? 'Si' : lang === 'pt' ? 'Sim' : 'Yes';
  const no = 'No';

  return (
    <>
      {/* PAGE 1: Sections A–E */}
      <div className="form-page">
        <div className="lang-tag">{L.langTag}</div>
        <div className="header">
          <div className="header-left">
            <strong>Stanton Management LLC</strong><br />
            421 Park Street, Hartford, CT 06106<br />
            (860) 993-3401
          </div>
          <div className="header-right">
            <div className="header-title">{L.title}</div>
            <div className="header-sub">stantonmanagement.com/tenant-application</div>
          </div>
        </div>

        {/* Section A */}
        <div className="section-title">{L.sA}</div>
        <div className="row">
          <div className="field"><div className="field-label">{L.fullName}</div><div className="field-line-tall" /></div>
          <div className="field w-half"><div className="field-label">{L.dob}</div><div className="field-line-tall" /></div>
        </div>
        <div className="row">
          <div className="field w-half"><div className="field-label">{L.phone}</div><div className="field-line-tall" /></div>
          <div className="field"><div className="field-label">{L.email}</div><div className="field-line-tall" /></div>
        </div>
        <div className="row">
          <div className="field"><div className="field-label">{L.address}</div><div className="field-line-tall" /></div>
          <div className="field w-half"><div className="field-label">{L.timeAt}</div><div className="field-line-tall" /></div>
        </div>

        {/* Section B */}
        <div className="section-title">{L.sB}</div>
        <IncomeBlock n={1} lang={lang} />
        <IncomeBlock n={2} lang={lang} />

        <p style={{ fontSize: '8.5pt', marginBottom: '5pt' }}><strong>{L.totalIncome}</strong></p>
        <div className="cb-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4pt' }}>
          {L.incomeOptions.map(opt => (
            <span key={opt} className="cb"><span className="cb-box" /> {opt}</span>
          ))}
        </div>

        {/* Section C */}
        <div className="section-title">{L.sC}</div>
        <div className="row">
          <div className="field" style={{ flex: '0 0 200pt' }}>
            <div className="field-label">{L.numOccupants}</div>
            <div className="field-line" />
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>{L.occupantCols.map(c => <th key={c}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {[0, 1, 2].map(i => <tr key={i}>{L.occupantCols.map(c => <td key={c}>&nbsp;</td>)}</tr>)}
          </tbody>
        </table>

        {/* Section D */}
        <div className="section-title">{L.sD}</div>
        <p><strong>{L.hasPets}</strong>&nbsp;&nbsp;
          <span className="cb"><span className="cb-box" /> {yes}</span>&nbsp;&nbsp;
          <span className="cb"><span className="cb-box" /> {no}</span>
        </p>
        <p className="note" style={{ marginTop: '3pt' }}>{lang === 'en' ? 'If Yes:' : lang === 'es' ? 'Si respondio Si:' : 'Se sim:'}</p>
        <table className="table">
          <thead>
            <tr>
              <th>{L.petCols[0]} ({L.petTypes})</th>
              <th>{L.petCols[1]}</th>
            </tr>
          </thead>
          <tbody>
            {[0, 1].map(i => <tr key={i}><td>&nbsp;</td><td>&nbsp;</td></tr>)}
          </tbody>
        </table>

        {/* Section E */}
        <div className="section-title">{L.sE}</div>
        <div className="row">
          <div className="field"><div className="field-label">{L.landlord}</div><div className="field-line-tall" /></div>
          <div className="field w-half"><div className="field-label">{L.landlordPhone}</div><div className="field-line-tall" /></div>
        </div>
        <div className="field">
          <div className="field-label">{L.reason}</div>
          <div className="field-line-xl" />
        </div>
      </div>

      {/* PAGE 2: Sections F–J + Signature + Office Use */}
      <div className={`form-page ${lang !== 'pt' ? 'page-break' : ''}`}>
        <div className="lang-tag">{L.langTag} — {lang === 'en' ? 'Page 2 of 2' : lang === 'es' ? 'Pagina 2 de 2' : 'Pagina 2 de 2'}</div>
        <div className="header" style={{ borderBottom: '1.5px solid #000', paddingBottom: '5pt', marginBottom: '10pt' }}>
          <div className="header-left"><strong>Stanton Management LLC</strong> — {L.title}</div>
          <div className="header-sub">(860) 993-3401</div>
        </div>

        {/* Section F */}
        <div className="section-title">{L.sF}</div>
        <p><strong>{L.bedrooms}</strong></p>
        <div className="cb-row">
          {L.bedroomOpts.map(b => <span key={b} className="cb"><span className="cb-box" /> {b}</span>)}
        </div>
        <p style={{ marginTop: '6pt' }}><strong>{L.areas}</strong></p>
        <div className="cb-row">
          {L.areaOpts.map(a => <span key={a} className="cb"><span className="cb-box" /> {a}</span>)}
        </div>
        <div className="row" style={{ marginTop: '6pt' }}>
          <div className="field w-half"><div className="field-label">{L.moveIn}</div><div className="field-line" /></div>
        </div>

        {/* Section G */}
        <div className="section-title">{L.sG}</div>
        <div className="cb-row">
          <span className="cb"><span className="cb-box" /> {L.market} → {lang === 'en' ? 'complete Section H' : lang === 'es' ? 'complete Seccion H' : 'complete Secao H'}</span>
        </div>
        <div className="cb-row">
          <span className="cb"><span className="cb-box" /> {L.s8} → {lang === 'en' ? 'complete Section I' : lang === 'es' ? 'complete Seccion I' : 'complete Secao I'}</span>
        </div>

        {/* Section H */}
        <div className="section-title">{L.sH}</div>
        <div className="cb-row"><span className="cb"><span className="cb-box" /> {L.authMarket}</span></div>

        {/* Section I */}
        <div className="section-title">{L.sI}</div>
        <div className="row">
          <div className="field"><div className="field-label">{L.ha}</div><div className="field-line-tall" /></div>
          <div className="field w-third"><div className="field-label">{L.vBed}</div><div className="field-line-tall" /></div>
        </div>
        <div className="row">
          <div className="field"><div className="field-label">{L.vStd}</div><div className="field-line" /></div>
          <div className="field"><div className="field-label">{L.vExp}</div><div className="field-line" /></div>
        </div>
        <div className="row">
          <div className="field"><div className="field-label">{L.cw}</div><div className="field-line-tall" /></div>
          <div className="field"><div className="field-label">{L.cwPhone}</div><div className="field-line-tall" /></div>
          <div className="field"><div className="field-label">{L.cwEmail}</div><div className="field-line-tall" /></div>
        </div>
        <p style={{ fontSize: '8.5pt', marginBottom: '3pt' }}><strong>{L.docsAttached}</strong></p>
        <div className="cb-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '3pt' }}>
          <span className="cb"><span className="cb-box" /> {L.docVoucher}</span>
          <span className="cb"><span className="cb-box" /> {L.docMoving}</span>
          <span className="cb"><span className="cb-box" /> {L.docBank}</span>
        </div>
        <div className="cb-row" style={{ marginTop: '4pt' }}><span className="cb"><span className="cb-box" /> {L.authS8}</span></div>

        {/* Section J */}
        <div className="section-title">{L.sJ}</div>
        <div className="row">
          <div className="field"><div className="field-label">{L.ssn}</div><div className="field-line" /></div>
        </div>
        <div className="row">
          <div className="field w-half"><p style={{ fontSize: '8.5pt' }}>{L.idDoc}: <span className="cb"><span className="cb-box" /> {yes}</span> <span className="cb"><span className="cb-box" /> {no}</span></p></div>
          <div className="field w-half"><p style={{ fontSize: '8.5pt' }}>{L.ssnDoc}: <span className="cb"><span className="cb-box" /> {yes}</span> <span className="cb"><span className="cb-box" /> {no}</span></p></div>
        </div>

        {/* Signature */}
        <div className="section-title">{L.sig}</div>
        <p className="note">{L.sigStmt}</p>
        <div className="row">
          <div className="field">
            <div className="field-label">{L.sigLine}</div>
            <div className="sig-box" />
          </div>
          <div className="field w-third">
            <div className="field-label">{L.dateLine}</div>
            <div className="field-line-xl" />
          </div>
        </div>

        {/* Office Use */}
        <div className="office-use">
          <strong>{L.office}</strong>
          <div className="office-grid">
            {L.officeFields.map(f => (
              <div key={f} style={{ fontSize: '8.5pt' }}>
                {f}: <span className="office-field" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default function TenantApplicationPrintPage() {
  return (
    <>
      <PrintStyles />
      {/* No-print header */}
      <div className="no-print" style={{ fontFamily: 'sans-serif', padding: '20px 24px', background: '#1a1a2e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <strong>Stanton Management — Full Tenant Application</strong>
          <span style={{ marginLeft: '12px', fontSize: '13px', opacity: 0.7 }}>Printable blank form · 3 languages</span>
        </div>
        <button onClick={() => window.print()} style={{ background: '#fff', color: '#1a1a2e', border: 'none', padding: '8px 20px', fontWeight: 600, cursor: 'pointer', fontSize: '14px' }}>
          Print / Save PDF
        </button>
      </div>

      <ApplicationForm lang="en" />
      <div style={{ pageBreakAfter: 'always', height: 0 }} />
      <ApplicationForm lang="es" />
      <div style={{ pageBreakAfter: 'always', height: 0 }} />
      <ApplicationForm lang="pt" />
    </>
  );
}
