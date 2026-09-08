/**
 * Gujarati Translator & Transliteration Service
 * Converts English names, places, numbers, zones, and receipt terms to Gujarati script.
 */

// 1. Gujarati Digits Mapping
const GUJARATI_DIGIT_MAP: Record<string, string> = {
  '0': '૦',
  '1': '૧',
  '2': '૨',
  '3': '૩',
  '4': '૪',
  '5': '૫',
  '6': '૬',
  '7': '૭',
  '8': '૮',
  '9': '૯',
};

/**
 * Converts ASCII digits to Gujarati numerals
 * Example: "00001" -> "૦૦૦૦૧", "9825098250" -> "૯૮૨૫૦૯૮૨૫૦"
 */
export function toGujaratiDigits(val?: string | number | null): string {
  if (val === null || val === undefined || val === '') return '';
  return String(val).replace(/[0-9]/g, (d) => GUJARATI_DIGIT_MAP[d] || d);
}

// 2. Standard Zones in Gujarati
export const GUJARATI_ZONES: Record<string, string> = {
  '01': '૦૧ - અમદાવાદ',
  '02': '૦૨ - નડિયાદ',
  '03': '૦૩ - વડોદરા-ભરૂચ',
  '04': '૦૪ - દક્ષિણ ગુજરાત',
  '05': '૦૫ - ઉત્તર ગુજરાત',
  '06': '૦૬ - સૌરાષ્ટ્ર',
  '07': '૦૭ - મોરબી',
  '08': '૦૮ - દક્ષિણ ભારત',
  '09': '૦૯ - મહારાષ્ટ્ર',
  '10': '૧૦ - પૂર્વ કચ્છ',
  '11': '૧૧ - પશ્ચિમ કચ્છ',
};

export function toGujaratiZone(zoneVal?: string | null): string {
  if (!zoneVal) return '';
  const trimmed = zoneVal.trim();
  const code = trimmed.slice(0, 2);
  if (GUJARATI_ZONES[code]) return GUJARATI_ZONES[code];

  for (const [zCode, label] of Object.entries(GUJARATI_ZONES)) {
    if (trimmed.includes(zCode) || label.includes(trimmed)) return label;
  }
  return toGujaratiDigits(trimmed);
}

// 3. Common Surnames Dictionary
export const GUJARATI_SURNAMES: Record<string, string> = {
  'patel': 'પટેલ',
  'patidar': 'પાટીદાર',
  'pokar': 'પોકાર',
  'bhudiya': 'ભુડિયા',
  'bhootiya': 'ભૂતિયા',
  'chhabhaiya': 'છાભૈયા',
  'chheta': 'છેટા',
  'chhelavda': 'છેલવડા',
  'chotara': 'ચોટારા',
  'dholu': 'ધોળુ',
  'dholakiya': 'ધોળકિયા',
  'gorasia': 'ગોરસિયા',
  'gorasiya': 'ગોરસિયા',
  'halai': 'હાલાઈ',
  'hirani': 'હિરાણી',
  'jadavani': 'જાદવાણી',
  'jesani': 'જેસાણી',
  'kanani': 'કાનાણી',
  'kerai': 'કેરાઈ',
  'khetani': 'ખેતાણી',
  'khunt': 'ખૂંટ',
  'kotadiya': 'કોટાડિયા',
  'kurani': 'કુરાણી',
  'limbani': 'લીંબાણી',
  'mendpara': 'મેંદપરા',
  'motani': 'મોતાણી',
  'nakrani': 'નાકરાણી',
  'parasia': 'પારસિયા',
  'parasiya': 'પારસિયા',
  'pindoria': 'પિંડોરિયા',
  'pindoriya': 'પિંડોરિયા',
  'rabadiya': 'રબડિયા',
  'rabadia': 'રબડિયા',
  'raghuvani': 'રઘુવાણી',
  'raghuvanshi': 'રઘુવંશી',
  'ramani': 'રામાણી',
  'ravani': 'રાવાણી',
  'rudani': 'રૂડાણી',
  'sanghani': 'સંઘાણી',
  'senghani': 'સંઘાણી',
  'savani': 'સાવાણી',
  'siyani': 'સિયાણી',
  'surani': 'સુરાણી',
  'tarpara': 'તરપરા',
  'vaghasia': 'વાઘાસિયા',
  'vaghasiya': 'વાઘાસિયા',
  'varsani': 'વરસાણી',
  'vekaria': 'વેકરિયા',
  'vekariya': 'વેકરિયા',
};

