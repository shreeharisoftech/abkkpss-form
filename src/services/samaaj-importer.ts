import { AcMysqlDao, AcSqlConnection } from 'ac-sql';
import { DbService, MySqlDbConfig } from '../database/db-service';
import { FormRow, MemberRow, FormStatus } from '../database/schema';
import { determineIsAdult18Plus } from './fee-calculator';
import { envConfig } from '../config/env';

/**
 * Gujarati numeral to ASCII digit converter
 */
export function convertGujaratiDigits(str?: string | null): string {
  if (!str) return '';
  const gujDigits = ['૦', '૧', '૨', '૩', '૪', '૫', '૬', '૭', '૮', '૯'];
  let result = String(str);
  gujDigits.forEach((char, digit) => {
    result = result.split(char).join(String(digit));
  });
  return result.trim();
}

/**
 * Clean and sanitize text to ensure valid English output (strip Gujarati scripts)
 */
export function sanitizeEnglishText(text?: string | null): string {
  if (!text) return '';
  let sanitized = convertGujaratiDigits(text);
  // Remove Gujarati script characters (\u0A80-\u0AFF)
  sanitized = sanitized.replace(/[\u0A80-\u0AFF]/g, ' ').replace(/\s+/g, ' ').trim();
  return sanitized;
}

/**
 * Gujarati-to-English Relationship Translation Dictionary
 */
export const GUJARATI_RELATION_MAP: Record<string, string> = {
  'પોતે': 'Self',
  'પત્ની': 'Wife',
  'પુત્ર': 'Son',
  'પુત્રી': 'Daughter',
  'પુત્રવધુ': 'Daughter-in-law',
  'પૌત્ર': 'Grandson',
  'પૌત્રી': 'Granddaughter',
  'મા': 'Mother',
  'માતા': 'Mother',
  'પિતા': 'Father',
  'ભાઇ': 'Brother',
  'ભાઈ': 'Brother',
  'ભાઇપત્ની': 'Sister-in-law',
  'ભાભી': 'Sister-in-law',
  'ભાઇપુત્ર': 'Nephew',
  'ભત્રીજો': 'Nephew',
  'ભાઇપુત્રી': 'Niece',
  'ભત્રીજી': 'Niece',
  'પૌત્રવધુ': 'Granddaughter-in-law',
  'પડપૌત્રી': 'Great Granddaughter',
  'પ્રપૌત્રી': 'Great Granddaughter',
  'પડપૌત્ર': 'Great Grandson',
  'પ્રપૌત્ર': 'Great Grandson',
  'દોઇત્રી': 'Maternal Granddaughter',
  'દોઇત્રો': 'Maternal Grandson',
  'દાદી': 'Grandmother',
  'દાદા': 'Grandfather',
  'બહેન': 'Sister',
  'બેન': 'Sister',
  'સસરા': 'Father-in-law',
  'સાસુ': 'Mother-in-law',
  'ભત્રીજાવધુ': 'Niece-in-law',
  'ભાઇપૌત્રી': 'Great Niece',
  'કાકા': 'Uncle',
  'કાકી': 'Aunt',
  'મામા': 'Maternal Uncle',
  'મામી': 'Maternal Aunt',
  'માસી': 'Maternal Aunt',
  'માસા': 'Maternal Uncle',
  'જમાઈ': 'Son-in-law',
  'જમાઇ': 'Son-in-law',
};

/**
 * Translates Gujarati relationship term to English
 */
