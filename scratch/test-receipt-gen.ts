import fs from 'fs';
import { generateMemberReceiptPdf, generateReceiptPdf } from '../src/services/pdf-receipt';

async function main() {
  const sampleForm: any = {
    id: 1,
    zone_number: '01',
    family_number: '12',
    native_place: 'Ravapar',
    filler_name: 'Patel Ramesh Kurji',
    filler_mobile: '9876543210',
    total_amount: 500,
    receipt_number: '00125',
    created_at: '2026-09-08T10:00:00Z',
  };

  const sampleMember: any = {
    id: 1,
    form_id: 1,
    serial_no: 1,
    name: 'Patel Ramesh Kurji',
    first_name: 'Ramesh',
    middle_name: 'Kurji',
    last_name: 'Patel',
    is_adult_18_plus: 1,
    mobile_number: '9876543210',
    unique_member_seq: 125,
    fixed_member_number: '01/12/01-00125',
  };

  const memberPdf = await generateMemberReceiptPdf({
    form: sampleForm,
    member: sampleMember,
    approvalDate: '08/09/2026',
  });

  fs.writeFileSync('scratch/final-member-receipt.pdf', memberPdf);
  console.log('Successfully generated scratch/final-member-receipt.pdf! Size:', memberPdf.length);

  const familyPdf = await generateReceiptPdf({
    form: sampleForm,
    members: [sampleMember],
    approvalDate: '08/09/2026',
  });

  fs.writeFileSync('scratch/final-family-receipt.pdf', familyPdf);
  console.log('Successfully generated scratch/final-family-receipt.pdf! Size:', familyPdf.length);
}

main().catch((err) => {
  console.error('Error running test:', err);
  process.exit(1);
});