// 4. Common Gujarati First & Middle Names & Suffixes
export const GUJARATI_NAME_PARTS: Record<string, string> = {
  // Suffixes
  'bhai': 'ભાઈ',
  'ben': 'બેન',
  'ba': 'બા',
  'kumar': 'કુમાર',
  'kumari': 'કુમારી',
  'lal': 'લાલ',
  'kant': 'કાંત',
  'prasad': 'પ્રસાદ',
  'ram': 'રામ',
  'das': 'દાસ',
  'chandra': 'ચંદ્ર',
  'devi': 'દેવી',

  // Male Names
  'jayesh': 'જયેશ',
  'pravin': 'પ્રવીણ',
  'ramesh': 'રમેશ',
  'suresh': 'સુરેશ',
  'haresh': 'હરેશ',
  'dinesh': 'દિનેશ',
  'bharat': 'ભરત',
  'hitesh': 'હિતેશ',
  'rajesh': 'રાજેશ',
  'mukesh': 'મુકેશ',
  'ashok': 'અશોક',
  'shanti': 'શાંતિ',
  'shantilal': 'શાંતિલાલ',
  'manji': 'માંજી',
  'velji': 'વેલજી',
  'shivji': 'શિવજી',
  'premji': 'પ્રેમજી',
  'karsan': 'કરશન',
  'meghji': 'મેઘજી',
  'shamji': 'શામજી',
  'devji': 'દેવજી',
  'kanji': 'કાનજી',
  'hirji': 'હીરજી',
  'ramji': 'રામજી',
  'naran': 'નારણ',
  'mavji': 'માવજી',
  'jadavji': 'જાદવજી',
  'ratilal': 'રતિલાલ',
  'mohan': 'મોહન',
  'mohanlal': 'મોહનલાલ',
  'gopal': 'ગોપાલ',
  'kishore': 'કિશોર',
  'kishor': 'કિશોર',
  'jagdish': 'જગદીશ',
  'arvind': 'અરવિંદ',
  'govind': 'ગોવિંદ',
  'harilal': 'હરિલાલ',
  'amratlal': 'અમૃતલાલ',
  'amrut': 'અમૃત',
  'babulal': 'બાબુલાલ',
  'bhagwanji': 'ભગવાનજી',
  'bhagwan': 'ભગવાન',
  'bhimji': 'ભીમજી',
  'chagan': 'છગન',
  'chaganlal': 'છગનલાલ',
  'chiman': 'ચીમન',
  'chimanlal': 'ચીમનલાલ',
  'damji': 'દામજી',
  'dayalal': 'દયાલાલ',
  'dharmendra': 'ધર્મેન્દ્ર',
  'girish': 'ગિરીશ',
  'himat': 'હિંમત',
  'himatlal': 'હિંમતલાલ',
  'ishwar': 'ઈશ્વર',
  'jayanti': 'જયંતી',
  'jayantilal': 'જયંતીલાલ',
  'jitendra': 'જીતેન્દ્ર',
  'kalyanji': 'કલ્યાણજી',
  'kamlesh': 'કમલેશ',
  'keshavji': 'કેશવજી',
  'khetshi': 'ખેતશી',
  'khimji': 'ખીમજી',
  'lalji': 'લાલજી',
  'manilal': 'મણિલાલ',
  'mansukh': 'મનસુખ',
  'mulji': 'મૂળજી',
  'nanji': 'નાનજી',
  'naresh': 'નરેશ',
  'natwar': 'નટવર',
  'natwarlal': 'નટવરલાલ',
  'navin': 'નવીન',
  'nilesh': 'નિલેશ',
  'nitin': 'નીતિન',
  'paresh': 'પરેશ',
  'pankaj': 'પંકજ',
  'parbat': 'પરબત',
  'parshottam': 'પરશોત્તમ',
  'popat': 'પોપટ',
  'popatlal': 'પોપટલાલ',
  'pradeep': 'પ્રદીપ',
  'pragji': 'પ્રાગજી',
  'prashant': 'પ્રશાંત',
  'punshi': 'પૂનશી',
  'purshottam': 'પુરુષોત્તમ',
  'raghavji': 'રાઘવજી',
  'rajendra': 'રાજેન્દ્ર',
  'ravji': 'રાવજી',
  'rohit': 'રોહિત',
  'sanjay': 'સંજય',
  'siddharth': 'સિદ્ધાર્થ',
  'sudhir': 'સુધીર',
  'sunderji': 'સુંદરજી',
  'talsi': 'તળશી',
  'tarachand': 'તારાચંદ',
  'thakarshi': 'ઠાકરશી',
  'tribhovan': 'ત્રિભોવન',
  'tulsi': 'તુલસી',
  'tulsidas': 'તુલસીદાસ',
  'vallabhji': 'વલ્લભજી',
  'vallabh': 'વલ્લભ',
  'vasant': 'વસંત',
  'vijay': 'વિજય',
  'vinod': 'વિનોદ',
  'vipin': 'વિપિન',
  'virji': 'વીરજી',
  'vishram': 'વિશ્રામ',
  'vithal': 'વિઠ્ઠલ',
  'vithaldas': 'વિઠ્ઠલદાસ',
  'ajay': 'અજય',
  'alpesh': 'અલ્પેશ',
  'anand': 'આનંદ',
  'anil': 'અનિલ',
  'ankit': 'અંકિત',
  'ashwin': 'અશ્વિન',
  'bhavik': 'ભાવિક',
  'bhavin': 'ભાવિન',
  'chirag': 'ચિરાગ',
  'deepak': 'દીપક',
  'dipak': 'દીપક',
  'dharmesh': 'ધર્મેશ',
  'dhruv': 'ધ્રુવ',
  'hardik': 'હાર્દિક',
  'harsh': 'હર્ષ',
  'ketan': 'કેતન',
  'manish': 'મનીષ',
  'mayur': 'મયૂર',
  'mehul': 'મેહુલ',
  'mitesh': 'મિતેશ',
  'piyush': 'પિયુષ',
  'pratik': 'પ્રતિક',
  'priyesh': 'પ્રિયેશ',
  'rahul': 'રાહુલ',
  'ronak': 'રોનક',
  'sachin': 'સચિન',
  'sandip': 'સંદીપ',
  'sandeep': 'સંદીપ',
  'shailesh': 'શૈલેષ',
  'sunil': 'સુનિલ',
  'tushar': 'તુષાર',
  'vipul': 'વિપુલ',
  'vishal': 'વિશાલ',
  'yash': 'યશ',

  // Female Names
  'rekha': 'રેખા',
  'diya': 'દિયા',
  'daya': 'દયા',
  'bhavna': 'ભાવના',
  'geeta': 'ગીતા',
  'gita': 'ગીતા',
  'sita': 'સીતા',
  'sharda': 'શારદા',
  'manju': 'મંજુ',
  'ganga': 'ગંગા',
  'jamna': 'જમના',
  'laxmi': 'લક્ષ્મી',
  'parvati': 'પાર્વતી',
  'santok': 'સંતોક',
  'puri': 'પૂરી',
  'vali': 'વાલી',
  'monghi': 'મોંઘી',
  'hansa': 'હંસા',
  'manjula': 'મંજુલા',
  'kailas': 'કૈલાસ',
  'anita': 'અનિતા',
  'anjali': 'અંજલિ',
  'arti': 'આરતી',
  'aarti': 'આરતી',
  'asha': 'આશા',
  'bhanu': 'ભાનુ',
  'bhanumati': 'ભાનુમતી',
  'bharati': 'ભારતી',
  'chetna': 'ચેતના',
  'daksha': 'દક્ષા',
  'damayanti': 'દમયંતી',
  'dimple': 'ડિમ્પલ',
  'divya': 'દિવ્યા',
  'diwali': 'દિવાળી',
  'gauri': 'ગૌરી',
  'hetal': 'હેતલ',
  'ila': 'ઈલા',
  'indira': 'ઈન્દિરા',
  'jashoda': 'જશોદા',
  'jaya': 'જયા',
  'jayshree': 'જયશ્રી',
  'jyoti': 'જ્યોતિ',
  'kamla': 'કમલા',
  'kanchan': 'કાંચન',
  'kanta': 'કાંતા',
  'kastur': 'કસ્તૂર',
  'kinjal': 'કિંજલ',
  'kiran': 'કિરણ',
  'kokila': 'કોકિલા',
  'kusum': 'કુસુમ',
  'kushum': 'કુસુમ',
  'lalita': 'લલિતા',
  'leela': 'લીલા',
  'lila': 'લીલા',
  'madhu': 'મધુ',
  'mani': 'મણી',
  'meena': 'મીના',
  'mina': 'મીના',
  'mona': 'મોના',
  'naina': 'નયના',
  'neeta': 'નીતા',
  'nisha': 'નિશા',
  'padma': 'પદ્મા',
  'pooja': 'પૂજા',
  'priti': 'પ્રીતિ',
  'pushpa': 'પુષ્પા',
  'radha': 'રાધા',
  'ramila': 'રમીલા',
  'rupa': 'રૂપા',
  'saroj': 'સરોજ',
  'seema': 'સીમા',
  'shilpa': 'શિલ્પા',
  'shobha': 'શોભા',
  'sneha': 'સ્નેહા',
  'sonal': 'સોનલ',
  'sudha': 'સુધા',
  'sumitra': 'સુમિત્રા',
  'sunita': 'સુનીતા',
  'tara': 'તારા',
  'usha': 'ઉષા',
  'varsha': 'વર્ષા',
  'kavita': 'કવિતા',
  'priya': 'પ્રિયા',
  'neha': 'નેહા',
  'poornima': 'પૂર્ણિમા',
  'purnima': 'પૂર્ણિમા',
  'swati': 'સ્વાતી',
  'payal': 'પાયલ',
  'riddhi': 'રિદ્ધિ',
  'siddhi': 'સિદ્ધિ',
};