export function translateRelation(rawRelation?: string | null, isMainMember: boolean = false): string {
  if (!rawRelation || !rawRelation.trim()) {
    return isMainMember ? 'Self' : 'Family Member';
  }
  const trimmed = rawRelation.trim();
  if (GUJARATI_RELATION_MAP[trimmed]) {
    return GUJARATI_RELATION_MAP[trimmed];
  }
  // Check lowercase / partial matches
  for (const [guj, eng] of Object.entries(GUJARATI_RELATION_MAP)) {
    if (trimmed.includes(guj)) {
      return eng;
    }
  }

  // If already standard English relation, keep it
  const englishStandard: Record<string, string> = {
    self: 'Self',
    wife: 'Wife',
    husband: 'Husband',
    son: 'Son',
    daughter: 'Daughter',
    father: 'Father',
    mother: 'Mother',
    brother: 'Brother',
    sister: 'Sister',
    'daughter-in-law': 'Daughter-in-law',
    'son-in-law': 'Son-in-law',
    grandson: 'Grandson',
    granddaughter: 'Granddaughter',
    nephew: 'Nephew',
    niece: 'Niece',
    uncle: 'Uncle',
    aunt: 'Aunt',
    other: 'Other',
  };
  const lower = trimmed.toLowerCase();
  if (englishStandard[lower]) return englishStandard[lower];

  const sanitized = sanitizeEnglishText(trimmed);
  return sanitized || (isMainMember ? 'Self' : 'Family Member');
}

/**
 * Common Kutch native place to Taluka lookup
 */
export const NATIVE_TALUKA_MAP: Record<string, string> = {
  ravapar: 'Nakhatrana',
  dayapar: 'Lakhpat',
  ghadani: 'Nakhatrana',
  dolatpar: 'Lakhpat',
  netra: 'Nakhatrana',
  amara: 'Nakhatrana',
  haripar: 'Bhuj',
  kapaya: 'Mundra',
  ratnal: 'Anjar',
  madhapar: 'Bhuj',
  mandvi: 'Mandvi',
  nakhatrana: 'Nakhatrana',
  bhuj: 'Bhuj',
  anjar: 'Anjar',
  mundra: 'Mundra',
  gandhidham: 'Gandhidham',
  kothara: 'Abdasa',
  naliya: 'Abdasa',
  tera: 'Abdasa',
  manjal: 'Nakhatrana',
  kotda: 'Nakhatrana',
  dahisara: 'Bhuj',
  sukhpar: 'Bhuj',
  baladia: 'Bhuj',
  kera: 'Bhuj',
  mankuva: 'Bhuj',
  samatra: 'Bhuj',
  kukma: 'Bhuj',
  mirzapar: 'Bhuj',
  naranpar: 'Bhuj',
  deshalpar: 'Nakhatrana',
  rohha: 'Nakhatrana',
  vithon: 'Nakhatrana',
  beraja: 'Mundra',
  baroi: 'Mundra',
  bhadreshwar: 'Mundra',
  gadhsisa: 'Mandvi',
  koday: 'Mandvi',
  bidada: 'Mandvi',
  maska: 'Mandvi',
  nagalpar: 'Anjar',
  varsamedi: 'Anjar',
  shinay: 'Gandhidham',
  adipur: 'Gandhidham',
  rapar: 'Rapar',
  bhachau: 'Bhachau',
};

/**
 * Derive taluka and district from native place
 */
export function deriveTalukaAndDistrict(nativePlace?: string | null): { taluka: string; district: string } {
  if (!nativePlace) {
    return { taluka: 'Nakhatrana', district: 'Kutch' };
  }
  const clean = sanitizeEnglishText(nativePlace).toLowerCase();
  for (const [village, taluka] of Object.entries(NATIVE_TALUKA_MAP)) {
    if (clean.includes(village)) {
      return { taluka, district: 'Kutch' };
    }
  }
  return { taluka: 'Nakhatrana', district: 'Kutch' };
}

/**
 * Mobile number sanitizer and standardizer (+91 XXXXXXXXXX)
 */
export function normalizeMobileNumber(raw?: string | null): string {
  if (!raw) return '';
  const converted = convertGujaratiDigits(raw);
  let digits = converted.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) {
    digits = digits.substring(2);
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.substring(1);
  }
  if (digits.length === 10 && !digits.startsWith('00000')) {
    return `+91 ${digits}`;
  }
  return '';
}

/**
 * Standardize blood group string
 */
