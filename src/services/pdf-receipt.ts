import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { FormRow, MemberRow } from '../database/schema';

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
 * Converts a positive number to words in English (Indian numbering system)
 */
export function numberToEnglishWords(num: number): string {
  if (!num || isNaN(num) || num <= 0) return 'Zero Only';
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(n: number): string {
    if (n === 0) return '';
    if (n < 20) return a[n] + ' ';
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '') + ' ';
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred ' + convert(n % 100);
    if (n < 100000) return convert(Math.floor(n / 1000)) + 'Thousand ' + convert(n % 1000);
    if (n < 10000000) return convert(Math.floor(n / 100000)) + 'Lakh ' + convert(n % 100000);
    return convert(Math.floor(n / 10000000)) + 'Crore ' + convert(n % 10000000);
  }

  const words = convert(Math.floor(num)).trim();
  return words ? `${words} Only` : 'Zero Only';
}

/**
 * Formats date into DD/MM/YYYY
 */
function formatReceiptDate(dateVal?: string | Date): string {
  if (!dateVal) {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(trimmed)) {
      return trimmed.replace(/-/g, '/');
    }
  }

  const d = new Date(dateVal);
  if (isNaN(d.getTime())) {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    return `${day}/${month}/${year}`;
  }

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Resolve the template image path across different deployment/run environments
 */