// 5. Common Kutch / Gujarat Villages & Native Places
export const GUJARATI_VILLAGES: Record<string, string> = {
  'dahisara': 'દહીસરા',
  'kera': 'કેરા',
  'baladia': 'બળદિયા',
  'madhapar': 'માધાપર',
  'bhuj': 'ભુજ',
  'mandvi': 'માંડવી',
  'anjar': 'અંજાર',
  'gandhidham': 'ગાંધીધામ',
  'nakhatrana': 'નખત્રાણા',
  'sukhpar': 'સુખપર',
  'mankuva': 'માનકુવા',
  'samatra': 'સમાત્રા',
  'mirzapar': 'મિર્ઝાપર',
  'bharasar': 'ભારાસર',
  'fotdi': 'ફોટડી',
  'vandhay': 'વંધાય',
  'godhra': 'ગોધરા',
  'naranpar': 'નારણપર',
  'meghpar': 'મેઘપર',
  'deshalpar': 'દેશલપર',
  'rayan': 'રાયણ',
  'shirva': 'શિરવા',
  'asambia': 'અસંબિયા',
  'asambiya': 'અસંબિયા',
  'bidada': 'બિદડા',
  'ratnal': 'રતનાલ',
  'sinugra': 'સીણુંગરા',
  'vidi': 'વીડી',
  'kotda': 'કોટડા',
  'rampar': 'રામપર',
  'virani': 'વિરાણી',
  'kundrodi': 'કુંદરોડી',
  'kodki': 'કોડકી',
  'dharampur': 'ધરમપુર',
  'nagalpar': 'નાગલપર',
  'varnora': 'વરનોરા',
  'surajpar': 'સૂરજપર',
  'bhadreshwar': 'ભદ્રેશ્વર',
  'mundra': 'મુંદ્રા',
  'rapar': 'રાપર',
  'bhachau': 'ભચાઉ',
  'kutch': 'કચ્છ',
  'saurashtra': 'સૌરાષ્ટ્ર',
  'gujarat': 'ગુજરાત',
  'ahmedabad': 'અમદાવાદ',
  'surat': 'સુરત',
  'vadodara': 'વડોદરા',
  'rajkot': 'રાજકોટ',
  'mumbai': 'મુંબઈ',
  'pune': 'પુણે',
};