export function normalizeBloodGroup(raw?: string | null): string {
  if (!raw) return '';
  const trimmed = raw.trim().toUpperCase();
  const validGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  if (validGroups.includes(trimmed)) return trimmed;
  // Common variants
  if (trimmed === 'A POSITIVE' || trimmed === 'A POS') return 'A+';
  if (trimmed === 'B POSITIVE' || trimmed === 'B POS') return 'B+';
  if (trimmed === 'O POSITIVE' || trimmed === 'O POS') return 'O+';
  if (trimmed === 'AB POSITIVE' || trimmed === 'AB POS') return 'AB+';
  if (trimmed === 'A NEGATIVE' || trimmed === 'A NEG') return 'A-';
  if (trimmed === 'B NEGATIVE' || trimmed === 'B NEG') return 'B-';
  if (trimmed === 'O NEGATIVE' || trimmed === 'O NEG') return 'O-';
  if (trimmed === 'AB NEGATIVE' || trimmed === 'AB NEG') return 'AB-';
  return '';
}

export interface SamaajSourceConfig {
  hostname?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
}

export interface MappedFamilyData {
  form: FormRow;
  members: Omit<MemberRow, 'form_id'>[];
}

export interface ImportPreviewResult {
  totalFamilies: number;
  totalMembers: number;
  zonesSummary: Record<string, { zoneName: string; familyCount: number; memberCount: number }>;
  totalEstimatedAdults: number;
  totalEstimatedFee: number;
  sampleFamilies: MappedFamilyData[];
}

export interface ImportExecutionResult {
  success: boolean;
  totalSourceFamilies: number;
  importedFamilies: number;
  importedMembers: number;
  skippedFamilies: number;
  durationMs: number;
  errors: string[];
}

export class SamaajImporter {
  private sourceConfig: SamaajSourceConfig;
  private targetDb: DbService;

  constructor(sourceConfig?: SamaajSourceConfig, targetDb?: DbService) {
    this.sourceConfig = {
      hostname: sourceConfig?.hostname || '127.0.0.1',
      port: sourceConfig?.port || 3306,
      username: sourceConfig?.username || 'root',
      password: sourceConfig?.password !== undefined ? sourceConfig.password : '',
      database: sourceConfig?.database || 'samaaj_db',
    };
    this.targetDb = targetDb || DbService.getInstance();
  }

