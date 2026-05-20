# Stanton Management - Tenant Onboarding Form Specification

## Project Overview

**Purpose:** Single online form for tenants to complete pet registration, renters insurance verification, and parking permit applications. Form must be trilingual (English, Spanish, Portuguese) and generate signed PDF/Word documents.

**Business Context:** Stanton Management recently took over management of multiple apartment buildings. Tenants need to comply with new policies by end of February. This form replaces paper forms and consolidates three separate processes into one.

**Tech Stack:**
- Next.js (App Router)
- Supabase (database + file storage)
- Vercel deployment
- react-signature-canvas for digital signatures
- docxtemplater for filling Word templates
- Resend for confirmation emails

---

## User Flow

```
1. User selects language (English / EspaÃ±ol / PortuguÃªs)
   â†“
2. User sees intro explaining what's changing
   â†“
3. User enters basic info (name, phone, building, unit)
   â†“
4. PET SECTION
   â†’ "Do you have pets?" 
   â†’ If YES: Fill pet details + sign Pet Addendum
   â†’ If NO: Sign acknowledgment (no pets, will register if get one)
   â†“
5. INSURANCE SECTION
   â†’ "Do you have renters insurance?"
   â†’ If YES: Upload proof, enter provider/policy info
   â†’ If NO: Check box to add insurance to rent
   â†“
6. VEHICLE SECTION
   â†’ "Do you have a vehicle?"
   â†’ If YES: Enter vehicle details + sign Vehicle Addendum
   â†’ If NO: See message about future registration
   â†“
7. Submit
   â†“
8. System generates signed documents, stores in Supabase, emails confirmation
```

---

## Language Handling

**One language selector at the top controls the entire form.**

All form labels, instructions, informational text, and button labels switch based on selection. Legal addendums stay in English (they are legal documents).

The `lang` state variable (`'en'` | `'es'` | `'pt'`) drives all UI text via a translations object.

---

## Section 1: Introduction

This is NOT a form section - it's informational content displayed after language selection.

### English
```
As you may know, Stanton Management is now managing your building. We want to introduce you to a few new changes and requirements that may have not been required by the prior owner/manager.

WHAT IS CHANGING:

â€¢ Pet registration - All dogs and cats must be registered. Pet rent is $20-$50 per month per pet. Birds, fish, hamsters or any other pets that stay in a tank or cage do not need to be registered.

â€¢ Renters insurance - This is now required. It protects you and your neighbors. Cost is about $10-20 per month.

â€¢ Parking permits - We are issuing new parking permits. The old permits will not work after February 28th. Parking costs $50 per car per month.
```

### Spanish
```
Como ya sabe, Stanton Management ahora administra su edificio. Queremos presentarle algunos cambios y nuevos requisitos que quizÃ¡s no fueron requeridos por el propietario/administrador anterior.

QUÃ‰ ESTÃ CAMBIANDO:

â€¢ Registro de mascotas - Todos los perros y gatos deben ser registrados. El alquiler de mascotas es de $20-$50 por mes. PÃ¡jaros, peces, hÃ¡msters o mascotas en jaulas no necesitan registro.

â€¢ Seguro de inquilino - Ahora es obligatorio. Lo protege a usted y a sus vecinos. Cuesta aproximadamente $10-20 por mes.

â€¢ Permisos de estacionamiento - Estamos emitiendo nuevos permisos. Los antiguos no funcionarÃ¡n despuÃ©s del 28 de febrero. Cuesta $50 por carro por mes.
```