/**
 * Phonetic English-to-Gujarati transliterator fallback
 */
function phoneticTransliterate(input: string): string {
  if (!input) return '';
  if (/[\u0A80-\u0AFF]/.test(input)) return input; // Already Gujarati

  const s = input.toLowerCase();

  const VOWELS: Record<string, string> = {
    'aa': 'આ',
    'a': 'અ',
    'ee': 'ઈ',
    'i': 'ઇ',
    'oo': 'ઊ',
    'u': 'ઉ',
    'e': 'એ',
    'ai': 'ઐ',
    'o': 'ઓ',
    'au': 'ઔ',
  };

  const MATRAS: Record<string, string> = {
    'aa': 'ા',
    'ee': 'ી',
    'oo': 'ૂ',
    'ai': 'ૈ',
    'au': 'ૌ',
    'a': '',
    'i': 'િ',
    'u': 'ુ',
    'e': 'ે',
    'o': 'ો',
  };

  const CONSONANTS: Array<[string, string]> = [
    ['ksh', 'ક્ષ'],
    ['gny', 'જ્ઞ'],
    ['gn', 'જ્ઞ'],
    ['gy', 'જ્ઞ'],
    ['chh', 'છ'],
    ['kh', 'ખ'],
    ['gh', 'ઘ'],
    ['ch', 'ચ'],
    ['jh', 'ઝ'],
    ['th', 'થ'],
    ['dh', 'ધ'],
    ['bh', 'ભ'],
    ['ph', 'ફ'],
    ['sh', 'શ'],
    ['k', 'ક'],
    ['g', 'ગ'],
    ['j', 'જ'],
    ['z', 'ઝ'],
    ['t', 'ત'],
    ['d', 'દ'],
    ['n', 'ન'],
    ['p', 'પ'],
    ['f', 'ફ'],
    ['b', 'બ'],
    ['m', 'મ'],
    ['y', 'ય'],
    ['r', 'ર'],
    ['l', 'લ'],
    ['v', 'વ'],
    ['w', 'વ'],
    ['s', 'સ'],
    ['h', 'હ'],
  ];

  let res = '';
  let i = 0;

  while (i < s.length) {
    // Check consonants first
    let matchC = '';
    let cLen = 0;
    for (const [latin, guj] of CONSONANTS) {
      if (s.startsWith(latin, i)) {
        matchC = guj;
        cLen = latin.length;
        break;
      }
    }

    if (matchC) {
      i += cLen;
      // Check following vowel
      let matchV: string | null = null;
      let vLen = 0;
      for (const v of ['aa', 'ai', 'au', 'ee', 'oo', 'a', 'i', 'u', 'e', 'o']) {
        if (s.startsWith(v, i)) {
          // If 'a' is at the very end of word, treat as 'ા' matra (e.g. Rekha, Diya, Kavita)
          if (v === 'a' && (i + 1 >= s.length || s[i + 1] === ' ')) {
            matchV = 'ા';
          } else {
            matchV = MATRAS[v];
          }
          vLen = v.length;
          break;
        }
      }

      if (matchV !== null) {
        res += matchC + matchV;
        i += vLen;
      } else {
        // No vowel immediately following
        if (i < s.length && s[i] !== ' ') {
          res += matchC + '્'; // conjunct halant
        } else {
          res += matchC;
        }
      }
    } else {
      // Independent initial vowel
      let matchV = '';
      let vLen = 0;
      for (const v of ['aa', 'ai', 'au', 'ee', 'oo', 'a', 'i', 'u', 'e', 'o']) {
        if (s.startsWith(v, i)) {
          matchV = VOWELS[v];
          vLen = v.length;
          break;
        }
      }

      if (matchV) {
        res += matchV;
        i += vLen;
      } else {
        res += s[i];
        i++;
      }
    }
  }

  return res;
}