  /**
   * Loads all relational tables from samaaj_db in parallel and groups by family in memory.
   */
  private async loadAndMapSourceData(): Promise<MappedFamilyData[]> {
    const dao = new AcMysqlDao();
    const conn = new AcSqlConnection();
    conn.hostname = this.sourceConfig.hostname!;
    conn.port = this.sourceConfig.port!;
    conn.username = this.sourceConfig.username!;
    conn.password = this.sourceConfig.password!;
    conn.database = this.sourceConfig.database!;
    await dao.setSqlConnection({ sqlConnection: conn });

    const rawConn = await dao.getConnectionObject({ includeDatabase: true });

    try {
      // 1. Fetch source tables in fast bulk queries
      const [members]: any = await rawConn.query(`SELECT * FROM members ORDER BY member_id;`);
      const [communityMembers]: any = await rawConn.query(`SELECT * FROM community_members;`);
      const [communityZones]: any = await rawConn.query(`SELECT * FROM community_zones;`);
      const [addresses]: any = await rawConn.query(`SELECT * FROM addresses;`);
      const [memberAddresses]: any = await rawConn.query(`SELECT * FROM member_addresses;`);
      const [phoneNumbers]: any = await rawConn.query(`SELECT * FROM phone_numbers;`);
      const [memberPhoneNumbers]: any = await rawConn.query(`SELECT * FROM member_phone_numbers;`);
      const [memberQualifications]: any = await rawConn.query(`SELECT * FROM member_qualifications;`);
      const [businesses]: any = await rawConn.query(`SELECT * FROM businesses;`);
      const [businessAddresses]: any = await rawConn.query(`SELECT * FROM business_addresses;`);
      const [businessMembers]: any = await rawConn.query(`SELECT * FROM business_members;`);

      // 2. Build fast lookup maps
      const zoneMap = new Map<string, { code: string; name: string }>();
      communityZones.forEach((cz: any) => {
        const code = String(cz.zone_index || cz.old_zone_id || '01').padStart(2, '0');
        zoneMap.set(cz.community_zone_id, { code, name: cz.zone_name });
      });

      const addressMap = new Map<string, any>();
      addresses.forEach((a: any) => addressMap.set(a.address_id, a));

      const memberAddressMap = new Map<string, any>();
      memberAddresses.forEach((ma: any) => {
        if (ma.member_id && ma.address_id && addressMap.has(ma.address_id)) {
          memberAddressMap.set(ma.member_id, addressMap.get(ma.address_id));
        }
      });

      const phoneMap = new Map<string, string>();
      phoneNumbers.forEach((p: any) => {
        if (p.phone_number_value && p.phone_number_value !== '-') {
          phoneMap.set(p.phone_number_id, p.phone_number_value);
        }
      });

      const memberPhoneMap = new Map<string, string>();
      memberPhoneNumbers.forEach((mp: any) => {
        if (mp.member_id && mp.phone_number_id && phoneMap.has(mp.phone_number_id)) {
          memberPhoneMap.set(mp.member_id, phoneMap.get(mp.phone_number_id)!);
        }
      });

      const memberQualMap = new Map<string, string>();
      memberQualifications.forEach((mq: any) => {
        if (mq.member_id && mq.qualification_title) {
          memberQualMap.set(mq.member_id, mq.qualification_title);
        }
      });

      const memberBizMap = new Map<string, { biz: any; addr: any }>();
      const bizAddrMap = new Map<string, any>();
      businessAddresses.forEach((ba: any) => {
        if (ba.business_id && ba.address_id && addressMap.has(ba.address_id)) {
          bizAddrMap.set(ba.business_id, addressMap.get(ba.address_id));
        }
      });
      const bizLookup = new Map<string, any>();
      businesses.forEach((b: any) => bizLookup.set(b.business_id, b));
      businessMembers.forEach((bm: any) => {
        const biz = bizLookup.get(bm.business_id);
        if (biz) {
          const bizAddr = bizAddrMap.get(biz.business_id);
          memberBizMap.set(bm.member_id, { biz, addr: bizAddr });
        }
      });

      const commMemberMap = new Map<string, any>();
      communityMembers.forEach((cm: any) => {
        let detail: any = {};
        try {
          detail = JSON.parse(cm.member_detail || '{}');
        } catch {}
        commMemberMap.set(cm.member_id, { ...cm, parsedDetail: detail });
      });

      // 3. Group members by family (main_member_id)
      const familyGroups = new Map<string, any[]>();
      members.forEach((m: any) => {
        const famKey = m.main_member_id || m.member_id;
        if (!familyGroups.has(famKey)) familyGroups.set(famKey, []);
        familyGroups.get(famKey)!.push(m);
      });

      // 4. Map into target structure
      const mappedFamilies: MappedFamilyData[] = [];
      let familyIndexCounter = 0;

      for (const [famKey, memList] of familyGroups) {
        familyIndexCounter++;

        // Identify Main Member (Head of Family)
        let mainMem = memList.find((m: any) => m.member_id === famKey);
        if (!mainMem) {
          mainMem = memList.find((m: any) => m.relation_with_main_member === 'પોતે') || memList[0];
        }

        // Zone and family number resolution
        const cm = commMemberMap.get(mainMem.member_id) || memList.map((m: any) => commMemberMap.get(m.member_id)).find(Boolean);
        const zoneInfo = cm ? zoneMap.get(cm.member_zone_id) : { code: '01', name: 'Ahmedabad' };
        const zoneNumber = zoneInfo?.code || '01';

        const rawFamNum = cm?.parsedDetail?.zone_family_index || cm?.parsedDetail?.family_index || String(familyIndexCounter);
        const familyNumber = convertGujaratiDigits(String(rawFamNum)).replace(/\D/g, '') || String(familyIndexCounter);

        // Address resolution
        const addr = memberAddressMap.get(mainMem.member_id) || memList.map((m: any) => memberAddressMap.get(m.member_id)).find(Boolean);
        const addressLine1 = sanitizeEnglishText(addr?.address_line_1 || '');
        const addressLine2 = sanitizeEnglishText(addr?.address_line_2 || '');
        const cityName = sanitizeEnglishText(addr?.city_name || zoneInfo?.name || 'Ahmedabad');
        const stateName = sanitizeEnglishText(addr?.state_name || 'Gujarat');
        const countryName = sanitizeEnglishText(addr?.country_name || 'India');
        const rawPincode = convertGujaratiDigits(addr?.postal_code || '');
        const pincode = rawPincode.replace(/\D/g, '').slice(0, 6);

        const resAddressParts = [addressLine1, addressLine2];
        if (cityName && !addressLine1.toLowerCase().includes(cityName.toLowerCase()) && !addressLine2.toLowerCase().includes(cityName.toLowerCase())) {
          resAddressParts.push(cityName);
        }
        if (stateName) resAddressParts.push(stateName);
        if (countryName) resAddressParts.push(countryName);
        if (pincode) resAddressParts.push(`PIN - ${pincode}`);
        const residentialAddress = resAddressParts.filter(Boolean).join(', ');

        // Business / Firm details
        const bizData = memberBizMap.get(mainMem.member_id) || memList.map((m: any) => memberBizMap.get(m.member_id)).find(Boolean);
        const firmName = sanitizeEnglishText(bizData?.biz?.business_name || '');
        const firmAddr1 = sanitizeEnglishText(bizData?.addr?.address_line_1 || '');
        const firmAddr2 = sanitizeEnglishText(bizData?.addr?.address_line_2 || '');
        const firmCity = sanitizeEnglishText(bizData?.addr?.city_name || '');
        const firmState = sanitizeEnglishText(bizData?.addr?.state_name || (firmCity ? 'Gujarat' : ''));
        const firmCountry = sanitizeEnglishText(bizData?.addr?.country_name || (firmCity ? 'India' : ''));
        const rawFirmPin = convertGujaratiDigits(bizData?.addr?.postal_code || '');
        const firmPostalCode = rawFirmPin.replace(/\D/g, '').slice(0, 6);

        const firmParts = [firmAddr1, firmAddr2];
        if (firmCity && !firmAddr1.toLowerCase().includes(firmCity.toLowerCase()) && !firmAddr2.toLowerCase().includes(firmCity.toLowerCase())) {
          firmParts.push(firmCity);
        }
        if (firmState) firmParts.push(firmState);
        if (firmCountry) firmParts.push(firmCountry);
        if (firmPostalCode) firmParts.push(`PIN - ${firmPostalCode}`);
        const firmAddress = firmParts.filter(Boolean).join(', ');

        // Native place, gotra, surname
        const nativePlace = sanitizeEnglishText(mainMem.member_native || memList.map((m: any) => m.member_native).find(Boolean) || '');
        const surname = sanitizeEnglishText(mainMem.member_lname || memList.map((m: any) => m.member_lname).find(Boolean) || '');
        const gotra = sanitizeEnglishText(mainMem.member_gotra || memList.map((m: any) => m.member_gotra).find(Boolean) || '');

        const { taluka, district } = deriveTalukaAndDistrict(nativePlace);

        // Main member phone
        const mainMobileRaw = memberPhoneMap.get(mainMem.member_id) || memList.map((m: any) => memberPhoneMap.get(m.member_id)).find(Boolean);
        const mainMobile = normalizeMobileNumber(mainMobileRaw) || '+91 9999999999';

        // Main member name
        const mainFname = sanitizeEnglishText(mainMem.member_fname || '');
        const mainMname = sanitizeEnglishText(mainMem.member_mname || '');
        const mainLname = sanitizeEnglishText(mainMem.member_lname || surname);
        const fillerName = [mainFname, mainMname, mainLname].filter(Boolean).join(' ') || 'Main Member';

        // Map members array: main member first
        const sortedMemList = [
          mainMem,
          ...memList.filter((m: any) => m.member_id !== mainMem.member_id),
        ];

        let adultsCount = 0;
        const mappedMembers: Omit<MemberRow, 'form_id'>[] = [];

        sortedMemList.forEach((m: any, idx: number) => {
          const isMain = idx === 0;
          const fName = sanitizeEnglishText(m.member_fname || '');
          const mName = sanitizeEnglishText(m.member_mname || '');
          const lName = sanitizeEnglishText(m.member_lname || surname);
          const fullName = [fName, mName, lName].filter(Boolean).join(' ');

          // DOB formatting (YYYY-MM-DD)
          let dobStr = '';
          if (m.date_of_birth) {
            try {
              const d = new Date(m.date_of_birth);
              if (!isNaN(d.getTime()) && d.getFullYear() > 1900) {
                dobStr = d.toISOString().split('T')[0];
              }
            } catch {}
          }

          // Relation translation
          const relation = translateRelation(m.relation_with_main_member, isMain);

          // Adult 18+ calculation:
          // Check DOB first with cutoff 31-12-2026.
          // If DOB not available, infer from relation (e.g. Self, Wife, Father are adults).
          let isAdult = false;
          if (dobStr) {
            isAdult = determineIsAdult18Plus(dobStr);
          } else {
            const adultRelations = ['Self', 'Wife', 'Husband', 'Father', 'Mother', 'Father-in-law', 'Mother-in-law', 'Grandfather', 'Grandmother', 'Uncle', 'Aunt', 'Brother', 'Sister'];
            isAdult = isMain || adultRelations.includes(relation);
          }

          if (isAdult) adultsCount++;

          const mPhoneRaw = memberPhoneMap.get(m.member_id);
          const mMobile = normalizeMobileNumber(mPhoneRaw);

          const qual = sanitizeEnglishText(memberQualMap.get(m.member_id) || '');
          const bloodGroup = normalizeBloodGroup(m.blood_group);
          const gender = m.member_gender === 'F' ? 'F' : 'M';

          mappedMembers.push({
            serial_no: idx + 1,
            first_name: fName,
            middle_name: mName,
            last_name: lName,
            name: fullName,
            dob: dobStr || (isAdult ? '1985-01-01' : '2015-01-01'),
            is_adult_18_plus: isAdult ? 1 : 0,
            gender,
            relation,
            education: qual,
            mobile_number: isMain ? mainMobile : mMobile,
            blood_group: bloodGroup,
            is_main_member: isMain ? 1 : 0,
            fixed_member_number: null,
            unique_member_seq: null,
          });
        });

        // Form Row
        const totalAmount = adultsCount * 500;
        const formRow: FormRow = {
          zone_number: zoneNumber,
          family_number: familyNumber,
          address_line_1: addressLine1,
          address_line_2: addressLine2,
          city_name: cityName,
          state_name: stateName,
          country_name: countryName,
          pincode: pincode,
          current_city_or_place: cityName,
          residential_address: residentialAddress,

          firm_name: firmName,
          firm_address_line_1: firmAddr1,
          firm_address_line_2: firmAddr2,
          firm_city_name: firmCity,
          firm_state_name: firmState,
          firm_country_name: firmCountry,
          firm_postal_code: firmPostalCode,
          firm_address: firmAddress,

          native_place: nativePlace,
          surname: surname,
          gotra: gotra,
          taluka: taluka,
          district: district,

          filler_name: fillerName,
          filler_mobile: mainMobile,
          total_adults_count: adultsCount,
          total_amount: totalAmount,
          payment_mode: 'Cash',
          status: FormStatus.PENDING, // UNAPPROVED BY DEFAULT
          receipt_number: null,
          approved_by: null,
          created_by: 1, // Super Admin
          created_at: new Date().toISOString(),
        };

        mappedFamilies.push({
          form: formRow,
          members: mappedMembers,
        });
      }

      return mappedFamilies;
    } finally {
      await rawConn.end();
    }
  }