### Portuguese
```
Como vocÃª jÃ¡ sabe, a Stanton Management agora administra seu prÃ©dio. Queremos apresentar algumas mudanÃ§as e novos requisitos que talvez nÃ£o fossem exigidos pelo proprietÃ¡rio/administrador anterior.

O QUE ESTÃ MUDANDO:

â€¢ Registro de animais - Todos os cÃ£es e gatos devem ser registrados. O aluguel Ã© de $20-$50 por mÃªs. PÃ¡ssaros, peixes, hamsters ou animais em gaiolas nÃ£o precisam de registro.

â€¢ Seguro de locatÃ¡rio - Agora Ã© obrigatÃ³rio. Protege vocÃª e seus vizinhos. Custa aproximadamente $10-20 por mÃªs.

â€¢ AutorizaÃ§Ãµes de estacionamento - Estamos emitindo novas autorizaÃ§Ãµes. As antigas nÃ£o funcionarÃ£o apÃ³s 28 de fevereiro. Custa $50 por carro por mÃªs.
```

---

## Section 2: Resident Information

**Fields (all required):**

| English | Spanish | Portuguese | Type |
|---------|---------|------------|------|
| Full Name | Nombre Completo | Nome Completo | Text |
| Phone Number | NÃºmero de TelÃ©fono | NÃºmero de Telefone | Phone |
| This is a new phone number | Este es un nÃºmero nuevo | Este Ã© um nÃºmero novo | Checkbox |
| Building Address | DirecciÃ³n del Edificio | EndereÃ§o do PrÃ©dio | Dropdown |
| Unit Number | NÃºmero de Apartamento | NÃºmero do Apartamento | Text |

**Building Dropdown Options:**
- 31-33 Park St
- 57 Park St
- 67-73 Park St
- 83-91 Park St
- 10 Wolcott St
- 144-146 Affleck St
- 178 Affleck St
- 182 Affleck St
- 190 Affleck St
- 179 Affleck St
- 195 Affleck St

---

## Section 3: Pet Registration

### 3.1 Pet Policy Information (display before question)

#### English
```
PET POLICY

All tenants must fill this form out to confirm if they do or do not have animals.

All dogs and cats must be registered with management. There is a monthly pet rent for each dog or cat in addition to your rent. Small animals kept in cages or tanks (birds, hamsters, fish, etc.) do not require registration and have no fee.

Prohibited animals: Ferrets, snakes longer than 3 feet, and any animal classified as dangerous under local law.

Deadline: February 28th. Unregistered dogs or cats found after this date will result in a $500 fee plus back-owed pet rent.
```

#### Spanish
```
POLÃTICA DE MASCOTAS

Todos los inquilinos deben completar este formulario para confirmar si tienen o no animales.

Todos los perros y gatos deben registrarse con la administraciÃ³n. Hay un alquiler mensual por cada perro o gato ademÃ¡s de su renta. Animales pequeÃ±os en jaulas o tanques (pÃ¡jaros, hÃ¡msters, peces, etc.) no requieren registro y no tienen cargo.

Animales prohibidos: Hurones, serpientes de mÃ¡s de 3 pies, y cualquier animal clasificado como peligroso por la ley local.

Fecha lÃ­mite: 28 de febrero. Perros o gatos no registrados encontrados despuÃ©s de esta fecha resultarÃ¡n en una multa de $500 mÃ¡s el alquiler atrasado.
```

#### Portuguese
```
POLÃTICA DE ANIMAIS

Todos os inquilinos devem preencher este formulÃ¡rio para confirmar se tÃªm ou nÃ£o animais.

Todos os cÃ£es e gatos devem ser registrados com a administraÃ§Ã£o. HÃ¡ um aluguel mensal para cada cÃ£o ou gato alÃ©m do seu aluguel. Animais pequenos em gaiolas ou tanques (pÃ¡ssaros, hamsters, peixes, etc.) nÃ£o requerem registro e nÃ£o tÃªm taxa.

Animais proibidos: FurÃµes, cobras com mais de 3 pÃ©s, e qualquer animal classificado como perigoso pela lei local.

Prazo: 28 de fevereiro. CÃ£es ou gatos nÃ£o registrados encontrados apÃ³s esta data resultarÃ£o em multa de $500 mais aluguel atrasado.
```

### 3.2 Pet Rent Table (display to all)