/**
 * Translates a single name word (or compound name like Jayeshbhai) into Gujarati
 */
export function transliterateNameWord(word: string): string {
  if (!word) return '';
  if (/[\u0A80-\u0AFF]/.test(word)) return word; // already Gujarati

  const lower = word.toLowerCase().trim();

  // 1. Direct match in surnames
  if (GUJARATI_SURNAMES[lower]) return GUJARATI_SURNAMES[lower];

  // 2. Direct match in name parts
  if (GUJARATI_NAME_PARTS[lower]) return GUJARATI_NAME_PARTS[lower];

  // 3. Compound check: e.g. Jayeshbhai -> Jayesh + bhai, Rekhaben -> Rekha + ben
  const compoundSuffixes = ['bhai', 'ben', 'kumar', 'kumari', 'lal', 'kant', 'ba', 'prasad', 'das', 'devi', 'ram'];
  for (const suf of compoundSuffixes) {
    if (lower.endsWith(suf) && lower.length > suf.length) {
      const base = lower.slice(0, -suf.length);
      const baseGuj = GUJARATI_NAME_PARTS[base] || GUJARATI_SURNAMES[base] || phoneticTransliterate(base);
      const sufGuj = GUJARATI_NAME_PARTS[suf] || suf;
      return baseGuj + sufGuj;
    }
  }

  // 4. Fallback to phonetic transliterator
  return phoneticTransliterate(word);
}

