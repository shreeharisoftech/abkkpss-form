import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { FormRow, MemberRow } from '../database/schema';
import { getZoneLabel } from '../data/distinct-options';

export interface ReceiptData {
  form: FormRow;
  members: MemberRow[];
  approvalDate?: string;
  approverName?: string;
}

export interface MemberReceiptData {
  form: FormRow;
  member: MemberRow;
  mainMember?: MemberRow | null;
  approvalDate?: string;
  approverName?: string;
}

/**
 * Resolve the template image path across different deployment/run environments
 */
function getTemplateImagePath(): string {
  const possiblePaths = [
    path.resolve(process.cwd(), 'src', 'assets', 'receipt-template.png'),
    path.resolve(process.cwd(), 'dist', 'assets', 'receipt-template.png'),
    path.resolve(process.cwd(), 'dist', 'public', 'assets', 'receipt-template.png'),
    path.resolve(process.cwd(), 'assets', 'receipt-template.png'),
    'C:/Users/artis/.gemini/antigravity/brain/be020018-ff87-4802-9769-b4d774c1e147/.user_uploaded/media_1788781739317.png',
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return '';
}

/**
 * Resolve the official logo image path across different deployment/run environments
 */
function getLogoImagePath(): string {
  const possiblePaths = [
    path.resolve(process.cwd(), 'src', 'assets', 'logo.jpg'),
    path.resolve(process.cwd(), 'dist', 'assets', 'logo.jpg'),
    path.resolve(process.cwd(), 'dist', 'public', 'assets', 'logo.jpg'),
    path.resolve(process.cwd(), 'assets', 'logo.jpg'),
    'C:/Users/artis/.gemini/antigravity/brain/be020018-ff87-4802-9769-b4d774c1e147/.user_uploaded/media_1788782742758.jpg',
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return '';
}

/**
 * Draws fallback vector logo emblem of Shree ABKKPSS if image is unavailable
 */
function drawSamajEmblem(doc: any, centerX: number, centerY: number, brandMaroon: string, royalGold: string) {
  const logoR = 19;
  doc.save();

  // Outer decorative triple rings
  doc.circle(centerX, centerY, logoR + 3).lineWidth(1).strokeColor(royalGold).stroke();
  doc.circle(centerX, centerY, logoR).lineWidth(1.5).strokeColor(brandMaroon).stroke();
  doc.circle(centerX, centerY, logoR - 3).lineWidth(0.5).strokeColor(royalGold).stroke();

  // Sacred Kalash & Coconut Vector Motif inside Logo
  doc.rect(centerX - 8, centerY + 8, 16, 2.5).fillColor(royalGold).fill();
  doc.circle(centerX, centerY + 2, 8.5).fillColor(brandMaroon).fill();
  doc.rect(centerX - 6, centerY - 5, 12, 2.5).fillColor(royalGold).fill();
  doc.polygon(
    [centerX - 5, centerY - 5],
    [centerX + 5, centerY - 5],
    [centerX, centerY - 14]
  ).fillColor(royalGold).fill();
  doc.polygon(
    [centerX - 6, centerY - 5],
    [centerX - 13, centerY - 10],
    [centerX - 7, centerY - 8]
  ).fillColor(brandMaroon).fill();
  doc.polygon(
    [centerX + 6, centerY - 5],
    [centerX + 13, centerY - 10],
    [centerX + 7, centerY - 8]
  ).fillColor(brandMaroon).fill();

  doc.restore();
}

/**
 * Renders a single landscape membership receipt page on the exact template
 */
function renderReceiptPage(
  doc: any,
  templatePath: string,
  form: FormRow,
  member: MemberRow,
  approvalDate?: string
) {
  const pageWidth = doc.page.width;   // 841.89 (A4 Landscape)
  const pageHeight = doc.page.height; // 595.28

  // Color Palette harmonized with official logo
  const brandMaroon = '#671A46';    // Iconic Maroon ring of the logo
  const deepBurgundy = '#541238';   // Deep rich text color
  const royalGold = '#C68A18';      // Golden rays, ornaments & frame
  const emeraldGreen = '#0B8D51';   // Logo Ravapar banner green for positive status/amount
  const charcoalDark = '#222222';   // High readability text
  const mutedGray = '#555555';      // Secondary text
  const panelBg = '#FDFAFC';        // Soft clean ivory-rose tint
  const panelBorder = '#DEC8D3';    // Soft burgundy-rose border

  // 1. Draw base template image full-page if available
  if (templatePath && fs.existsSync(templatePath)) {
    doc.image(templatePath, 0, 0, { width: pageWidth, height: pageHeight });

    // Cover the interior of the double rectangle with pure white
    // Preserves the outer geometric pattern border
    doc.rect(88, 70, 666, 456).fillColor('#ffffff').fill();

    // Elegant inner double frame overlay matching the logo colors (outer gold, inner maroon)
    doc.rect(84, 66, 674, 464).lineWidth(1.2).strokeColor(royalGold).stroke();
    doc.rect(88, 70, 666, 456).lineWidth(1.5).strokeColor(brandMaroon).stroke();
  } else {
    // Fallback: draw background and coordinated borders
    doc.rect(0, 0, pageWidth, pageHeight).fillColor('#ffffff').fill();
    doc.rect(84, 66, 674, 464).lineWidth(1.2).strokeColor(royalGold).stroke();
    doc.rect(88, 70, 666, 456).lineWidth(1.5).strokeColor(brandMaroon).stroke();
  }

  const fullW = 640;
  const startX = (pageWidth - fullW) / 2; // ~100.9
  const centerX = pageWidth / 2;          // ~420.9

  // --- 1. TOP CENTER: OFFICIAL LOGO ---
  const logoPath = getLogoImagePath();
  const logoSize = 78;
  if (logoPath && fs.existsSync(logoPath)) {
    doc.image(logoPath, centerX - logoSize / 2, 74, { width: logoSize, height: logoSize });
  } else {
    drawSamajEmblem(doc, centerX, 110, brandMaroon, royalGold);
  }

  // --- 2. SAMAJ NAME & CENTRAL OFFICE ---
  doc
    .fillColor(brandMaroon)
    .fontSize(12.5)
    .font('Helvetica-Bold')
    .text('SHREE AKHIL BHARATIYA KUTCH KADWA PATIDAR SATSANG SAMAJ', startX, 168, {
      align: 'center',
      width: fullW,
    });

  // Decorative divider below header
  const dividerW = 180;
  doc.strokeColor(royalGold).lineWidth(0.8).moveTo(centerX - dividerW / 2, 183).lineTo(centerX + dividerW / 2, 183).stroke();

  // --- 3. HEADING: LIFETIME MEMBERSHIP RECEIPT ---
  doc
    .fillColor(brandMaroon)
    .fontSize(20.5)
    .font('Helvetica-Bold')
    .text('LIFETIME MEMBERSHIP RECEIPT', startX, 189, {
      align: 'center',
      width: fullW,
    });

  // --- 4. SUBTITLE ---
  doc
    .fillColor(mutedGray)
    .fontSize(10.5)
    .font('Helvetica')
    .text('This official membership receipt is proudly presented to', startX, 217, {
      align: 'center',
      width: fullW,
    });

  // --- 5. MEMBER NAME (Large & Prominent) ---
  const memberName = (
    member.name ||
    [member.first_name, member.middle_name, member.last_name || form.surname]
      .filter(Boolean)
      .join(' ')
  ).trim() || 'Respected Member';

  doc
    .fillColor(deepBurgundy)
    .fontSize(27)
    .font('Times-BoldItalic')
    .text(memberName, startX, 235, {
      align: 'center',
      width: fullW,
    });

  // Elegant underline under name in royal gold
  const underlineW = Math.min(Math.max(memberName.length * 13, 280), 480);
  const underlineX = centerX - underlineW / 2;
  doc.strokeColor(royalGold).lineWidth(1.5).moveTo(underlineX, 269).lineTo(underlineX + underlineW, 269).stroke();

  // --- 6. ACKNOWLEDGMENT PARAGRAPH ---
  doc
    .fillColor(mutedGray)
    .fontSize(9.5)
    .font('Helvetica')
    .text(
      'In grateful acknowledgment of the lifetime membership contribution received with sincere thanks towards Shree Akhil Bharatiya Kutch Kadwa Patidar Satsang Samaj, confirming official membership enrollment and registration.',
      startX + 40,
      280,
      {
        align: 'center',
        width: fullW - 80,
        lineGap: 3,
      }
    );

  // --- 7. FULL-WIDTH DETAILS GRID ---
  const gridX = startX + 15;
  const gridY = 340;
  const gridW = fullW - 30; // 610 pt
  const gridH = 92;

  // Background panel with soft cream fill & subtle border
  doc.rect(gridX, gridY, gridW, gridH).fillColor(panelBg).fill().strokeColor(panelBorder).lineWidth(1).stroke();

  // Header strip inside the panel: Solid brand maroon with crisp white text
  doc.rect(gridX, gridY, gridW, 22).fillColor(brandMaroon).fill();
  doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold').text('OFFICIAL MEMBERSHIP & PAYMENT PARTICULARS', gridX + 15, gridY + 7);

  // 3-Column Layout inside the card (2 rows of 3 columns)
  const c1X = gridX + 18;
  const c2X = gridX + 220;
  const c3X = gridX + 420;
  let rY = gridY + 34;

  const isAdult = member.is_adult_18_plus === true || member.is_adult_18_plus === 1;

  // Only display generate membership number, no zonenumber, familynumber and member number in Member No
  let memberNumber = '';
  if (member.unique_member_seq) {
    memberNumber = String(member.unique_member_seq).padStart(5, '0');
  } else if (member.fixed_member_number) {
    const match = member.fixed_member_number.match(/-(\d+)$/);
    if (match) {
      memberNumber = match[1];
    } else {
      const trailingDigits = member.fixed_member_number.match(/\d+$/);
      memberNumber = trailingDigits ? trailingDigits[0].padStart(5, '0') : member.fixed_member_number;
    }
  } else {
    memberNumber = '(Pending)';
  }

  // No prefix in Receipt no. Use member no for receipt no.
  let receiptNo = memberNumber && memberNumber !== '(Pending)' ? memberNumber : '';
  if (!receiptNo && form.receipt_number) {
    const match = form.receipt_number.match(/\d+$/);
    receiptNo = match ? match[0] : form.receipt_number;
  }
  if (!receiptNo) {
    receiptNo = 'PROVISIONAL';
  }

  const mobileNo = member.mobile_number || form.filler_mobile || '-';
  const feeAmount = isAdult ? 'Rs. 500/- (Cash)' : 'Rs. 0/- (Minor / Dependent)';
  const zoneLabel = getZoneLabel(form.zone_number) || `Zone ${form.zone_number}`;
  const nativeDetail = form.native_place || '-';

  // Row 1: RECEIPT NO | MEMBER NO | MOBILE NO
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(charcoalDark).text('RECEIPT NO:', c1X, rY);
  doc.font('Helvetica-Bold').fillColor(brandMaroon).text(receiptNo, c1X + 70, rY);

  doc.font('Helvetica-Bold').fillColor(charcoalDark).text('MEMBER NO:', c2X, rY);
  doc.font('Helvetica-Bold').fillColor(brandMaroon).text(memberNumber, c2X + 70, rY);

  doc.font('Helvetica-Bold').fillColor(charcoalDark).text('MOBILE NO:', c3X, rY);
  doc.font('Helvetica').fillColor(charcoalDark).text(mobileNo, c3X + 62, rY);

  // Row 2: AMOUNT | ZONE | NATIVE
  rY += 26;
  doc.font('Helvetica-Bold').fillColor(charcoalDark).text('AMOUNT:', c1X, rY);
  doc.font('Helvetica-Bold').fillColor(emeraldGreen).fontSize(9).text(feeAmount, c1X + 70, rY);
  doc.fontSize(8.5);

  doc.font('Helvetica-Bold').fillColor(charcoalDark).text('ZONE:', c2X, rY);
  doc.font('Helvetica').fillColor(charcoalDark).text(zoneLabel, c2X + 70, rY);

  doc.font('Helvetica-Bold').fillColor(charcoalDark).text('NATIVE:', c3X, rY);
  doc.font('Helvetica').fillColor(charcoalDark).text(nativeDetail, c3X + 62, rY);

  // --- 8. BOTTOM FOOTER ---
  const footerY = 480;
  doc.strokeColor(panelBorder).lineWidth(0.8).moveTo(startX + 80, footerY).lineTo(startX + fullW - 80, footerY).stroke();

  doc
    .fillColor(mutedGray)
    .fontSize(7.5)
    .font('Helvetica')
    .text(
      'This is an official computerized lifetime membership receipt issued by Shree Akhil Bharatiya Kutch Kadwa Patidar Satsang Samaj.',
      startX,
      footerY + 8,
      {
        align: 'center',
        width: fullW,
      }
    );

  doc
    .fillColor('#888888')
    .fontSize(7)
    .font('Helvetica')
    .text(
      'Trush Reg. No. A-1607 (Kutch) | PAN No. AAGTA5120P | Valid without physical signature',
      startX,
      footerY + 20,
      {
        align: 'center',
        width: fullW,
      }
    );
}

/**
 * Generates an official landscape receipt PDF for an individual member using the exact template.
 */
export function generateMemberReceiptPdf(data: MemberReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const templatePath = getTemplateImagePath();
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 0,
        info: {
          Title: `ABKKPSS Member Receipt - ${data.member.fixed_member_number || 'PENDING'}`,
          Author: 'Shree Akhil Bharatiya Kutch Kadwa Patidar Satsang Samaj',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      renderReceiptPage(doc, templatePath, data.form, data.member, data.approvalDate);

      doc.end();
    } catch (ex) {
      reject(ex);
    }
  });
}