| Pet Type | Weight | Monthly Rent | One-Time Fee |
|----------|--------|--------------|--------------|
| Cat | N/A | $25 | $150 |
| Small Dog | Under 25 lbs | $25 | $200 |
| Medium Dog | 25-50 lbs | $35 | $250 |
| Large Dog | 50+ lbs | $45 | $300 |

**Table header translations:**
- EN: Pet Type / Weight / Monthly Rent / One-Time Fee
- ES: Tipo de Mascota / Peso / Alquiler Mensual / Cargo Ãšnico
- PT: Tipo de Animal / Peso / Aluguel Mensal / Taxa Ãšnica

### 3.3 Pet Question

| English | Spanish | Portuguese |
|---------|---------|------------|
| Do you have any pets? (dogs or cats) | Â¿Tiene mascotas? (perros o gatos) | VocÃª tem animais? (cÃ£es ou gatos) |

**Options:** Yes/SÃ­/Sim, No/No/NÃ£o

### 3.4 If YES - Pet Details Form

| English | Spanish | Portuguese | Type |
|---------|---------|------------|------|
| Pet Type | Tipo de Mascota | Tipo de Animal | Dropdown: Dog/Cat |
| Pet Name | Nombre de la Mascota | Nome do Animal | Text |
| Breed | Raza | RaÃ§a | Text |
| Weight (lbs) | Peso (libras) | Peso (libras) | Number |
| Color | Color | Cor | Text |
| Spayed/Neutered? | Â¿Esterilizado? | Castrado? | Yes/No |
| Vaccinations current? | Â¿Vacunas al dÃ­a? | Vacinas em dia? | Yes/No |
| Upload vaccination records | Subir registros de vacunas | Carregar registros de vacinas | File Upload |
| Upload photo of pet | Subir foto de la mascota | Carregar foto do animal | File Upload |

**Pet Type dropdown options:**
- EN: Dog / Cat
- ES: Perro / Gato
- PT: Cachorro / Gato

### 3.5 Pet Addendum (English only - display to ALL users)

Display the full Pet Addendum legal text (see `pet_addendum_template.docx` for full text).

**Key sections to display:**
1. Permitted Animals
2. Prohibited Animals/Breeds
3. Pet/Animal Related Fees (table)
4. Violation Fees (table)
5. Pet Vaccination Requirements
6. Pet Record Requirements

### 3.6 Pet Signature Section

**If user has pets:**
- Checkbox (required): "I agree to the Pet Addendum terms and will pay the required pet rent and fees"
- Signature canvas
- Date picker

**If user does NOT have pets:**
- Checkbox (required): "I confirm I do not have pets. I understand that if I get a pet, I must register it within 7 days and agree to these terms."
- Signature canvas
- Date picker

---

## Section 4: Renters Insurance

### 4.1 Insurance Information (display before question)

#### English
```
RENTERS INSURANCE

Why Do I Need This?
Renters insurance protects your personal belongings and provides liability coverage if something unexpected happensâ€”like your laptop being stolen, a fire/flood damaging your furniture, a guest getting injured on the property, or your pet biting someone.

Cost: $10-25 per month

Deadline: February 17th

Option 1: Get Your Own Insurance
Buy from any company (Lemonade, GEICO, your car insurance company, etc.)
Your policy must show:
â€¢ Your address
â€¢ At least $100,000 liability coverage ($300,000 if you have pets)
â€¢ Your building's LLC as "Additional Insured"

Option 2: We Do It For You
Don't want to deal with it? We can sign you up through our partnership with Appfolio Renters Insurance.
â€¢ About $10-25 per month
â€¢ Added to your rent
â€¢ No extra bills
```

