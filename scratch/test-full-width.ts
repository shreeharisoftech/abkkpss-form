import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

async function testFullWidth() {
  const templatePath = path.resolve('src/assets/receipt-template.png');

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape', // 841.89 x 595.28 points
    margin: 0,
    info: {
      Title: 'ABKKPSS Membership Receipt',
      Author: 'Shree Akhil Bharatiya Kutch Kadwa Patidar Satsang Samaj',
    },
  });

  const outPath = path.resolve('scratch/test-full-width.pdf');
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  const pageWidth = doc.page.width;   // 841.89
  const pageHeight = doc.page.height; // 595.28

  // 1. Draw base template image full-page
  doc.image(templatePath, 0, 0, { width: pageWidth, height: pageHeight });

  // 2. Cover the ENTIRE interior of the double rectangle with pure white
  // Inner rectangle is from x ~ 88 to 754, y ~ 70 to 526
  doc.rect(88, 70, 666, 456).fillColor('#ffffff').fill();

  // Color palette
  const oliveGold = '#5c6828';
  const deepOlive = '#47521e';
  const darkGold = '#84732b';
  const charcoalDark = '#222222';
  const mutedGray = '#555555';
  const softBg = '#fafbf8';
  const cardBorder = '#dbe0d0';

  const fullW = 640;
  const startX = (pageWidth - fullW) / 2; // ~100.9
  const centerX = pageWidth / 2;          // ~420.9

  // --- 1. TOP CENTER: OFFICIAL LOGO EMBLEM ---
  const logoY = 96;
  const logoR = 19;

  doc.save();
  // Outer decorative triple rings
  doc.circle(centerX, logoY, logoR + 3).lineWidth(1).strokeColor(darkGold).stroke();
  doc.circle(centerX, logoY, logoR).lineWidth(1.5).strokeColor(oliveGold).stroke();
  doc.circle(centerX, logoY, logoR - 3).lineWidth(0.5).strokeColor(darkGold).stroke();

  // Sacred Kalash & Coconut Vector Motif
  // Base pedestal
  doc.rect(centerX - 8, logoY + 8, 16, 2.5).fillColor(darkGold).fill();
  // Pot body
  doc.circle(centerX, logoY + 2, 8.5).fillColor(oliveGold).fill();
  // Pot neck/rim
  doc.rect(centerX - 6, logoY - 5, 12, 2.5).fillColor(darkGold).fill();
  // Coconut on top
  doc.polygon(
    [centerX - 5, logoY - 5],
    [centerX + 5, logoY - 5],
    [centerX, logoY - 14]
  ).fillColor(darkGold).fill();
  // Mango leaves on left & right
  doc.polygon(
    [centerX - 6, logoY - 5],
    [centerX - 13, logoY - 10],
    [centerX - 7, logoY - 8]
  ).fillColor(oliveGold).fill();
  doc.polygon(
    [centerX + 6, logoY - 5],
    [centerX + 13, logoY - 10],
    [centerX + 7, logoY - 8]
  ).fillColor(oliveGold).fill();
  doc.restore();

  // --- 2. SAMAJ NAME & CENTRAL OFFICE ---
  doc
    .fillColor(deepOlive)
    .fontSize(12)
    .font('Helvetica-Bold')
    .text('SHREE AKHIL BHARATIYA KUTCH KADWA PATIDAR SATSANG SAMAJ', startX, 125, {
      align: 'center',
      width: fullW,
    });

  doc
    .fillColor(mutedGray)
    .fontSize(8.5)
    .font('Helvetica')
    .text('CENTRAL ADMINISTRATIVE OFFICE', startX, 140, {
      align: 'center',
      width: fullW,
    });

  // --- 3. HEADING: LIFETIME MEMBERSHIP RECEIPT ---
  doc
    .fillColor(oliveGold)
    .fontSize(21)
    .font('Helvetica-Bold')
    .text('LIFETIME MEMBERSHIP RECEIPT', startX, 163, {
      align: 'center',
      width: fullW,
    });

  // --- 4. SUBTITLE ---
  doc
    .fillColor(mutedGray)
    .fontSize(11.5)
    .font('Helvetica')
    .text('This official membership receipt is proudly presented to', startX, 196, {
      align: 'center',
      width: fullW,
    });

  // --- 5. MEMBER NAME (Large & Prominent) ---
  const memberName = 'Narsinhbhai Meghjibhai Chavan';
  doc
    .fillColor(deepOlive)
    .fontSize(27)
    .font('Times-BoldItalic')
    .text(memberName, startX, 220, {
      align: 'center',
      width: fullW,
    });

  // Elegant underline under name
  const underlineW = Math.min(Math.max(memberName.length * 13, 280), 480);
  const underlineX = centerX - underlineW / 2;
  doc.strokeColor(oliveGold).lineWidth(1.2).moveTo(underlineX, 255).lineTo(underlineX + underlineW, 255).stroke();

  // --- 6. ACKNOWLEDGMENT PARAGRAPH ---
  doc
    .fillColor(mutedGray)
    .fontSize(10)
    .font('Helvetica')
    .text(
      'In grateful acknowledgment of the lifetime membership contribution received with sincere thanks towards Shree Akhil Bharatiya Kutch Kadwa Patidar Satsang Samaj, confirming official membership enrollment and registration.',
      startX + 40,
      270,
      {
        align: 'center',
        width: fullW - 80,
        lineGap: 3,
      }
    );

  // --- 7. FULL-WIDTH DETAILS GRID (Filling the lower portion of the receipt) ---
  const gridX = startX + 15;
  const gridY = 328;
  const gridW = fullW - 30; // 610 pt
  const gridH = 125;

  // Background panel with soft cream fill & subtle border
  doc.rect(gridX, gridY, gridW, gridH).fillColor(softBg).fill().strokeColor(cardBorder).lineWidth(1).stroke();

  // Header strip inside the panel
  doc.rect(gridX, gridY, gridW, 20).fillColor('#f2f5ec').fill().strokeColor(cardBorder).lineWidth(0.5).stroke();
  doc.fillColor(deepOlive).fontSize(8.5).font('Helvetica-Bold').text('OFFICIAL MEMBERSHIP & PAYMENT PARTICULARS', gridX + 15, gridY + 6);

  // 3-Column Layout inside the card
  const c1X = gridX + 18;
  const c2X = gridX + 220;
  const c3X = gridX + 420;
  let rY = gridY + 30;

  // Row 1
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(charcoalDark).text('RECEIPT NO:', c1X, rY);
  doc.font('Helvetica-Bold').fillColor(oliveGold).text('ABKKPSS-2026-00001', c1X + 70, rY);

  doc.font('Helvetica-Bold').fillColor(charcoalDark).text('MEMBER NO:', c2X, rY);
  doc.font('Helvetica-Bold').fillColor(oliveGold).text('01/01/01-00001', c2X + 70, rY);

  doc.font('Helvetica-Bold').fillColor(charcoalDark).text('MOBILE NO:', c3X, rY);
  doc.font('Helvetica').fillColor(charcoalDark).text('+91 9428000071', c3X + 65, rY);

  // Row 2
  rY += 21;
  doc.font('Helvetica-Bold').fillColor(charcoalDark).text('AMOUNT:', c1X, rY);
  doc.font('Helvetica-Bold').fillColor('#198754').fontSize(9).text('Rs. 500/- (Cash)', c1X + 70, rY);
  doc.fontSize(8.5);

  doc.font('Helvetica-Bold').fillColor(charcoalDark).text('ISSUE DATE:', c2X, rY);
  doc.font('Helvetica').fillColor(charcoalDark).text('07/09/2026', c2X + 70, rY);

  doc.font('Helvetica-Bold').fillColor(charcoalDark).text('STATUS:', c3X, rY);
  doc.font('Helvetica-Bold').fillColor('#198754').text('APPROVED & ACTIVE', c3X + 65, rY);

  // Row 3
  rY += 21;
  doc.font('Helvetica-Bold').fillColor(charcoalDark).text('ZONE:', c1X, rY);
  doc.font('Helvetica').fillColor(charcoalDark).text('01 - Ahmedabad', c1X + 70, rY);

  doc.font('Helvetica-Bold').fillColor(charcoalDark).text('FAMILY NO:', c2X, rY);
  doc.font('Helvetica').fillColor(charcoalDark).text('Family #1', c2X + 70, rY);

  doc.font('Helvetica-Bold').fillColor(charcoalDark).text('RELATION:', c3X, rY);
  doc.font('Helvetica').fillColor(charcoalDark).text('Self (Head of Family)', c3X + 65, rY);

  // Row 4
  rY += 21;
  doc.font('Helvetica-Bold').fillColor(charcoalDark).text('NATIVE:', c1X, rY);
  doc.font('Helvetica').fillColor(charcoalDark).text('Amara (Ta: Nakhatrana)', c1X + 70, rY);

  doc.font('Helvetica-Bold').fillColor(charcoalDark).text('DISTRICT:', c2X, rY);
  doc.font('Helvetica').fillColor(charcoalDark).text('Kutch, Gujarat', c2X + 70, rY);

  doc.font('Helvetica-Bold').fillColor(charcoalDark).text('BLOOD GROUP:', c3X, rY);
  doc.font('Helvetica').fillColor(charcoalDark).text('B+ (Adult 18+)', c3X + 80, rY);

  // --- 8. BOTTOM FOOTER ---
  const footerY = 478;
  doc.strokeColor(cardBorder).lineWidth(0.8).moveTo(startX + 80, footerY).lineTo(startX + fullW - 80, footerY).stroke();

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
      'Central Administrative Office | Registered under Society Registration Act | Valid without physical signature',
      startX,
      footerY + 20,
      {
        align: 'center',
        width: fullW,
      }
    );

  doc.end();

  await new Promise((res) => stream.on('finish', res));
  console.log('Full-width PDF generated at:', outPath, 'Size:', fs.statSync(outPath).size);
}

testFullWidth().catch(console.error);