function getTemplateImagePath(): string {
  const possiblePaths = [
    path.resolve(process.cwd(), 'src', 'assets', 'receipt-template.jpg')
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return '';
}

/**
 * Resolve the Gujarati font paths across dev and dist environments
 */
function getGujaratiFontPaths(): { regular: string; bold: string } {
  const possibleDirs = [
    path.resolve(process.cwd(), 'src', 'assets', 'fonts'),
    path.resolve(process.cwd(), 'dist', 'assets', 'fonts'),
    path.resolve(process.cwd(), 'dist', 'public', 'assets', 'fonts'),
    path.resolve(process.cwd(), 'assets', 'fonts'),
  ];
  for (const dir of possibleDirs) {
    const reg = path.join(dir, 'NotoSansGujarati-Regular.ttf');
    const bld = path.join(dir, 'NotoSansGujarati-Bold.ttf');
    if (fs.existsSync(reg) && fs.existsSync(bld)) {
      return { regular: reg, bold: bld };
    }
  }
  return { regular: '', bold: '' };
}

/**
 * Registers Unicode Gujarati fonts on the PDFKit document
 */
function registerGujaratiFonts(doc: any) {
  const fontPaths = getGujaratiFontPaths();
  if (fontPaths.regular) {
    doc.registerFont('Gujarati', fontPaths.regular);
    doc.registerFont('Gujarati-Bold', fontPaths.bold || fontPaths.regular);
  }
}

/**
 * Renders a single receipt page filling in the blanks on the exact uploaded template
 */
function renderReceiptPage(
  doc: any,
  templatePath: string,
  form: FormRow,
  member: MemberRow,
  approvalDate?: string
) {
  // 1. Draw base template image full-page (1024 x 666)
  if (templatePath && fs.existsSync(templatePath)) {
    doc.image(templatePath, 0, 0, { width: 1024, height: 666 });
  } else {
    doc.rect(0, 0, 1024, 666).fillColor('#0d0e09').fill();
  }

  const textColor = '#dfb76c';

  // 1. Receipt No: Inside left box (box is y: 198..251)
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
  }

  let receiptNo = memberNumber && memberNumber !== '(Pending)' ? memberNumber : '';
  if (!receiptNo && form.receipt_number) {
    const match = form.receipt_number.match(/\d+$/);
    receiptNo = match ? match[0] : form.receipt_number;
  }
  if (!receiptNo) {
    receiptNo = 'Pending';
  }

  doc.font('Helvetica-Bold').fontSize(27).fillColor(textColor);
  doc.text(receiptNo, 170, 218, { width: 120, align: 'center' });

  // 2. Date: Inside right box (box is y: 198..251)
  const dateStr = formatReceiptDate(approvalDate || form.created_at);
  doc.font('Helvetica-Bold').fontSize(23).fillColor(textColor);
  doc.text(dateStr, 828, 218, { width: 135, align: 'center' });

  // 3. Mobile Number: Next to 'મો.' at y=280 (underline at y=289)
  const rawMobile = (member.mobile_number || form.filler_mobile || '').trim();
  const mobileStr = rawMobile.replace(/^\+91[\s-]*/, '');
  doc.font('Helvetica-Bold').fontSize(19).fillColor(textColor);
  doc.text(mobileStr, 765, 267, { width: 190, align: 'center' });

  // 4. Name: Next to 'શ્રીમાન :' (underline at y=327)
  const rawMemberName = (
    member.name ||
    [member.first_name, member.middle_name, member.last_name || form.surname]
      .filter(Boolean)
      .join(' ')
  ).trim() || form.filler_name || 'Member';

  const nameFontSize = rawMemberName.length > 35 ? 16 : rawMemberName.length > 26 ? 18 : 20;
  doc.font('Helvetica-Bold').fontSize(nameFontSize).fillColor(textColor);
  doc.text(rawMemberName, 150, 303, { width: 515, align: 'left' });

  // 5. Native: Next to 'ગામ :' (underline at y=327)
  const nativeStr = (form.native_place || '').trim();
  const nativeFontSize = nativeStr.length > 20 ? 17 : 20;
  doc.font('Helvetica-Bold').fontSize(nativeFontSize).fillColor(textColor);
  doc.text(nativeStr, 775, 303, { width: 190, align: 'left' });

  // 6. Nibhav Fund in gujarati: On underline after 'આપના તરફથી...', at y=376
  const hasGujarati = Boolean(
    (doc as any)._registeredFonts && ((doc as any)._registeredFonts['Gujarati-Bold'] || (doc as any)._registeredFonts['Gujarati'])
  );
  const gujaratiFont = hasGujarati ? ((doc as any)._registeredFonts['Gujarati-Bold'] ? 'Gujarati-Bold' : 'Gujarati') : 'Helvetica-Bold';
  doc.font(gujaratiFont).fontSize(20).fillColor(textColor);
  doc.text('નિભાવ ફંડ', 580, 351, { width: 180, align: 'center' });

  // 7. Amount: After 'ના રૂા.', underline at y=376
  const isAdult = member.is_adult_18_plus === true || member.is_adult_18_plus === 1;
  const memberAmount = isAdult ? 500 : (form.total_amount || 500);
  const amountStr = `${memberAmount}/-`;

  doc.font('Helvetica-Bold').fontSize(22).fillColor(textColor);
  doc.text(amountStr, 835, 352, { width: 120, align: 'center' });

  // 8. Amount in Words: Next to 'અંકે રૂપિયા', underline at y=421
  const amountWords = numberToEnglishWords(memberAmount);
  const wordsFontSize = amountWords.length > 45 ? 16 : 19;
  doc.font('Helvetica-Bold').fontSize(wordsFontSize).fillColor(textColor);
  doc.text(amountWords, 175, 398, { width: 770, align: 'left' });

  // 9. Bottom Rupee Badge: Inside pill (x:140..370, y:540..600)
  doc.font('Helvetica-Bold').fontSize(52).fillColor(textColor);
  doc.text(amountStr, 140, 549, { width: 230, align: 'center' });
}

/**
 * Generates an official receipt PDF for an individual member using the exact template.
 */
export function generateMemberReceiptPdf(data: MemberReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const templatePath = getTemplateImagePath();
      const doc = new PDFDocument({
        size: [1024, 666],
        margin: 0,
        info: {
          Title: `ABKKPSS Member Receipt - ${data.member.fixed_member_number || 'PENDING'}`,
          Author: 'Shree Akhil Bharatiya Kutch Kadwa Patidar Satsang Samaj',
        },
      });

      registerGujaratiFonts(doc);

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
 * Generates a complete receipt PDF for all members of a family form.
 * Each member receives their personalized receipt page on the exact template.
 */
export function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const templatePath = getTemplateImagePath();
      const doc = new PDFDocument({
        size: [1024, 666],
        margin: 0,
        info: {
          Title: `ABKKPSS Receipt - ${data.form.receipt_number || 'PENDING'}`,
          Author: 'Shree Akhil Bharatiya Kutch Kadwa Patidar Satsang Samaj',
        },
      });

      registerGujaratiFonts(doc);

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
            size: [1024, 666],
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