#### Spanish
```
SEGURO DE INQUILINO

Â¿Por QuÃ© Lo Necesito?
El seguro de inquilino protege sus pertenencias personales y proporciona cobertura de responsabilidad si algo inesperado sucedeâ€”como el robo de su computadora, un incendio/inundaciÃ³n daÃ±ando sus muebles, un invitado lesionÃ¡ndose en la propiedad, o su mascota mordiendo a alguien.

Costo: $10-25 por mes

Fecha lÃ­mite: 17 de febrero

OpciÃ³n 1: Obtenga Su Propio Seguro
Compre de cualquier compaÃ±Ã­a (Lemonade, GEICO, su compaÃ±Ã­a de seguro de auto, etc.)
Su pÃ³liza debe mostrar:
â€¢ Su direcciÃ³n
â€¢ Al menos $100,000 de cobertura de responsabilidad ($300,000 si tiene mascotas)
â€¢ El LLC de su edificio como "Asegurado Adicional"

OpciÃ³n 2: Nosotros Lo Hacemos Por Usted
Â¿No quiere lidiar con esto? Podemos inscribirlo a travÃ©s de nuestra asociaciÃ³n con Appfolio Renters Insurance.
â€¢ Aproximadamente $10-25 por mes
â€¢ Agregado a su alquiler
â€¢ Sin facturas adicionales
```

#### Portuguese
```
SEGURO DE LOCATÃRIO

Por Que Preciso Disso?
O seguro de locatÃ¡rio protege seus pertences pessoais e fornece cobertura de responsabilidade se algo inesperado acontecerâ€”como roubo do seu computador, incÃªndio/inundaÃ§Ã£o danificando seus mÃ³veis, um convidado se machucando na propriedade, ou seu animal mordendo alguÃ©m.

Custo: $10-25 por mÃªs

Prazo: 17 de fevereiro

OpÃ§Ã£o 1: Obtenha Seu PrÃ³prio Seguro
Compre de qualquer empresa (Lemonade, GEICO, sua seguradora de carro, etc.)
Sua apÃ³lice deve mostrar:
â€¢ Seu endereÃ§o
â€¢ Pelo menos $100,000 de cobertura de responsabilidade ($300,000 se tiver animais)
â€¢ A LLC do seu prÃ©dio como "Segurado Adicional"

OpÃ§Ã£o 2: NÃ³s Fazemos Por VocÃª
NÃ£o quer lidar com isso? Podemos inscrevÃª-lo atravÃ©s da nossa parceria com Appfolio Renters Insurance.
â€¢ Aproximadamente $10-25 por mÃªs
â€¢ Adicionado ao seu aluguel
â€¢ Sem contas extras
```

### 4.2 Insurance Question

| English | Spanish | Portuguese |
|---------|---------|------------|
| Do you currently have renters insurance? | Â¿Tiene actualmente seguro de inquilino? | VocÃª tem atualmente seguro de locatÃ¡rio? |

**Options:** Yes/SÃ­/Sim, No/No/NÃ£o

### 4.3 If YES - Insurance Upload

| English | Spanish | Portuguese | Type |
|---------|---------|------------|------|
| Insurance Provider | CompaÃ±Ã­a de Seguros | Seguradora | Text |
| Policy Number | NÃºmero de PÃ³liza | NÃºmero da ApÃ³lice | Text |
| Upload Proof of Insurance | Subir Prueba de Seguro | Carregar Comprovante | File Upload |

**Also display the LLC Table (English only):**

| Your Address | Additional Insured |
|--------------|-------------------|
| 31-33 Park St | SREP Park 1 LLC c/o Stanton Management LLC |
| 57 Park St | SREP Park 4 LLC c/o Stanton Management LLC |
| 67-73 Park St | SREP Park 2 LLC c/o Stanton Management LLC |
| 83-91 Park St | SREP Park 3 LLC c/o Stanton Management LLC |
| 10 Wolcott St | SREP Park 5 LLC c/o Stanton Management LLC |
| 144-146, 178, 182, 190 Affleck St | SREP Park 7 LLC c/o Stanton Management LLC |
| 179 Affleck St | SREP Park 6 LLC c/o Stanton Management LLC |
| 195 Affleck St | SREP Park 8 LLC c/o Stanton Management LLC |

**Additional Insured Address:** 421 Park St, Hartford CT 06106