/**
 * Generates a complete landscape receipt PDF for all members of a family form.
 * Each member receives their personalized certificate/receipt page on the exact template.
 */
export function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const templatePath = getTemplateImagePath();
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 0,
        info: {
          Title: `ABKKPSS Receipt - ${data.form.receipt_number || 'PENDING'}`,
          Author: 'Shree Akhil Bharatiya Kutch Kadwa Patidar Satsang Samaj',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const members = data.members && data.members.length > 0 ? data.members : [
        {
          id: 0,
          form_id: data.form.id || 0,
          serial_no: 1,
          name: data.form.filler_name || 'Head of Family',
          first_name: '',
          middle_name: '',
          last_name: data.form.surname || '',
          dob: '',
          is_adult_18_plus: 1,
          gender: 'M' as const,
          relation: 'Self',
          education: '',
          mobile_number: data.form.filler_mobile || '',
          blood_group: '',
          is_main_member: 1,
          fixed_member_number: null,
          unique_member_seq: null,
        }
      ];

      members.forEach((member, index) => {
        if (index > 0) {
          doc.addPage({
            size: 'A4',
            layout: 'landscape',
            margin: 0,
          });
        }
        renderReceiptPage(doc, templatePath, data.form, member, data.approvalDate);
      });

      doc.end();
    } catch (ex) {
      reject(ex);
    }
  });
}