/**
 * Translates a complete full name (e.g. "Jayeshbhai Pravinbhai Patel") into Gujarati
 */
export function toGujaratiName(fullName?: string | null): string {
  if (!fullName) return '';
  const trimmed = fullName.trim();
  if (!trimmed) return '';
  if (/[\u0A80-\u0AFF]/.test(trimmed)) return trimmed; // already Gujarati

  const words = trimmed.split(/\s+/);
  return words.map((w) => transliterateNameWord(w)).join(' ');
}

/**
 * Translates a native village or place name to Gujarati
 */
export function toGujaratiPlace(place?: string | null): string {
  if (!place) return '-';
  const trimmed = place.trim();
  if (!trimmed || trimmed === '-') return '-';
  if (/[\u0A80-\u0AFF]/.test(trimmed)) return trimmed;

  const lower = trimmed.toLowerCase();
  if (GUJARATI_VILLAGES[lower]) return GUJARATI_VILLAGES[lower];

  // Check if multiple words (e.g. "Dahisara Kutch")
  const parts = trimmed.split(/\s+/);
  return parts
    .map((p) => {
      const pLower = p.toLowerCase();
      return GUJARATI_VILLAGES[pLower] || transliterateNameWord(p);
    })
    .join(' ');
}

/**
 * Returns Gujarati formatted fee amount string
 */
export function toGujaratiFeeAmount(isAdult: boolean): string {
  return isAdult ? 'રૂ. ૫૦૦/- (રોકડા)' : 'રૂ. ૦/- (સગીર / આશ્રિત)';
}

/**
 * Returns Gujarati formatted mobile number
 */
export function toGujaratiMobile(mobile?: string | null): string {
  if (!mobile || mobile === '-') return '-';
  return toGujaratiDigits(mobile);
}