### 4.4 If NO - Add to Rent

Display notice that insurance is required, then:

| English | Spanish | Portuguese |
|---------|---------|------------|
| I do not have insurance. Please add renters insurance to my monthly rent. | No tengo seguro. Por favor agregue el seguro de inquilino a mi alquiler mensual. | NÃ£o tenho seguro. Por favor adicione o seguro de locatÃ¡rio ao meu aluguel mensal. |

Type: Checkbox (required if no insurance)

---

## Section 5: Vehicle & Parking

### 5.1 Parking Information (display before question)

#### English
```
PARKING PERMITS & FEES

Parking is $50 per vehicle per month, added to your rent.
Maximum 3 vehicles per household.

To Get Your Parking Permit:

Step 1 - Submit your vehicle information by February 8th
Fill out this form.

Step 2 - Sign your parking agreement
On February 9th, we will email/text you a link to sign electronically. Or sign in person when you pick up your permit.

Step 3 - Pick up your permit between February 17-20, 10 AM to 6:30 PM
Bring:
â€¢ ID
â€¢ Proof of renters insurance (or sign up at the office)
â€¢ Completed pet registration (if you have a dog or cat)

DEADLINES:
â€¢ Submit vehicle info: February 8th
â€¢ Parking agreements sent: February 9th
â€¢ Permit pickup: February 17-20
â€¢ Permits required: End of February

Vehicles without a valid permit after February 28th will be towed.

The permit must be displayed on the upper driver's side of the windshield.
```

#### Spanish
```
PERMISOS Y TARIFAS DE ESTACIONAMIENTO

El estacionamiento cuesta $50 por vehÃ­culo por mes, agregado a su alquiler.
MÃ¡ximo 3 vehÃ­culos por hogar.

Para Obtener Su Permiso:

Paso 1 - EnvÃ­e la informaciÃ³n de su vehÃ­culo antes del 8 de febrero
Complete este formulario.

Paso 2 - Firme su acuerdo de estacionamiento
El 9 de febrero, le enviaremos un enlace por correo/texto para firmar electrÃ³nicamente. O firme en persona cuando recoja su permiso.

Paso 3 - Recoja su permiso entre el 17-20 de febrero, 10 AM a 6:30 PM
Traiga:
â€¢ IdentificaciÃ³n
â€¢ Prueba de seguro de inquilino (o inscrÃ­base en la oficina)
â€¢ Registro de mascotas completado (si tiene perro o gato)

FECHAS LÃMITE:
â€¢ Enviar info del vehÃ­culo: 8 de febrero
â€¢ Acuerdos enviados: 9 de febrero
â€¢ Recoger permiso: 17-20 de febrero
â€¢ Permisos requeridos: Fin de febrero

VehÃ­culos sin permiso vÃ¡lido despuÃ©s del 28 de febrero serÃ¡n remolcados.

El permiso debe colocarse en la parte superior del lado del conductor del parabrisas.
```

#### Portuguese
```
AUTORIZAÃ‡Ã•ES E TAXAS DE ESTACIONAMENTO

O estacionamento custa $50 por veÃ­culo por mÃªs, adicionado ao seu aluguel.
MÃ¡ximo 3 veÃ­culos por residÃªncia.

Para Obter Sua AutorizaÃ§Ã£o:

Passo 1 - Envie as informaÃ§Ãµes do veÃ­culo atÃ© 8 de fevereiro
Preencha este formulÃ¡rio.

Passo 2 - Assine seu contrato de estacionamento
Em 9 de fevereiro, enviaremos um link por email/texto para assinar eletronicamente. Ou assine pessoalmente ao retirar sua autorizaÃ§Ã£o.

Passo 3 - Retire sua autorizaÃ§Ã£o entre 17-20 de fevereiro, 10h Ã s 18h30
Traga:
â€¢ IdentificaÃ§Ã£o
â€¢ Comprovante de seguro de locatÃ¡rio (ou inscreva-se no escritÃ³rio)
â€¢ Registro de animais completo (se tiver cÃ£o ou gato)

PRAZOS:
â€¢ Enviar info do veÃ­culo: 8 de fevereiro
â€¢ Contratos enviados: 9 de fevereiro
â€¢ Retirar autorizaÃ§Ã£o: 17-20 de fevereiro
â€¢ AutorizaÃ§Ãµes obrigatÃ³rias: Fim de fevereiro

VeÃ­culos sem autorizaÃ§Ã£o vÃ¡lida apÃ³s 28 de fevereiro serÃ£o rebocados.

A autorizaÃ§Ã£o deve ser colocada na parte superior do lado do motorista do para-brisa.
```

