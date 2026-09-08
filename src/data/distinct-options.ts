export interface ZoneOption {
  code: string;
  name: string;
  label: string;
}

export const STANDARD_ZONES: ZoneOption[] = [
  { code: '01', name: 'Ahmedabad', label: '01 - Ahmedabad' },
  { code: '02', name: 'Nadiad', label: '02 - Nadiad' },
  { code: '03', name: 'Vadodara-Bharuch', label: '03 - Vadodara-Bharuch' },
  { code: '04', name: 'South Gujarat', label: '04 - South Gujarat' },
  { code: '05', name: 'North Gujarat', label: '05 - North Gujarat' },
  { code: '06', name: 'Saurashtra', label: '06 - Saurashtra' },
  { code: '07', name: 'Indore', label: '07 - Indore' },
  { code: '08', name: 'South India', label: '08 - South India' },
  { code: '09', name: 'Maharastra', label: '09 - Maharastra' },
  { code: '10', name: 'East Kutch', label: '10 - East Kutch' },
  { code: '11', name: 'West Kutch', label: '11 - West Kutch' },
];

export function getZoneLabel(val?: string | null): string {
  if (!val) return '';
  const trimmed = val.trim();
  const code = trimmed.slice(0, 2);
  const found = STANDARD_ZONES.find((z) => z.code === code || z.code === trimmed || z.label === trimmed);
  return found ? found.label : trimmed;
}

export function getZoneCode(val?: string | null): string {
  if (!val) return '01';
  const trimmed = val.trim();
  const found = STANDARD_ZONES.find((z) => z.code === trimmed || z.label === trimmed);
  return found ? found.code : trimmed.slice(0, 2);
}

export const STANDARD_DISTINCT_OPTIONS = {
  zones: STANDARD_ZONES,
  blood_groups: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],

  surnames: [
    'Patel',
    'Bhudiya',
    'Chhabhaiya',
    'Dholu',
    'Gorasiya',
    'Halai',
    'Hirani',
    'Jadavani',
    'Kerai',
    'Khunt',
    'Limbani',
    'Mendpara',
    'Nakrani',
    'Parasiya',
    'Pindoriya',
    'Pokar',
    'Raghuvani',
    'Ramani',
    'Ravani',
    'Rudani',
    'Sankhala',
    'Senghani',
    'Shiyani',
    'Vaghani',
    'Varsani',
    'Vekaria',
    'Vishrani',
  ],

  gotras: [
    'Kashyap',
    'Gautam',
    'Vashishta',
    'Bharadwaj',
    'Atri',
    'Vishwamitra',
    'Jamadagni',
    'Agastya',
    'Parashara',
    'Shandilya',
    'Garg',
    'Harita',
    'Angiras',
    'Bhrigu',
    'Kaushik',
    'Vatsa',
  ],

  native_places: [
    'Kutch',
    'Saurashtra',
    'Gujarat',
  ],

  states: [
    'Gujarat',
    'Maharashtra',
    'Karnataka',
    'Tamil Nadu',
    'Rajasthan',
    'Madhya Pradesh',
    'Delhi',
    'Andhra Pradesh',
    'Telangana',
    'West Bengal',
    'Punjab',
    'Haryana',
    'Kerala',
    'Uttar Pradesh',
    'Goa',
    'Other',
  ],

  countries: [
    'India',
    'Kenya',
    'Uganda',
    'Tanzania',
    'United Kingdom',
    'United States',
    'Canada',
    'Australia',
    'New Zealand',
    'UAE',
    'Oman',
    'Other',
  ],

  talukas: [
    'Bhuj',
    'Mandvi',
    'Mundra',
    'Anjar',
    'Gandhidham',
    'Nakhatrana',
    'Abdasa',
    'Lakhpat',
    'Rapar',
    'Bhachau',
  ],

  districts: [
    'Kutch',
    'Ahmedabad',
    'Surat',
    'Rajkot',
    'Vadodara',
    'Gandhinagar',
    'Jamnagar',
    'Bhavnagar',
    'Junagadh',
    'Navsari',
    'Valsad',
    'Mumbai',
    'Thane',
    'Pune',
  ],

  current_cities: [
    'Ahmedabad',
    'Bhuj',
    'Gandhidham',
    'Surat',
    'Mumbai',
    'Vadodara',
    'Rajkot',
    'Pune',
    'Mandvi',
    'Anjar',
    'Nakhatrana',
    'Mundra',
    'Bangalore',
    'Hyderabad',
    'Nairobi',
    'London',
  ],

  pincodes: [
    '370001',
    '370020',
    '370201',
    '370110',
    '370465',
    '370421',
    '370615',
    '380015',
    '380054',
    '395006',
    '400001',
    '400067',
  ],

  relations: [
    'Self',
    'Wife',
    'Husband',
    'Son',
    'Daughter',
    'Father',
    'Mother',
    'Brother',
    'Sister',
    'Daughter-in-law',
    'Son-in-law',
    'Grandson',
    'Granddaughter',
    'Nephew',
    'Niece',
    'Uncle',
    'Aunt',
    'Other',
  ],

  educations: [
    'Primary (1-5)',
    'Middle School (6-8)',
    'Secondary (SSC / 10th)',
    'Higher Secondary (HSC / 12th)',
    'Diploma',
    'Graduate (B.Com / B.A / B.Sc)',
    'Post Graduate (M.Com / M.A / M.Sc)',
    'Engineering (B.E / B.Tech)',
    'Medical (MBBS / BDS / BAMS)',
    'CA / CS / ICWA',
    'Management (BBA / MBA)',
    'Computer / IT (BCA / MCA / B.Tech CS)',
    'Law (LLB / LLM)',
    'Doctorate (Ph.D)',
    'Other',
  ],
};