  /**
   * Generates preview stats and sample data without writing anything.
   */
  async dryRun(): Promise<ImportPreviewResult> {
    const families = await this.loadAndMapSourceData();

    let totalMembers = 0;
    let totalEstimatedAdults = 0;
    let totalEstimatedFee = 0;
    const zonesSummary: Record<string, { zoneName: string; familyCount: number; memberCount: number }> = {};

    for (const f of families) {
      const z = f.form.zone_number;
      if (!zonesSummary[z]) {
        zonesSummary[z] = { zoneName: f.form.city_name || `Zone ${z}`, familyCount: 0, memberCount: 0 };
      }
      zonesSummary[z].familyCount++;
      zonesSummary[z].memberCount += f.members.length;

      totalMembers += f.members.length;
      totalEstimatedAdults += f.form.total_adults_count || 0;
      totalEstimatedFee += f.form.total_amount || 0;
    }

    return {
      totalFamilies: families.length,
      totalMembers,
      zonesSummary,
      totalEstimatedAdults,
      totalEstimatedFee,
      sampleFamilies: families.slice(0, 5),
    };
  }

  /**
   * Imports all or limited families into abkkpss_forms_db.
   * Ensures all imported forms have status = 'PENDING' (unapproved).
   */
  async importAll({
    limit,
    cleanExisting = false,
    skipExisting = false,
    onProgress,
  }: {
    limit?: number;
    cleanExisting?: boolean;
    skipExisting?: boolean;
    onProgress?: (current: number, total: number) => void;
  } = {}): Promise<ImportExecutionResult> {
    const startTime = Date.now();
    const families = await this.loadAndMapSourceData();
    const toImport = limit && limit > 0 ? families.slice(0, limit) : families;

    let importedFamilies = 0;
    let importedMembers = 0;
    let skippedFamilies = 0;
    const errors: string[] = [];

    // If cleanExisting requested, remove existing forms and members
    if (cleanExisting) {
      try {
        const rawTargetConn = await this.targetDb.dao.getConnectionObject({ includeDatabase: true });
        await rawTargetConn.execute(`DELETE FROM \`members\``);
        await rawTargetConn.execute(`DELETE FROM \`forms\``);
        await rawTargetConn.end();
      } catch (err: any) {
        errors.push(`Failed to clean existing records: ${err.message}`);
      }
    }

    let processedIdx = 0;
    for (const fam of toImport) {
      processedIdx++;
      if (onProgress && (processedIdx % 25 === 0 || processedIdx === toImport.length)) {
        onProgress(processedIdx, toImport.length);
      }
      try {
        // Check if family already exists if skipExisting is enabled
        if (skipExisting && !cleanExisting) {
          const existing = await this.targetDb.findExistingFamily(fam.form.zone_number, fam.form.family_number);
          if (existing) {
            skippedFamilies++;
            continue;
          }
        }

        // Always enforce PENDING status and null receipt
        fam.form.status = FormStatus.PENDING;
        fam.form.receipt_number = null;
        fam.form.approved_by = null;

        const result = await this.targetDb.createForm(fam.form, fam.members);
        if (result && result.formId) {
          importedFamilies++;
          importedMembers += fam.members.length;
        } else {
          errors.push(`Failed to insert family Zone ${fam.form.zone_number} / F#${fam.form.family_number}`);
        }
      } catch (err: any) {
        errors.push(`Error inserting family Zone ${fam.form.zone_number} / F#${fam.form.family_number}: ${err.message}`);
      }
    }

    return {
      success: errors.length === 0,
      totalSourceFamilies: families.length,
      importedFamilies,
      importedMembers,
      skippedFamilies,
      durationMs: Date.now() - startTime,
      errors,
    };
  }
}