### 5.2 Parking Fee Table (display to all)

| Vehicle Type | Monthly Fee |
|--------------|-------------|
| Moped, motorcycle, ATV, scooter | $20 |
| Sedan, SUV, Pickup (under 20 ft) | $50 |
| Oversized vehicles (over 20 ft) | $60 |
| Boats, trailers, equipment | $60+ (approval required) |

**Table header translations:**
- EN: Vehicle Type / Monthly Fee
- ES: Tipo de VehÃ­culo / Tarifa Mensual
- PT: Tipo de VeÃ­culo / Taxa Mensal

### 5.3 Vehicle Question

| English | Spanish | Portuguese |
|---------|---------|------------|
| Do you have a vehicle that needs a parking permit? | Â¿Tiene un vehÃ­culo que necesita permiso de estacionamiento? | VocÃª tem um veÃ­culo que precisa de autorizaÃ§Ã£o? |

**Options:** Yes/SÃ­/Sim, No/No/NÃ£o

### 5.4 If YES - Vehicle Details

| English | Spanish | Portuguese | Type |
|---------|---------|------------|------|
| Vehicle Make | Marca del VehÃ­culo | Marca do VeÃ­culo | Text |
| Vehicle Model | Modelo del VehÃ­culo | Modelo do VeÃ­culo | Text |
| Vehicle Year | AÃ±o del VehÃ­culo | Ano do VeÃ­culo | Number (4 digits) |
| Vehicle Color | Color del VehÃ­culo | Cor do VeÃ­culo | Text |
| License Plate | NÃºmero de Placa | NÃºmero da Placa | Text |

### 5.5 Vehicle Addendum (English only - show if has vehicle)

Display the full Vehicle & Parking Addendum legal text (see `vehicle_addendum_template.docx`).

**Key sections:**
1. Parking not guaranteed
2. Monthly fees by vehicle type
3. Parking rules
4. Liability disclaimer
5. Damage fees table
6. Towing policy

### 5.6 Vehicle Signature (if has vehicle)

- Checkbox (required): "I agree to the Vehicle and Parking Addendum terms"
- Signature canvas
- Date picker

### 5.7 If NO Vehicle

Display message:

| English | Spanish | Portuguese |
|---------|---------|------------|
| If you get a vehicle in the future, contact the office to register for a parking permit. | Si obtiene un vehÃ­culo en el futuro, contacte la oficina para registrarse para un permiso. | Se vocÃª adquirir um veÃ­culo no futuro, entre em contato com o escritÃ³rio para se registrar. |

---

## Section 6: Final Submission

### 6.1 Final Confirmation

| English | Spanish | Portuguese |
|---------|---------|------------|
| By submitting this form, I confirm all information is accurate. | Al enviar este formulario, confirmo que toda la informaciÃ³n es correcta. | Ao enviar este formulÃ¡rio, confirmo que todas as informaÃ§Ãµes sÃ£o corretas. |

Type: Checkbox (required)

### 6.2 Submit Button

| English | Spanish | Portuguese |
|---------|---------|------------|
| Submit | Enviar | Enviar |

---

## Database Schema

