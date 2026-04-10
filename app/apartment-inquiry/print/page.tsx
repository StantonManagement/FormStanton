export const metadata = {
  title: 'Apartment Application — Printable | Stanton Management',
};

export default function ApartmentInquiryPrintPage() {
  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .page-break { page-break-after: always; }
          body { margin: 0; }
        }
        body { font-family: 'Times New Roman', Times, serif; background: #fff; color: #000; margin: 0; padding: 0; }
        .form-page { max-width: 8.5in; margin: 0 auto; padding: 0.65in 0.75in 0.65in 0.75in; font-size: 10.5pt; line-height: 1.4; }
        .header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 8pt; margin-bottom: 14pt; }
        .header-left { font-size: 9pt; line-height: 1.5; }
        .header-title { font-size: 15pt; font-weight: bold; letter-spacing: 0.04em; text-align: right; }
        .header-sub { font-size: 9pt; text-align: right; color: #444; }
        .section-title { font-size: 11pt; font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 2pt; margin: 14pt 0 8pt 0; text-transform: uppercase; letter-spacing: 0.05em; }
        .field-row { display: flex; gap: 16pt; margin-bottom: 10pt; }
        .field { flex: 1; }
        .field-label { font-size: 9pt; margin-bottom: 2pt; }
        .field-line { border-bottom: 1px solid #000; min-height: 16pt; width: 100%; }
        .field-line-tall { border-bottom: 1px solid #000; min-height: 22pt; width: 100%; }
        .checkbox-row { display: flex; flex-wrap: wrap; gap: 4pt 18pt; margin: 4pt 0; align-items: center; }
        .cb { display: inline-flex; align-items: center; gap: 4pt; font-size: 10pt; }
        .cb-box { width: 10pt; height: 10pt; border: 1pt solid #000; display: inline-block; flex-shrink: 0; }
        .indent { margin-left: 18pt; }
        .office-use { border-top: 1.5px solid #000; margin-top: 16pt; padding-top: 8pt; font-size: 9pt; }
        .office-field { display: inline-block; border-bottom: 1px solid #000; min-width: 90pt; margin: 0 4pt; }
        .page-break { page-break-after: always; }
        .lang-tag { font-size: 8pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; color: #666; margin-bottom: 4pt; }
        p { margin: 0 0 6pt 0; }
        .note { font-size: 9pt; font-style: italic; color: #444; }
      `}</style>

      {/* ===== ENGLISH ===== */}
      <div className="form-page page-break">
        <div className="lang-tag">English</div>
        <div className="header">
          <div className="header-left">
            <strong>Stanton Management LLC</strong><br />
            421 Park Street, Hartford, CT 06106<br />
            (860) 993-3401
          </div>
          <div>
            <div className="header-title">APARTMENT APPLICATION</div>
            <div className="header-sub">stantonmanagement.com/apartment-inquiry</div>
          </div>
        </div>

        {/* About You */}
        <div className="section-title">About You</div>
        <div className="field-row">
          <div className="field">
            <div className="field-label">Full Name *</div>
            <div className="field-line-tall" />
          </div>
          <div className="field">
            <div className="field-label">Date of Birth</div>
            <div className="field-line-tall" />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <div className="field-label">Phone Number *</div>
            <div className="field-line-tall" />
          </div>
          <div className="field">
            <div className="field-label">Email Address</div>
            <div className="field-line-tall" />
          </div>
        </div>

        {/* What Are You Looking For */}
        <div className="section-title">What Are You Looking For?</div>
        <p><strong>Bedrooms Needed *</strong></p>
        <div className="checkbox-row">
          {['Studio','1 Bedroom','2 Bedrooms','3 Bedrooms','4 Bedrooms'].map(b => (
            <span key={b} className="cb"><span className="cb-box" /> {b}</span>
          ))}
        </div>
        <p style={{marginTop:'8pt'}}><strong>Move-In Timeframe</strong></p>
        <div className="checkbox-row">
          {['ASAP','1–2 Months','3–6 Months','Just Looking'].map(t => (
            <span key={t} className="cb"><span className="cb-box" /> {t}</span>
          ))}
        </div>
        <p style={{marginTop:'8pt'}}><strong>Areas of Interest</strong></p>
        <div className="checkbox-row">
          {['North End','South End','West End','Park Street Corridor','No Preference'].map(a => (
            <span key={a} className="cb"><span className="cb-box" /> {a}</span>
          ))}
        </div>

        {/* Housing Voucher */}
        <div className="section-title">Housing Voucher</div>
        <p><strong>Do you have a Section 8 or other housing voucher? *</strong></p>
        <div className="checkbox-row">
          <span className="cb"><span className="cb-box" /> Yes</span>
          <span className="cb"><span className="cb-box" /> No</span>
          <span className="cb"><span className="cb-box" /> Not Sure</span>
        </div>
        <div className="indent" style={{marginTop:'6pt'}}>
          <p className="note">If Yes:</p>
          <div className="field-row">
            <div className="field">
              <div className="field-label">Voucher bedroom size</div>
              <div className="field-line" />
            </div>
            <div className="field">
              <div className="field-label">Housing authority</div>
              <div className="field-line" />
            </div>
          </div>
        </div>

        {/* Household Income */}
        <div className="section-title">Household Income</div>
        <p><strong>Approximate monthly household income</strong></p>
        <div className="checkbox-row" style={{flexDirection:'column', alignItems:'flex-start', gap:'5pt'}}>
          {['Under $1,500','$1,500 – $2,500','$2,500 – $3,500','$3,500 – $5,000','$5,000 – $7,500','$7,500+'].map(i => (
            <span key={i} className="cb"><span className="cb-box" /> {i}</span>
          ))}
        </div>
        <p style={{marginTop:'6pt'}}>Proof of income attached: <span className="cb"><span className="cb-box" /> Yes</span> <span className="cb" style={{marginLeft:'8pt'}}><span className="cb-box" /> No</span></p>
        <p className="note" style={{marginTop:'2pt'}}>Pay stubs, bank statements, Cash App/Zelle statements, or other documentation</p>

        {/* Household */}
        <div className="section-title">Who Will Be Living in the Unit?</div>
        <div className="field-row">
          <div className="field" style={{flex:'0 0 140pt'}}>
            <div className="field-label">Number of people (including yourself)</div>
            <div className="field-line" />
          </div>
        </div>
        <div className="field">
          <div className="field-label">Names of additional occupants</div>
          <div className="field-line-tall" />
          <div className="field-line-tall" style={{marginTop:'6pt'}} />
        </div>

        {/* Referral */}
        <div className="section-title">How Did You Hear About Us? *</div>
        <div className="checkbox-row">
          {['Vivian','Maribel','Online Listing','AppFolio','Walk-in','Other'].map(r => (
            <span key={r} className="cb"><span className="cb-box" /> {r}</span>
          ))}
        </div>
        <div className="field" style={{marginTop:'6pt'}}>
          <div className="field-label">If Other:</div>
          <div className="field-line" />
        </div>

        {/* Comments */}
        <div className="section-title">Comments</div>
        <div className="field-line-tall" />
        <div className="field-line-tall" style={{marginTop:'6pt'}} />

        <div className="office-use">
          <strong>For office use:</strong>&nbsp;&nbsp;
          Received: <span className="office-field" />&nbsp;
          Contacted: <span className="office-field" />&nbsp;
          By: <span className="office-field" />&nbsp;
          Outcome: <span className="office-field" style={{minWidth:'150pt'}} />
        </div>
      </div>

      {/* ===== ESPAÑOL ===== */}
      <div className="form-page page-break">
        <div className="lang-tag">Español</div>
        <div className="header">
          <div className="header-left">
            <strong>Stanton Management LLC</strong><br />
            421 Park Street, Hartford, CT 06106<br />
            (860) 993-3401
          </div>
          <div>
            <div className="header-title">SOLICITUD DE APARTAMENTO</div>
            <div className="header-sub">stantonmanagement.com/apartment-inquiry</div>
          </div>
        </div>

        <div className="section-title">Sobre Usted</div>
        <div className="field-row">
          <div className="field"><div className="field-label">Nombre Completo *</div><div className="field-line-tall" /></div>
          <div className="field"><div className="field-label">Fecha de Nacimiento</div><div className="field-line-tall" /></div>
        </div>
        <div className="field-row">
          <div className="field"><div className="field-label">Numero de Telefono *</div><div className="field-line-tall" /></div>
          <div className="field"><div className="field-label">Correo Electronico</div><div className="field-line-tall" /></div>
        </div>

        <div className="section-title">Que Esta Buscando?</div>
        <p><strong>Habitaciones Necesarias *</strong></p>
        <div className="checkbox-row">
          {['Estudio','1 Habitacion','2 Habitaciones','3 Habitaciones','4 Habitaciones'].map(b => (
            <span key={b} className="cb"><span className="cb-box" /> {b}</span>
          ))}
        </div>
        <p style={{marginTop:'8pt'}}><strong>Fecha de Mudanza</strong></p>
        <div className="checkbox-row">
          {['Lo Antes Posible','1-2 Meses','3-6 Meses','Solo Buscando'].map(t => (
            <span key={t} className="cb"><span className="cb-box" /> {t}</span>
          ))}
        </div>
        <p style={{marginTop:'8pt'}}><strong>Areas de Interes</strong></p>
        <div className="checkbox-row">
          {['North End','South End','West End','Corredor de Park Street','Sin Preferencia'].map(a => (
            <span key={a} className="cb"><span className="cb-box" /> {a}</span>
          ))}
        </div>

        <div className="section-title">Vale de Vivienda</div>
        <p><strong>Tiene un vale de la Seccion 8 u otro vale de vivienda? *</strong></p>
        <div className="checkbox-row">
          <span className="cb"><span className="cb-box" /> Si</span>
          <span className="cb"><span className="cb-box" /> No</span>
          <span className="cb"><span className="cb-box" /> No Estoy Seguro</span>
        </div>
        <div className="indent" style={{marginTop:'6pt'}}>
          <p className="note">Si respondio Si:</p>
          <div className="field-row">
            <div className="field"><div className="field-label">Tamano del vale (habitaciones)</div><div className="field-line" /></div>
            <div className="field"><div className="field-label">Autoridad de vivienda</div><div className="field-line" /></div>
          </div>
        </div>

        <div className="section-title">Ingresos del Hogar</div>
        <p><strong>Ingresos mensuales aproximados del hogar</strong></p>
        <div className="checkbox-row" style={{flexDirection:'column', alignItems:'flex-start', gap:'5pt'}}>
          {['Menos de $1,500','$1,500 – $2,500','$2,500 – $3,500','$3,500 – $5,000','$5,000 – $7,500','$7,500+'].map(i => (
            <span key={i} className="cb"><span className="cb-box" /> {i}</span>
          ))}
        </div>
        <p style={{marginTop:'6pt'}}>Comprobante de ingresos adjunto: <span className="cb"><span className="cb-box" /> Si</span> <span className="cb" style={{marginLeft:'8pt'}}><span className="cb-box" /> No</span></p>

        <div className="section-title">Quienes Viviran en la Unidad?</div>
        <div className="field-row">
          <div className="field" style={{flex:'0 0 160pt'}}><div className="field-label">Numero de personas (incluido usted)</div><div className="field-line" /></div>
        </div>
        <div className="field"><div className="field-label">Nombres de los demas ocupantes</div>
          <div className="field-line-tall" /><div className="field-line-tall" style={{marginTop:'6pt'}} />
        </div>

        <div className="section-title">Como Se Entero de Nosotros? *</div>
        <div className="checkbox-row">
          {['Vivian','Maribel','Listado en linea','AppFolio','Visita directa','Otro'].map(r => (
            <span key={r} className="cb"><span className="cb-box" /> {r}</span>
          ))}
        </div>
        <div className="field" style={{marginTop:'6pt'}}><div className="field-label">Si es Otro:</div><div className="field-line" /></div>

        <div className="section-title">Comentarios</div>
        <div className="field-line-tall" /><div className="field-line-tall" style={{marginTop:'6pt'}} />

        <div className="office-use">
          <strong>Para uso de la oficina:</strong>&nbsp;&nbsp;
          Recibido: <span className="office-field" />&nbsp;
          Contactado: <span className="office-field" />&nbsp;
          Por: <span className="office-field" />&nbsp;
          Resultado: <span className="office-field" style={{minWidth:'150pt'}} />
        </div>
      </div>

      {/* ===== PORTUGUÊS ===== */}
      <div className="form-page">
        <div className="lang-tag">Português</div>
        <div className="header">
          <div className="header-left">
            <strong>Stanton Management LLC</strong><br />
            421 Park Street, Hartford, CT 06106<br />
            (860) 993-3401
          </div>
          <div>
            <div className="header-title">SOLICITACAO DE APARTAMENTO</div>
            <div className="header-sub">stantonmanagement.com/apartment-inquiry</div>
          </div>
        </div>

        <div className="section-title">Sobre Voce</div>
        <div className="field-row">
          <div className="field"><div className="field-label">Nome Completo *</div><div className="field-line-tall" /></div>
          <div className="field"><div className="field-label">Data de Nascimento</div><div className="field-line-tall" /></div>
        </div>
        <div className="field-row">
          <div className="field"><div className="field-label">Numero de Telefone *</div><div className="field-line-tall" /></div>
          <div className="field"><div className="field-label">Endereco de Email</div><div className="field-line-tall" /></div>
        </div>

        <div className="section-title">O Que Voce Esta Procurando?</div>
        <p><strong>Quartos Necessarios *</strong></p>
        <div className="checkbox-row">
          {['Estudio','1 Quarto','2 Quartos','3 Quartos','4 Quartos'].map(b => (
            <span key={b} className="cb"><span className="cb-box" /> {b}</span>
          ))}
        </div>
        <p style={{marginTop:'8pt'}}><strong>Prazo de Mudanca</strong></p>
        <div className="checkbox-row">
          {['O Mais Rapido','1-2 Meses','3-6 Meses','Apenas Pesquisando'].map(t => (
            <span key={t} className="cb"><span className="cb-box" /> {t}</span>
          ))}
        </div>
        <p style={{marginTop:'8pt'}}><strong>Areas de Interesse</strong></p>
        <div className="checkbox-row">
          {['North End','South End','West End','Corredor Park Street','Sem Preferencia'].map(a => (
            <span key={a} className="cb"><span className="cb-box" /> {a}</span>
          ))}
        </div>

        <div className="section-title">Voucher de Moradia</div>
        <p><strong>Voce tem um voucher da Secao 8 ou outro voucher de moradia? *</strong></p>
        <div className="checkbox-row">
          <span className="cb"><span className="cb-box" /> Sim</span>
          <span className="cb"><span className="cb-box" /> Nao</span>
          <span className="cb"><span className="cb-box" /> Nao Tenho Certeza</span>
        </div>
        <div className="indent" style={{marginTop:'6pt'}}>
          <p className="note">Se respondeu Sim:</p>
          <div className="field-row">
            <div className="field"><div className="field-label">Tamanho do voucher (quartos)</div><div className="field-line" /></div>
            <div className="field"><div className="field-label">Autoridade habitacional</div><div className="field-line" /></div>
          </div>
        </div>

        <div className="section-title">Renda Familiar</div>
        <p><strong>Renda mensal familiar aproximada</strong></p>
        <div className="checkbox-row" style={{flexDirection:'column', alignItems:'flex-start', gap:'5pt'}}>
          {['Menos de $1.500','$1.500 – $2.500','$2.500 – $3.500','$3.500 – $5.000','$5.000 – $7.500','$7.500+'].map(i => (
            <span key={i} className="cb"><span className="cb-box" /> {i}</span>
          ))}
        </div>
        <p style={{marginTop:'6pt'}}>Comprovante de renda anexado: <span className="cb"><span className="cb-box" /> Sim</span> <span className="cb" style={{marginLeft:'8pt'}}><span className="cb-box" /> Nao</span></p>

        <div className="section-title">Quem Morara na Unidade?</div>
        <div className="field-row">
          <div className="field" style={{flex:'0 0 160pt'}}><div className="field-label">Numero de pessoas (incluindo voce)</div><div className="field-line" /></div>
        </div>
        <div className="field"><div className="field-label">Nomes dos demais ocupantes</div>
          <div className="field-line-tall" /><div className="field-line-tall" style={{marginTop:'6pt'}} />
        </div>

        <div className="section-title">Como Soube de Nos? *</div>
        <div className="checkbox-row">
          {['Vivian','Maribel','Listagem online','AppFolio','Visita direta','Outro'].map(r => (
            <span key={r} className="cb"><span className="cb-box" /> {r}</span>
          ))}
        </div>
        <div className="field" style={{marginTop:'6pt'}}><div className="field-label">Se Outro:</div><div className="field-line" /></div>

        <div className="section-title">Comentarios</div>
        <div className="field-line-tall" /><div className="field-line-tall" style={{marginTop:'6pt'}} />

        <div className="office-use">
          <strong>Para uso do escritorio:</strong>&nbsp;&nbsp;
          Recebido: <span className="office-field" />&nbsp;
          Contatado: <span className="office-field" />&nbsp;
          Por: <span className="office-field" />&nbsp;
          Resultado: <span className="office-field" style={{minWidth:'150pt'}} />
        </div>
      </div>
    </>
  );
}