```sql
create table submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp default now(),
  
  -- Resident info
  language text not null, -- 'en', 'es', 'pt'
  full_name text not null,
  phone text not null,
  phone_is_new boolean default false,
  building_address text not null,
  unit_number text not null,
  
  -- Pet section
  has_pets boolean not null,
  pet_type text,
  pet_name text,
  pet_breed text,
  pet_weight integer,
  pet_color text,
  pet_spayed boolean,
  pet_vaccinations_current boolean,
  pet_vaccination_file text,
  pet_photo_file text,
  pet_addendum_agreed boolean,
  pet_signature text,
  pet_signature_date date,
  
  -- Insurance section
  has_insurance boolean not null,
  insurance_provider text,
  insurance_policy_number text,
  insurance_file text,
  add_insurance_to_rent boolean default false,
  
  -- Vehicle section
  has_vehicle boolean not null,
  vehicle_make text,
  vehicle_model text,
  vehicle_year integer,
  vehicle_color text,
  vehicle_plate text,
  vehicle_addendum_agreed boolean,
  vehicle_signature text,
  vehicle_signature_date date,
  
  -- Generated documents
  pet_document_file text,
  vehicle_document_file text,
  
  -- Audit trail
  ip_address text,
  user_agent text,
  
  -- Final confirmation
  final_confirmation boolean not null default false
);
```

---

## Document Generation

### Templates (already created)

Three Word templates with `{{placeholder}}` syntax for docxtemplater:

1. **pet_addendum_template.docx** - Full Pet Addendum for tenants WITH pets
2. **no_pets_template.docx** - Acknowledgment for tenants WITHOUT pets
3. **vehicle_addendum_template.docx** - Vehicle Addendum for tenants with vehicles

### Generation Logic

```
On form submit:

1. If has_pets === true:
   â†’ Fill pet_addendum_template.docx with pet details + signature
   
2. If has_pets === false:
   â†’ Fill no_pets_template.docx with acknowledgment + signature
   
3. If has_vehicle === true:
   â†’ Fill vehicle_addendum_template.docx with vehicle details + signature
```

### Signature Handling

- Use `react-signature-canvas` for drawing
- Convert to PNG base64 on submit
- Use `docxtemplater-image-module-free` to insert into Word docs
- Store signature images in Supabase: `signatures/{submission_id}_pet.png`

### File Storage Structure

```
/templates/
  pet_addendum_template.docx
  no_pets_template.docx
  vehicle_addendum_template.docx

/uploads/{submission_id}/
  vaccination_records.pdf
  pet_photo.jpg
  insurance_proof.pdf

/signatures/
  {submission_id}_pet.png
  {submission_id}_vehicle.png

/documents/
  {submission_id}_pet_addendum.docx
  {submission_id}_vehicle_addendum.docx
```

---

## Email Confirmation

On successful submit, send email to tenant with:
- Confirmation message (in their selected language)
- PDF copies of signed documents attached
- Summary of what they submitted
- Reminder of deadlines and next steps

---

## UI/UX Requirements

1. **Professional/institutional design** - not flashy startup aesthetic
2. **Mobile-first** - many tenants will use phones
3. **Clear section breaks** with progress indicator
4. **Informational content styled differently** from form fields (use cards, borders, or background colors)
5. **Deadlines highlighted** prominently
6. **Tables must be readable** on mobile (consider horizontal scroll or stacked layout)
7. **Signature canvas** must work on touch devices
8. **Form validation** with clear error messages in selected language
9. **Loading states** during file uploads and submission

---

## Critical Business Rules

1. **Everyone must complete pet section** - either register pets OR sign acknowledgment
2. **Everyone must address insurance** - either upload proof OR opt into rent-added insurance
3. **Vehicle section is optional** - only if they have a vehicle
4. **Legal addendums stay in English** regardless of language selection
5. **All signatures required** before form can be submitted
6. **Deadlines are real** - this is not a soft launch

---

## Contact Information (for footer/confirmation)

**Stanton Management LLC**
421 Park Street
Hartford, CT 06106
Phone: (860) 993-3401

---

## Document Version

Last updated: February 5, 2025
Version: 1.0
