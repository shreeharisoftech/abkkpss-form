// ABKKPSS Form Digitization - Client Web Application
// Rendered and served via ac-runtime Web Component with CoreUI Bootstrap styling

export interface CurrentUser {
  id: number;
  username: string;
  role: 'REGULAR_USER' | 'ADMIN' | 'SUPER_ADMIN';
  zone_id?: string | null;
}

export interface MemberInput {
  serial_no: number;
  first_name: string;
  middle_name: string;
  last_name: string;
  name: string;
  dob: string;
  is_adult_18_plus: boolean;
  gender: 'M' | 'F';
  relation: string;
  education: string;
  mobile_number: string;
  blood_group: string;
  fixed_member_number?: string;
  is_main_member?: boolean;
}

export interface FormInput {
  zone_number: string;
  family_number: string;
  current_city_or_place: string;
  address_line_1: string;
  address_line_2: string;
  city_name: string;
  state_name: string;
  country_name: string;
  residential_address?: string;
  firm_name: string;
  firm_address_line_1: string;
  firm_address_line_2: string;
  firm_city_name: string;
  firm_state_name: string;
  firm_country_name: string;
  firm_postal_code: string;
  firm_address?: string;
  native_place: string;
  surname: string;
  gotra: string;
  taluka: string;
  district: string;
  pincode: string;
  filler_name: string;
  filler_mobile: string;
  payment_mode: string;
  members: MemberInput[];
}

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

export class AbkkpssAppElement extends HTMLElement {
  currentUser: CurrentUser | null = null;
  token: string | null = null;
  activeTab: 'form' | 'submissions' | 'superadmin' = 'form';

  // Submission & Edit State
  isSubmitting: boolean = false;
  editingFormId: number | null = null;
  successBannerMessage: string | null = null;
  previewReceiptUrl: string | null = null;

  getZoneLabel(val?: string | null): string {
    if (!val) return '';
    const trimmed = String(val).trim();
    const code = trimmed.slice(0, 2);
    const found = STANDARD_ZONES.find((z) => z.code === code || z.code === trimmed || z.label === trimmed);
    return found ? found.label : trimmed;
  }

  getZoneName(val?: string | null): string {
    if (!val) return '';
    const trimmed = String(val).trim();
    const code = trimmed.slice(0, 2);
    const found = STANDARD_ZONES.find((z) => z.code === code || z.code === trimmed || z.label === trimmed);
    return found ? found.name : trimmed;
  }

  // Submissions state
  submissions: any[] = [];
  submissionsFilter: 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' = 'ALL';
  submissionsSearch: string = '';
  submissionsPage: number = 1;
  submissionsPageSize: number = 10;
  submissionsTotal: number = 0;
  submissionsTotalPages: number = 1;
  isLoadingSubmissions: boolean = false;
  private searchDebounceTimer: any = null;

  // Distinct options state
  distinctOptions: Record<string, string[]> = {
    blood_groups: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    surnames: [],
    gotras: [],
    native_places: [],
    talukas: [],
    districts: [],
    current_cities: [],
    states: [],
    countries: [],
    pincodes: [],
    relations: [],
    educations: [],
  };

  // Form entry state
  formData: FormInput = this.getDefaultFormData();

  // Super Admin state
  usersList: any[] = [];
  whatsappStatus: { status: string; hasQr: boolean; isMock: boolean } = {
    status: 'DISCONNECTED',
    hasQr: false,
    isMock: false,
  };
  whatsappQrUrl: string | null = null;
  isCheckingWhatsApp: boolean = false;
  waLastCheckedText: string = '';

  // Password Modal state
  showPasswordModal: boolean = false;
  passwordModalUser: { id: number; username: string } | null = null;
  passwordModalError: string | null = null;
  passwordModalSuccess: string | null = null;
  isSavingPassword: boolean = false;
  isSelfPasswordUpdate: boolean = false;

  // Edit User Modal state
  showEditUserModal: boolean = false;
  editModalUser: { id: number; username: string; role: string; zone_id: string | null } | null = null;
  editModalError: string | null = null;
  editModalSuccess: string | null = null;
  isSavingEditUser: boolean = false;

  // Migration state
  migrationPreview: any = null;
  migrationResult: any = null;
  isLoadingMigrationPreview: boolean = false;
  isExecutingMigration: boolean = false;

  // Modal state
  selectedSubmission: any = null;
  showApprovalModal: boolean = false;

  // Background activity overlay loader state
  activeRequestsCount: number = 0;

  ensureOverlayLoader(): HTMLElement {
    let overlay = document.getElementById('abkkpss-global-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'abkkpss-global-overlay';
      overlay.className = 'global-activity-overlay';
      overlay.innerHTML = `
        <div class="activity-loader-card">
          <div class="activity-spinner-wrapper">
            <div class="spinner-border activity-spinner" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
            <i class="bi bi-hourglass-split activity-spinner-inner-icon"></i>
          </div>
          <h6 class="activity-loader-title mt-3 mb-1" id="activity-loader-title">Work in Progress</h6>
          <p class="activity-loader-message mb-0" id="activity-loader-message">Please wait while we process your request...</p>
          <div class="activity-progress-bar">
            <div class="progress-bar progress-bar-striped progress-bar-animated bg-success w-100 h-100"></div>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    }
    return overlay;
  }

  showLoading(message?: string, title?: string) {
    this.activeRequestsCount++;
    const overlay = this.ensureOverlayLoader();
    const titleEl = overlay.querySelector('#activity-loader-title');
    const msgEl = overlay.querySelector('#activity-loader-message');
    if (titleEl) titleEl.textContent = title || 'Work in Progress';
    if (msgEl) msgEl.textContent = message || 'Please wait while we process your request...';
    overlay.classList.add('active');
  }

  hideLoading(force = false) {
    if (force) {
      this.activeRequestsCount = 0;
    } else {
      this.activeRequestsCount = Math.max(0, this.activeRequestsCount - 1);
    }
    if (this.activeRequestsCount === 0) {
      const overlay = document.getElementById('abkkpss-global-overlay');
      if (overlay) {
        overlay.classList.remove('active');
      }
    }
  }

  async withLoading<T>(action: () => Promise<T>, message?: string, title?: string): Promise<T> {
    this.showLoading(message, title);
    try {
      return await action();
    } finally {
      this.hideLoading();
    }
  }

  connectedCallback() {
    this.ensureOverlayLoader();
    this.token = localStorage.getItem('abkkpss_token');
    const savedUser = localStorage.getItem('abkkpss_user');
    if (savedUser) {
      try {
        this.currentUser = JSON.parse(savedUser);
      } catch {}
    }

    this.render();
    this.loadDistinctValues();
    if (this.token) {
      this.verifyAuth();
    }
  }

  disconnectedCallback() {
    const overlay = document.getElementById('abkkpss-global-overlay');
    if (overlay) overlay.remove();
  }

  async loadDistinctValues() {
    return this.withLoading(async () => {
      try {
        const res = await fetch('/api/forms/distinct-values', {
          headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
        });
        const data = await res.json();
        if (data.success && data.values) {
          this.distinctOptions = data.values;
          this.render();
        }
      } catch (err) {
        console.warn('Could not load distinct values:', err);
      }
    }, 'Loading initial configurations...');
  }

  getDefaultFormData(): FormInput {
    const zone = this.currentUser?.zone_id || '01';
    return {
      zone_number: zone,
      family_number: '',
      current_city_or_place: '',
      address_line_1: '',
      address_line_2: '',
      city_name: '',
      state_name: 'Gujarat',
      country_name: 'India',
      residential_address: '',
      firm_name: '',
      firm_address_line_1: '',
      firm_address_line_2: '',
      firm_city_name: '',
      firm_state_name: 'Gujarat',
      firm_country_name: 'India',
      firm_postal_code: '',
      firm_address: '',
      native_place: '',
      surname: '',
      gotra: '',
      taluka: '',
      district: '',
      pincode: '',
      filler_name: '',
      filler_mobile: '',
      payment_mode: 'Cash',
      members: [
        {
          serial_no: 1,
          first_name: '',
          middle_name: '',
          last_name: '',
          name: '',
          dob: '',
          is_adult_18_plus: false,
          gender: 'M',
          relation: 'Self',
          education: '',
          mobile_number: '',
          blood_group: '',
          is_main_member: true,
        },
      ],
    };
  }

  async verifyAuth() {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      const data = await res.json();
      if (data.success && data.user) {
        this.currentUser = data.user;
        localStorage.setItem('abkkpss_user', JSON.stringify(this.currentUser));
        if (this.currentUser?.zone_id) {
          this.formData.zone_number = this.currentUser.zone_id;
        }
        this.render();
        this.loadSubmissions();
      } else {
        this.logout();
      }
    } catch {
      this.logout();
    }
  }

  async login(username: string, pass: string) {
    return this.withLoading(async () => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password: pass }),
        });
        const data = await res.json();
        if (data.success) {
          this.token = data.token;
          this.currentUser = data.user;
          localStorage.setItem('abkkpss_token', data.token);
          localStorage.setItem('abkkpss_user', JSON.stringify(data.user));
          this.formData = this.getDefaultFormData();
          this.render();
          this.loadSubmissions();
        } else {
          alert(data.error || 'Login failed');
        }
      } catch (err: any) {
        alert('Error during login: ' + err.message);
      }
    }, 'Authenticating...', 'Logging In');
  }

  logout() {
    this.token = null;
    this.currentUser = null;
    localStorage.removeItem('abkkpss_token');
    localStorage.removeItem('abkkpss_user');
    this.render();
  }

  // Helper for extracting 10-digit phone number
  extract10Digits(val: string): string {
    if (!val) return '';
    let digits = String(val).replace(/\D/g, '');
    if (digits.startsWith('91') && digits.length === 12) digits = digits.substring(2);
    return digits.slice(0, 10);
  }

  renderDatalistOptions(list: string[]): string {
    if (!list || list.length === 0) return '';
    return list.map((item) => `<option value="${item}"></option>`).join('');
  }

  // --- MEMBER LOGIC & 18+ CUTOFF (31/12/2026) ---
  evaluateAdult(dobInput: string): boolean {
    if (!dobInput) return false;
    const input = dobInput.trim();
    // HTML5 date input format: YYYY-MM-DD
    const isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10);
      const day = parseInt(isoMatch[3], 10);
      // Born on or before 31/12/2008 (completes 18 by 31/12/2026)
      if (year < 2008) return true;
      if (year === 2008 && (month < 12 || (month === 12 && day <= 31))) return true;
      return false;
    }
    const ddmmyyyy = input.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (ddmmyyyy) {
      const year = parseInt(ddmmyyyy[3], 10);
      const month = parseInt(ddmmyyyy[2], 10);
      const day = parseInt(ddmmyyyy[1], 10);
      if (year < 2008) return true;
      if (year === 2008 && (month < 12 || (month === 12 && day <= 31))) return true;
      return false;
    }
    if (/^\d{1,3}$/.test(input)) {
      return parseInt(input, 10) >= 18;
    }
    return false;
  }

  get18PlusCount(): number {
    return this.formData.members.filter((m) => m.is_adult_18_plus).length;
  }

  getTotalAmount(): number {
    return this.get18PlusCount() * 500;
  }

  addMember() {
    const nextSr = this.formData.members.length + 1;
    this.formData.members.push({
      serial_no: nextSr,
      first_name: '',
      middle_name: '',
      last_name: this.formData.surname || '',
      name: '',
      dob: '',
      is_adult_18_plus: false,
      gender: 'M',
      relation: '',
      education: '',
      mobile_number: '',
      blood_group: '',
      is_main_member: false,
    });
    this.render();
  }

  removeMember(idx: number) {
    if (this.formData.members.length > 1) {
      const removed = this.formData.members.splice(idx, 1)[0];
      this.formData.members.forEach((m, i) => (m.serial_no = i + 1));
      if (removed.is_main_member && this.formData.members.length > 0) {
        this.formData.members[0].is_main_member = true;
        const main = this.formData.members[0];
        this.formData.filler_name = main.name || [main.first_name, main.middle_name, this.formData.surname].filter(Boolean).join(' ');
        this.formData.filler_mobile = main.mobile_number || '';
      }
      this.render();
    }
  }

  async fetchExistingFamily() {
    const zone = this.formData.zone_number?.trim();
    const family = this.formData.family_number?.trim();
    if (!zone || !family) {
      alert('Please enter both Zone Number and Family Number.');
      return;
    }

    return this.withLoading(async () => {
      try {
        const res = await fetch(`/api/forms/search?zone=${encodeURIComponent(zone)}&family=${encodeURIComponent(family)}`, {
          headers: { Authorization: `Bearer ${this.token}` },
        });
        const data = await res.json();
        if (data.success && data.found) {
          const form = data.form;
          this.formData.current_city_or_place = form.current_city_or_place || '';
          this.formData.address_line_1 = form.address_line_1 || '';
          this.formData.address_line_2 = form.address_line_2 || '';
          this.formData.city_name = form.city_name || form.current_city_or_place || '';
          this.formData.state_name = form.state_name || 'Gujarat';
          this.formData.country_name = form.country_name || 'India';
          this.formData.residential_address = form.residential_address || '';

          this.formData.firm_name = form.firm_name || '';
          this.formData.firm_address_line_1 = form.firm_address_line_1 || '';
          this.formData.firm_address_line_2 = form.firm_address_line_2 || '';
          this.formData.firm_city_name = form.firm_city_name || '';
          this.formData.firm_state_name = form.firm_state_name || '';
          this.formData.firm_country_name = form.firm_country_name || '';
          this.formData.firm_postal_code = form.firm_postal_code || '';
          this.formData.firm_address = form.firm_address || '';

          this.formData.native_place = form.native_place || '';
          this.formData.surname = form.surname || '';
          this.formData.gotra = form.gotra || '';
          this.formData.taluka = form.taluka || '';
          this.formData.district = form.district || '';
          this.formData.pincode = form.pincode || '';
          this.formData.payment_mode = 'Cash';

          if (data.members && data.members.length > 0) {
            let hasMain = false;
            this.formData.members = data.members.map((m: any, idx: number) => {
              let fn = m.first_name || '';
              let mn = m.middle_name || '';
              let ln = m.last_name || form.surname || '';
              if (!fn && m.name) {
                const parts = m.name.trim().split(/\s+/);
                fn = parts[0] || '';
                mn = parts.length > 2 ? parts.slice(1, -1).join(' ') : parts[1] || '';
                ln = parts.length > 2 ? parts[parts.length - 1] : form.surname || '';
              }
              const isMain = m.is_main_member === 1 || m.is_main_member === true;
              if (isMain) hasMain = true;
              return {
                serial_no: idx + 1,
                first_name: fn,
                middle_name: mn,
                last_name: ln,
                name: m.name || [fn, mn, ln].filter(Boolean).join(' '),
                dob: m.dob || '',
                is_adult_18_plus: m.is_adult_18_plus === 1 || m.is_adult_18_plus === true,
                gender: m.gender || 'M',
                relation: m.relation || '',
                education: m.education || '',
                mobile_number: m.mobile_number || '',
                blood_group: m.blood_group || '',
                is_main_member: isMain,
              };
            });
            if (!hasMain && this.formData.members.length > 0) {
              this.formData.members[0].is_main_member = true;
            }
          }
          alert(`Existing details found and pre-filled for Zone ${zone}, Family ${family}!`);
          this.render();
        } else {
          alert(`No previous record found for Zone ${zone}, Family ${family}. You can enter new details.`);
        }
      } catch (err: any) {
        alert('Search failed: ' + err.message);
      }
    }, 'Searching family history across database...');
  }

  async submitForm(e: Event) {
    e.preventDefault();
    if (this.isSubmitting) return;

    if (!this.formData.zone_number || !this.formData.family_number) {
      alert('Please fill Zone Number and Family Number.');
      return;
    }

    // Determine Main Family Member
    let mainMember = this.formData.members.find((m) => m.is_main_member);
    if (!mainMember) {
      this.formData.members[0].is_main_member = true;
      mainMember = this.formData.members[0];
    }

    if (!mainMember.first_name && !mainMember.name) {
      alert('Please enter First Name for the Main Family Member.');
      return;
    }

    // Validate Main Member Mobile
    const mainDigits = this.extract10Digits(mainMember.mobile_number);
    if (!mainDigits || mainDigits.length !== 10) {
      alert('Please enter a valid 10-digit mobile number for the Main Family Member (all receipts will be sent to this WhatsApp number).');
      return;
    }

    // Normalize member names, surnames and mobiles
    for (let i = 0; i < this.formData.members.length; i++) {
      const m = this.formData.members[i];
      if (!m.first_name && !m.name) {
        alert(`Please enter First Name for Member #${i + 1}.`);
        return;
      }
      if (!m.dob) {
        alert(`Please select Date of Birth for Member #${i + 1} (${m.first_name || m.name}).`);
        return;
      }
      m.last_name = this.formData.surname || '';
      m.name = [m.first_name, m.middle_name, this.formData.surname].filter(Boolean).join(' ');
      if (m.mobile_number) {
        const mDigits = this.extract10Digits(m.mobile_number);
        if (mDigits && mDigits.length !== 10) {
          alert(`Invalid 10-digit mobile number for Member #${i + 1} (${m.name}).`);
          return;
        }
        m.mobile_number = mDigits ? `+91 ${mDigits}` : '';
      }
    }

    // Auto-populate filler_name and filler_mobile from designated main member
    this.formData.filler_name = mainMember.name;
    this.formData.filler_mobile = `+91 ${mainDigits}`;
    mainMember.mobile_number = `+91 ${mainDigits}`;
    this.formData.payment_mode = 'Cash';

    if (!this.formData.address_line_1?.trim() || !this.formData.city_name?.trim() || !this.formData.pincode?.trim()) {
      alert('Please fill in required Residential Address fields (Address Line 1, City, and Pincode).');
      return;
    }

    // Derive composite residential & firm addresses and sync current city
    this.formData.current_city_or_place = this.formData.city_name || this.formData.current_city_or_place;
    this.formData.residential_address = [
      this.formData.address_line_1,
      this.formData.address_line_2,
      this.formData.city_name,
      this.formData.state_name,
      this.formData.country_name,
      this.formData.pincode ? `PIN - ${this.formData.pincode}` : '',
    ].filter(Boolean).join(', ');

    if (this.formData.firm_address_line_1 || this.formData.firm_city_name) {
      this.formData.firm_address = [
        this.formData.firm_address_line_1,
        this.formData.firm_address_line_2,
        this.formData.firm_city_name,
        this.formData.firm_state_name,
        this.formData.firm_country_name,
        this.formData.firm_postal_code ? `PIN - ${this.formData.firm_postal_code}` : '',
      ].filter(Boolean).join(', ');
    }

    const gujaratiRegex = /[\u0A80-\u0AFF]/;
    const allTexts = [
      this.formData.filler_name,
      this.formData.surname,
      this.formData.gotra,
      this.formData.native_place,
      this.formData.taluka,
      this.formData.district,
      this.formData.address_line_1,
      this.formData.address_line_2,
      this.formData.city_name,
      this.formData.state_name,
      this.formData.country_name,
      this.formData.current_city_or_place,
      this.formData.residential_address,
      this.formData.firm_name,
      this.formData.firm_address_line_1,
      this.formData.firm_address_line_2,
      this.formData.firm_city_name,
      this.formData.firm_state_name,
      this.formData.firm_country_name,
      this.formData.firm_postal_code,
      this.formData.firm_address,
      ...this.formData.members.map((m) => `${m.name} ${m.first_name} ${m.middle_name} ${m.last_name} ${m.relation} ${m.education} ${m.blood_group}`),
    ];
    if (allTexts.some((t) => gujaratiRegex.test(t || ''))) {
      alert('Only English text is allowed. Please remove any Gujarati characters before submitting.');
      return;
    }

    this.isSubmitting = true;
    this.render();

    return this.withLoading(async () => {
      try {
        const isEdit = !!this.editingFormId;
        const url = isEdit ? `/api/forms/${this.editingFormId}` : '/api/forms';
        const method = isEdit ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.token}`,
          },
          body: JSON.stringify(this.formData),
        });
        const data = await res.json();
        this.isSubmitting = false;

        if (data.success) {
          const msg = isEdit
            ? `Form #${this.editingFormId} updated successfully!`
            : `Form submitted successfully! Total 18+ Members: ${data.totalAdultsCount}, Total Fee: ₹${data.totalAmount}`;
          this.editingFormId = null;
          this.successBannerMessage = msg;
          this.formData = this.getDefaultFormData();
          this.activeTab = 'submissions';
          this.render();
          this.loadSubmissions();
        } else {
          alert(data.error || 'Submission failed');
          this.render();
        }
      } catch (err: any) {
        this.isSubmitting = false;
        this.render();
        alert('Error submitting form: ' + err.message);
      }
    }, this.editingFormId ? 'Updating form details...' : 'Submitting membership form & calculating fees...', 'Form Submission');
  }

  async startEditForm(formId: number) {
    return this.withLoading(async () => {
      try {
        const res = await fetch(`/api/forms/${formId}`, {
          headers: { Authorization: `Bearer ${this.token}` },
        });
        const data = await res.json();
        if (!data.success || !data.form) {
          alert(data.error || 'Failed to load form for editing');
          return;
        }
        const form = data.form;
        if (form.status === 'APPROVED') {
          alert('Approved forms cannot be edited.');
          return;
        }

        this.editingFormId = formId;
        this.successBannerMessage = null;
        let hasMain = false;
        const loadedMembers = (data.members || []).map((m: any, idx: number) => {
          let fn = m.first_name || '';
          let mn = m.middle_name || '';
          let ln = m.last_name || form.surname || '';
          if (!fn && m.name) {
            const parts = m.name.trim().split(/\s+/);
            fn = parts[0] || '';
            mn = parts.length > 2 ? parts.slice(1, -1).join(' ') : parts[1] || '';
            ln = parts.length > 2 ? parts[parts.length - 1] : form.surname || '';
          }
          const isMain = m.is_main_member === 1 || m.is_main_member === true;
          if (isMain) hasMain = true;
          return {
            serial_no: idx + 1,
            first_name: fn,
            middle_name: mn,
            last_name: ln,
            name: m.name || [fn, mn, ln].filter(Boolean).join(' '),
            dob: m.dob || '',
            is_adult_18_plus: m.is_adult_18_plus === 1 || m.is_adult_18_plus === true,
            gender: m.gender || 'M',
            relation: m.relation || '',
            education: m.education || '',
            mobile_number: m.mobile_number || '',
            blood_group: m.blood_group || '',
            is_main_member: isMain,
          };
        });
        if (!hasMain && loadedMembers.length > 0) {
          loadedMembers[0].is_main_member = true;
        }

        this.formData = {
          zone_number: form.zone_number || '',
          family_number: form.family_number || '',
          current_city_or_place: form.current_city_or_place || '',
          address_line_1: form.address_line_1 || '',
          address_line_2: form.address_line_2 || '',
          city_name: form.city_name || form.current_city_or_place || '',
          state_name: form.state_name || 'Gujarat',
          country_name: form.country_name || 'India',
          residential_address: form.residential_address || '',
          firm_name: form.firm_name || '',
          firm_address_line_1: form.firm_address_line_1 || '',
          firm_address_line_2: form.firm_address_line_2 || '',
          firm_city_name: form.firm_city_name || '',
          firm_state_name: form.firm_state_name || '',
          firm_country_name: form.firm_country_name || '',
          firm_postal_code: form.firm_postal_code || '',
          firm_address: form.firm_address || '',
          native_place: form.native_place || '',
          surname: form.surname || '',
          gotra: form.gotra || '',
          taluka: form.taluka || '',
          district: form.district || '',
          pincode: form.pincode || '',
          filler_name: form.filler_name || '',
          filler_mobile: form.filler_mobile || '',
          payment_mode: form.payment_mode || 'Cash',
          members: loadedMembers.length > 0 ? loadedMembers : this.getDefaultFormData().members,
        };

        this.activeTab = 'form';
        this.render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err: any) {
        alert('Failed to load form: ' + err.message);
      }
    }, 'Loading form details for editing...', 'Edit Form');
  }

  cancelEdit() {
    this.editingFormId = null;
    this.formData = this.getDefaultFormData();
    this.render();
  }

  // --- SUBMISSIONS & APPROVALS ---
  async loadSubmissions(page?: number) {
    if (typeof page === 'number') {
      this.submissionsPage = page;
    }
    this.isLoadingSubmissions = true;
    return this.withLoading(async () => {
      try {
        const url = `/api/forms?status=${this.submissionsFilter}&search=${encodeURIComponent(this.submissionsSearch)}&page=${this.submissionsPage}&pageSize=${this.submissionsPageSize}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${this.token}` },
        });
        const data = await res.json();
        if (data.success) {
          this.submissions = data.forms || [];
          this.submissionsTotal = data.total !== undefined ? data.total : this.submissions.length;
          this.submissionsPage = data.page || 1;
          this.submissionsPageSize = data.pageSize || 10;
          this.submissionsTotalPages = data.totalPages || 1;
          this.renderSubmissionsList();
        }
      } catch (err) {
        console.error('Failed to load submissions', err);
      } finally {
        this.isLoadingSubmissions = false;
      }
    }, 'Loading submissions...');
  }

  async openApprovalModal(formId: number) {
    return this.withLoading(async () => {
      try {
        const res = await fetch(`/api/forms/${formId}`, {
          headers: { Authorization: `Bearer ${this.token}` },
        });
        const data = await res.json();
        if (data.success) {
          this.selectedSubmission = data;
          this.showApprovalModal = true;
          this.render();
        }
      } catch {}
    }, 'Loading form details...');
  }

  async approveSubmission(formId: number) {
    if (!confirm('Approve this form, assign member numbers, generate PDF receipt, and dispatch via WhatsApp?')) {
      return;
    }

    return this.withLoading(async () => {
      try {
        const res = await fetch(`/api/forms/${formId}/approve`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.token}` },
        });
        const data = await res.json();
        if (data.success) {
          alert(`Approved! Receipt No: ${data.receiptNumber}\nWhatsApp Dispatch: ${data.whatsappDispatch?.message}`);
          this.showApprovalModal = false;
          this.loadSubmissions();
          this.render();
        } else {
          alert(data.error || 'Approval failed');
        }
      } catch (err: any) {
        alert('Approval error: ' + err.message);
      }
    }, 'Approving submission, assigning member IDs & generating receipt PDF...', 'Approval & Receipt');
  }

  async rejectSubmission(formId: number) {
    if (!confirm('Reject this form submission?')) return;
    return this.withLoading(async () => {
      try {
        const res = await fetch(`/api/forms/${formId}/reject`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.token}` },
        });
        const data = await res.json();
        if (data.success) {
          alert('Form rejected.');
          this.showApprovalModal = false;
          this.loadSubmissions();
          this.render();
        }
      } catch {}
    }, 'Rejecting form submission...', 'Reject Form');
  }

  // --- SUPER ADMIN: USERS & WHATSAPP ---
  async loadUsers() {
    return this.withLoading(async () => {
      try {
        const res = await fetch('/api/users', {
          headers: { Authorization: `Bearer ${this.token}` },
        });
        const data = await res.json();
        if (data.success) {
          this.usersList = data.users || [];
          this.renderSuperAdmin();
        }
      } catch {}
    }, 'Loading user accounts...');
  }

  async createUser(username: string, pass: string, role: string, zone: string) {
    return this.withLoading(async () => {
      try {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.token}`,
          },
          body: JSON.stringify({ username, password: pass, role, zone_id: zone || null }),
        });
        const data = await res.json();
        if (data.success) {
          alert('User created successfully');
          this.loadUsers();
        } else {
          alert(data.error || 'Failed to create user');
        }
      } catch (err: any) {
        alert('User creation error: ' + err.message);
      }
    }, 'Creating new user account...', 'Create User');
  }

  async deleteUser(id: number) {
    if (!confirm('Delete this user?')) return;
    return this.withLoading(async () => {
      try {
        const res = await fetch(`/api/users/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${this.token}` },
        });
        const data = await res.json();
        if (data.success) {
          this.loadUsers();
        }
      } catch {}
    }, 'Deleting user account...', 'Delete User');
  }

  // --- USER PASSWORD UPDATE (SELF & ADMIN) ---
  openPasswordModal(userId: number, username: string, isSelf: boolean = false) {
    this.passwordModalUser = { id: userId, username };
    this.isSelfPasswordUpdate = isSelf;
    this.passwordModalError = null;
    this.passwordModalSuccess = null;
    this.isSavingPassword = false;
    this.showPasswordModal = true;
    this.render();
  }

  closePasswordModal() {
    this.showPasswordModal = false;
    this.passwordModalUser = null;
    this.isSelfPasswordUpdate = false;
    this.passwordModalError = null;
    this.passwordModalSuccess = null;
    this.isSavingPassword = false;
    this.render();
  }

  async updateSelfPassword(currentPass: string, newPass: string) {
    this.isSavingPassword = true;
    this.passwordModalError = null;
    this.passwordModalSuccess = null;
    this.render();

    try {
      const res = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({ currentPassword: currentPass, newPassword: newPass }),
      });
      const data = await res.json();
      const payload = data.data || data;

      if (payload.success) {
        this.passwordModalSuccess = payload.message || 'Password updated successfully!';
        this.isSavingPassword = false;
        this.render();
        setTimeout(() => {
          this.closePasswordModal();
        }, 1200);
      } else {
        this.passwordModalError = payload.error || payload.message || 'Failed to update password';
        this.isSavingPassword = false;
        this.render();
      }
    } catch (err: any) {
      this.passwordModalError = 'Network error: ' + err.message;
      this.isSavingPassword = false;
      this.render();
    }
  }

  async updateUserPassword(userId: number, newPass: string) {
    this.isSavingPassword = true;
    this.passwordModalError = null;
    this.passwordModalSuccess = null;
    this.render();

    try {
      const res = await fetch(`/api/users/${userId}/password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({ password: newPass }),
      });
      const data = await res.json();
      const payload = data.data || data;

      if (payload.success) {
        this.passwordModalSuccess = payload.message || 'Password updated successfully!';
        this.isSavingPassword = false;
        this.render();
        setTimeout(() => {
          this.closePasswordModal();
          if (this.currentUser?.role === 'SUPER_ADMIN') {
            this.loadUsers();
          }
        }, 1200);
      } else {
        this.passwordModalError = payload.error || payload.message || 'Failed to update password';
        this.isSavingPassword = false;
        this.render();
      }
    } catch (err: any) {
      this.passwordModalError = 'Network error: ' + err.message;
      this.isSavingPassword = false;
      this.render();
    }
  }

  // --- EDIT USER DETAILS (ADMIN / SUPER ADMIN) ---
  openEditUserModal(user: { id: number; username: string; role: string; zone_id: string | null }) {
    this.editModalUser = { ...user };
    this.editModalError = null;
    this.editModalSuccess = null;
    this.isSavingEditUser = false;
    this.showEditUserModal = true;
    this.render();
  }

  closeEditUserModal() {
    this.showEditUserModal = false;
    this.editModalUser = null;
    this.editModalError = null;
    this.editModalSuccess = null;
    this.isSavingEditUser = false;
    this.render();
  }

  async updateUserDetails(id: number, username: string, role: string, zone_id: string | null) {
    this.isSavingEditUser = true;
    this.editModalError = null;
    this.editModalSuccess = null;
    this.render();

    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          username,
          role,
          zone_id: zone_id || null,
        }),
      });
      const data = await res.json();
      const payload = data.data || data;

      if (payload.success) {
        this.editModalSuccess = payload.message || 'User updated successfully!';
        this.isSavingEditUser = false;
        if (this.currentUser && this.currentUser.id === id) {
          this.currentUser.username = username;
          this.currentUser.role = role as any;
          this.currentUser.zone_id = zone_id || null;
          localStorage.setItem('abkkpss_user', JSON.stringify(this.currentUser));
        }
        this.render();
        setTimeout(() => {
          this.closeEditUserModal();
          this.loadUsers();
        }, 1200);
      } else {
        this.editModalError = payload.error || payload.message || 'Failed to update user';
        this.isSavingEditUser = false;
        this.render();
      }
    } catch (err: any) {
      this.editModalError = 'Network error: ' + err.message;
      this.isSavingEditUser = false;
      this.render();
    }
  }

  // --- WHATSAPP (MANUAL REFRESH & NON-DESTRUCTIVE DOM UPDATES) ---
  renderWhatsAppQrContent(): string {
    const wa = this.whatsappStatus;
    if (wa.status === 'CONNECTED') {
      return `<div class="text-success py-5"><i class="bi bi-check-circle-fill fs-1 d-block mb-2"></i> WhatsApp is Connected & Active! Ready to dispatch receipts.</div>`;
    }
    if (wa.status === 'INITIALIZING') {
      return `
        <div class="text-primary py-5">
          <div class="spinner-border text-primary mb-3" role="status"></div>
          <div class="fw-semibold">Initializing WhatsApp Web client...</div>
          <small class="text-muted d-block mt-1">Starting Chromium browser session. Click 'Refresh Status / QR' in a moment.</small>
        </div>
      `;
    }
    if (this.whatsappQrUrl) {
      return `
        <img id="wa-qr-img" src="${this.whatsappQrUrl}" alt="WhatsApp QR Code" class="qr-image mb-2" />
        <small class="text-muted d-block">Scan this QR code with WhatsApp on your phone (Linked Devices)</small>
      `;
    }
    return `
      <div class="text-muted py-5">
        <i class="bi bi-qr-code fs-1 d-block mb-2"></i>
        <div>Click <strong>'Initialize & Pair'</strong> to start WhatsApp client.</div>
        <small class="d-block mt-1">Once initialized, click <strong>'Refresh Status / QR'</strong> to fetch the QR code.</small>
      </div>
    `;
  }

  updateWhatsAppUI() {
    if (this.activeTab !== 'superadmin') return;

    // 1. Status badge
    const badge = this.querySelector('#wa-status-badge');
    if (badge) {
      const wa = this.whatsappStatus;
      badge.className = `badge ${
        wa.status === 'CONNECTED'
          ? 'bg-success'
          : wa.status === 'PAIRING'
          ? 'bg-warning text-dark'
          : wa.status === 'INITIALIZING'
          ? 'bg-info text-dark'
          : 'bg-danger'
      } px-3 py-2`;
      badge.textContent = wa.status;
    }

    // 2. QR Container - targeted update without replacing existing image if unchanged
    const qrContainer = this.querySelector('#wa-qr-container');
    if (qrContainer) {
      const existingImg = qrContainer.querySelector('#wa-qr-img') as HTMLImageElement;
      if (
        existingImg &&
        this.whatsappQrUrl &&
        existingImg.getAttribute('src') === this.whatsappQrUrl &&
        this.whatsappStatus.status === 'PAIRING'
      ) {
        // Same QR code is already displayed - keep the DOM node intact so camera does not lose focus
      } else {
        qrContainer.innerHTML = this.renderWhatsAppQrContent();
      }
    }

    // 3. Last checked timestamp
    const lastCheckedEl = this.querySelector('#wa-last-checked');
    if (lastCheckedEl) {
      lastCheckedEl.textContent = this.waLastCheckedText ? `Last checked: ${this.waLastCheckedText}` : '';
    }

    // 4. Control buttons & spinner icon
    const btnConnect = this.querySelector('#btn-wa-connect') as HTMLButtonElement;
    const btnSimulate = this.querySelector('#btn-wa-simulate') as HTMLButtonElement;
    const btnDisconnect = this.querySelector('#btn-wa-disconnect') as HTMLButtonElement;
    const btnRefresh = this.querySelector('#btn-wa-refresh') as HTMLButtonElement;
    const refreshIcon = this.querySelector('#wa-refresh-icon');

    if (btnConnect) btnConnect.disabled = this.whatsappStatus.status === 'CONNECTED' || this.whatsappStatus.status === 'INITIALIZING';
    if (btnSimulate) btnSimulate.disabled = this.whatsappStatus.status === 'CONNECTED';
    if (btnDisconnect) btnDisconnect.disabled = this.whatsappStatus.status === 'DISCONNECTED';
    if (btnRefresh) btnRefresh.disabled = this.isCheckingWhatsApp;

    if (refreshIcon) {
      if (this.isCheckingWhatsApp) {
        refreshIcon.classList.add('spin');
      } else {
        refreshIcon.classList.remove('spin');
      }
    }
  }

  async loadWhatsAppStatus(isManual = false) {
    if (isManual) {
      this.isCheckingWhatsApp = true;
      this.updateWhatsAppUI();
    }

    try {
      const res = await fetch('/api/whatsapp/status', {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      const rawData = await res.json();
      const data = rawData.data || rawData;
      if (data.success) {
        this.whatsappStatus = {
          status: data.status,
          hasQr: data.hasQr,
          isMock: data.isMock,
        };
      }

      if (this.whatsappStatus.status === 'PAIRING' || this.whatsappStatus.hasQr) {
        const qrRes = await fetch('/api/whatsapp/qr', {
          headers: { Authorization: `Bearer ${this.token}` },
        });
        const rawQrData = await qrRes.json();
        const qrData = rawQrData.data || rawQrData;
        if (qrData.success && qrData.qr) {
          this.whatsappQrUrl = qrData.qr;
        }
      } else if (this.whatsappStatus.status !== 'INITIALIZING') {
        this.whatsappQrUrl = null;
      }
      this.waLastCheckedText = new Date().toLocaleTimeString();
    } catch (err) {
      console.warn('Failed to load WhatsApp status:', err);
    } finally {
      this.isCheckingWhatsApp = false;
      this.updateWhatsAppUI();
    }
  }

  async connectWhatsApp() {
    return this.withLoading(async () => {
      await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}` },
      });
      await this.loadWhatsAppStatus(false);
    }, 'Connecting to WhatsApp Web...', 'WhatsApp Integration');
  }

  async simulateConnectWhatsApp() {
    return this.withLoading(async () => {
      await fetch('/api/whatsapp/simulate-connect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}` },
      });
      await this.loadWhatsAppStatus(false);
    }, 'Simulating WhatsApp Web connection...', 'WhatsApp Integration');
  }

  async disconnectWhatsApp() {
    return this.withLoading(async () => {
      await fetch('/api/whatsapp/disconnect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}` },
      });
      await this.loadWhatsAppStatus(false);
    }, 'Disconnecting WhatsApp Web...', 'WhatsApp Integration');
  }

  // --- RENDER LOGIC ---
  render() {
    if (!this.currentUser || !this.token) {
      this.innerHTML = this.renderAuthView();
      this.attachAuthListeners();
      return;
    }

    this.innerHTML = `
      <!-- Navbar -->
      <nav class="navbar navbar-expand-lg abkkpss-navbar px-3 py-2 text-white">
        <div class="container-fluid d-flex justify-content-between align-items-center">
          <a class="navbar-brand abkkpss-brand mb-0 text-white" href="#" id="brand-home">
            <span class="d-none d-sm-inline">ABKKPSS - </span>Membership Registration & Digitization
            <small class="text-warning">Shree Akhil Bharatiya Kutch Kadwa Patidar Satsang Samaj</small>
          </a>
          <div class="d-flex align-items-center gap-2">
            <span class="badge ${this.getRoleBadgeClass()} py-1 px-2">
              ${this.currentUser.username} (${this.currentUser.role}${this.currentUser.zone_id ? ` - ${this.getZoneLabel(this.currentUser.zone_id)}` : ''})
            </span>
            <button class="btn btn-sm btn-outline-warning text-nowrap" id="btn-change-own-password" title="Change your login password">
              <i class="bi bi-key-fill me-1"></i>Change Password
            </button>
            <button class="btn btn-sm btn-outline-light" id="btn-logout">Logout</button>
          </div>
        </div>
      </nav>

      <!-- Navigation Tabs for Mobile & Desktop -->
      <div class="container-fluid bg-white border-bottom shadow-sm">
        <div class="container py-2">
          <ul class="nav nav-pills nav-fill gap-1">
            <li class="nav-item">
              <button class="nav-link touch-btn w-100 ${this.activeTab === 'form' ? 'active' : ''}" id="tab-form">
                <i class="bi bi-pencil-square me-1"></i> Form Entry
              </button>
            </li>
            <li class="nav-item">
              <button class="nav-link touch-btn w-100 ${this.activeTab === 'submissions' ? 'active' : ''}" id="tab-submissions">
                <i class="bi bi-list-check me-1"></i> Submissions
              </button>
            </li>
            ${
              this.currentUser.role === 'SUPER_ADMIN'
                ? `
            <li class="nav-item">
              <button class="nav-link touch-btn w-100 ${this.activeTab === 'superadmin' ? 'active' : ''}" id="tab-superadmin">
                <i class="bi bi-gear-fill me-1"></i> Admin & WhatsApp
              </button>
            </li>`
                : ''
            }
          </ul>
        </div>
      </div>

      <!-- Main Content Container -->
      <main class="container my-3">
        ${this.renderActiveTabContent()}
      </main>

      <!-- Approval Modal Container -->
      ${this.renderModalContent()}

      <!-- Password Update Modal Container -->
      ${this.renderPasswordModalContent()}

      <!-- Edit User Modal Container -->
      ${this.renderEditUserModalContent()}
    `;

    this.attachGlobalListeners();
  }

  getRoleBadgeClass(): string {
    if (this.currentUser?.role === 'SUPER_ADMIN') return 'bg-danger text-white';
    if (this.currentUser?.role === 'ADMIN') return 'bg-warning text-dark';
    return 'bg-info text-dark';
  }

  renderAuthView(): string {
    return `
      <div class="container py-5">
        <div class="row justify-content-center">
          <div class="col-12 col-sm-10 col-md-8 col-lg-5">
            <div class="card border-0 shadow-lg" style="border-radius: 16px; overflow: hidden;">
              <div class="card-header text-center py-4 abkkpss-navbar text-white">
                <h4 class="mb-1 fw-bold">ABKKPSS Membership Portal</h4>
                <p class="mb-0 text-warning small">Shree Akhil Bharatiya Kutch Kadwa Patidar Satsang Samaj</p>
                <div class="mt-2"><span class="badge bg-light text-dark px-3 py-1">Physical Form Digitization System</span></div>
              </div>
              <div class="card-body p-4">
                <form id="login-form">
                  <div class="mb-3">
                    <label class="form-label fw-semibold">Username</label>
                    <input type="text" id="login-username" class="form-control form-control-lg" placeholder="Enter username" required />
                  </div>
                  <div class="mb-4">
                    <label class="form-label fw-semibold">Password</label>
                    <input type="password" id="login-password" class="form-control form-control-lg" placeholder="Enter password" required />
                  </div>
                  <button type="submit" class="btn btn-primary touch-btn w-100 py-3 fw-bold" style="background-color: var(--abkkpss-primary); border: none;">
                    Login
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderActiveTabContent(): string {
    if (this.activeTab === 'form') return this.renderFormEntryView();
    if (this.activeTab === 'submissions') return this.renderSubmissionsView();
    if (this.activeTab === 'superadmin') return this.renderSuperAdminView();
    return '';
  }

  renderFormEntryView(): string {
    const isRegular = this.currentUser?.role === 'REGULAR_USER';
    const totalAdults = this.get18PlusCount();
    const totalFee = this.getTotalAmount();

    return `
      <form id="abkkpss-entry-form">
        <!-- Success and Edit Alert Banners -->
        ${
          this.successBannerMessage
            ? `
          <div class="alert alert-success alert-dismissible fade show shadow-sm mb-3" role="alert">
            <i class="bi bi-check-circle-fill me-2 fs-5 align-middle"></i>
            <span>${this.successBannerMessage}</span>
            <button type="button" class="btn-close" id="btn-close-success-banner" aria-label="Close"></button>
          </div>
        `
            : ''
        }

        ${
          this.editingFormId
            ? `
          <div class="alert alert-warning shadow-sm mb-3 d-flex justify-content-between align-items-center" role="alert">
            <div>
              <i class="bi bi-pencil-square me-2 fs-5 align-middle"></i>
              <strong>Editing Form #${this.editingFormId}</strong> - Modify details and click 'Update Form' below.
            </div>
            <button type="button" class="btn btn-sm btn-outline-dark" id="btn-cancel-edit">Cancel Edit</button>
          </div>
        `
            : ''
        }

        <!-- Zone & Family Search Module -->
        <div class="card mb-3 border-primary shadow-sm">
          <div class="card-header bg-primary text-white py-2 d-flex justify-content-between align-items-center">
            <span class="fw-bold"><i class="bi bi-search me-1"></i> Zone & Family Search Module</span>
            <span class="badge bg-light text-primary">Pre-fill Existing Record</span>
          </div>
          <div class="card-body p-3">
            <div class="row g-2 align-items-end">
              <div class="col-12 col-md-4">
                <label class="form-label fw-semibold">Zone <span class="text-danger">*</span></label>
                <select class="form-select" id="field-zone-number" ${isRegular ? 'disabled' : ''} required>
                  <option value="">-- Select Zone --</option>
                  ${STANDARD_ZONES.map(
                    (z) => `<option value="${z.code}" ${this.formData.zone_number === z.code ? 'selected' : ''}>${z.label}</option>`
                  ).join('')}
                </select>
                ${isRegular ? `<small class="text-muted">Assigned to ${this.getZoneLabel(this.currentUser?.zone_id)}</small>` : ''}
              </div>
              <div class="col-12 col-md-4">
                <label class="form-label fw-semibold">Family No <span class="text-danger">*</span></label>
                <input type="text" class="form-control" id="field-family-number" value="${this.formData.family_number}" placeholder="e.g. 32" required />
              </div>
              <div class="col-12 col-md-4">
                <button type="button" class="btn btn-primary touch-btn w-100" id="btn-fetch-family">
                  <i class="bi bi-cloud-arrow-down-fill me-1"></i> Fetch Existing Details
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Family & Native Details Card -->
        <div class="card mb-3 shadow-sm">
          <div class="card-header bg-light py-2 fw-bold text-dark">
            <i class="bi bi-house-door-fill text-primary me-1"></i> Family & Native Details
          </div>
          <div class="card-body p-3">
            <div class="row g-3">
              <div class="col-12">
                <div class="alert alert-light border py-2 px-3 mb-0 small text-muted">
                  <i class="bi bi-info-circle text-primary me-1"></i>
                  Filler details (Main Family Member Name and WhatsApp Mobile) are automatically derived from the selected <strong>Main Family Member</strong> below. All member receipts will be sent to this WhatsApp number.
                </div>
              </div>

              <div class="col-12 col-md-6 col-lg-3">
                <label class="form-label fw-semibold">Surname <span class="text-danger">*</span></label>
                <input type="text" class="form-control" id="field-surname" list="datalist-surnames" value="${this.formData.surname}" placeholder="Surname" required />
              </div>
              <div class="col-12 col-md-6 col-lg-3">
                <label class="form-label fw-semibold">Gotra <span class="text-danger">*</span></label>
                <input type="text" class="form-control" id="field-gotra" list="datalist-gotras" value="${this.formData.gotra}" placeholder="Gotra" required />
              </div>
              <div class="col-12 col-md-6 col-lg-3">
                <label class="form-label fw-semibold">Native Place <span class="text-danger">*</span></label>
                <input type="text" class="form-control" id="field-native-place" list="datalist-native-places" value="${this.formData.native_place}" placeholder="Native Place" required />
              </div>
              <div class="col-12 col-md-6 col-lg-3">
                <label class="form-label fw-semibold">Payment Mode</label>
                <div class="input-group">
                  <span class="input-group-text bg-success-subtle text-success fw-bold"><i class="bi bi-cash me-1"></i> Cash Only</span>
                  <input type="text" class="form-control" id="field-payment-mode" value="Cash" readonly />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Residential Address Card -->
        <div class="card mb-3 shadow-sm">
          <div class="card-header bg-light py-2 fw-bold text-dark">
            <i class="bi bi-geo-alt-fill text-primary me-1"></i> Residential Address
          </div>
          <div class="card-body p-3">
            <div class="row g-3">
              <div class="col-12 col-md-6">
                <label class="form-label fw-semibold">Address Line 1 <span class="text-danger">*</span></label>
                <input type="text" class="form-control" id="field-address-line-1" value="${this.formData.address_line_1}" placeholder="Flat / House No, Building, Society / Street" required />
              </div>
              <div class="col-12 col-md-6">
                <label class="form-label fw-semibold">Address Line 2</label>
                <input type="text" class="form-control" id="field-address-line-2" value="${this.formData.address_line_2}" placeholder="Area, Landmark, Road" />
              </div>

              <div class="col-12 col-md-6 col-lg-3">
                <label class="form-label fw-semibold">City Name <span class="text-danger">*</span></label>
                <input type="text" class="form-control" id="field-city-name" list="datalist-current-cities" value="${this.formData.city_name || this.formData.current_city_or_place}" placeholder="City Name" required />
              </div>
              <div class="col-12 col-md-6 col-lg-3">
                <label class="form-label fw-semibold">State Name <span class="text-danger">*</span></label>
                <input type="text" class="form-control" id="field-state-name" list="datalist-states" value="${this.formData.state_name}" placeholder="State Name" required />
              </div>
              <div class="col-12 col-md-6 col-lg-3">
                <label class="form-label fw-semibold">Country Name <span class="text-danger">*</span></label>
                <input type="text" class="form-control" id="field-country-name" list="datalist-countries" value="${this.formData.country_name}" placeholder="Country Name" required />
              </div>
              <div class="col-12 col-md-6 col-lg-3">
                <label class="form-label fw-semibold">Postal Code / Pincode <span class="text-danger">*</span></label>
                <input type="text" class="form-control" id="field-pincode" list="datalist-pincodes" value="${this.formData.pincode}" placeholder="6-digit Pincode" required />
              </div>
            </div>
          </div>
        </div>

        <!-- Firm / Business Details Card (Optional) -->
        <div class="card mb-3 shadow-sm">
          <div class="card-header bg-light py-2 fw-bold text-dark">
            <i class="bi bi-briefcase-fill text-primary me-1"></i> Firm / Business Details <small class="text-muted fw-normal">(Optional)</small>
          </div>
          <div class="card-body p-3">
            <div class="row g-3">
              <div class="col-12">
                <label class="form-label fw-semibold">Firm Name</label>
                <input type="text" class="form-control" id="field-firm-name" value="${this.formData.firm_name}" placeholder="Firm / Shop / Company Name" />
              </div>

              <div class="col-12 col-md-6">
                <label class="form-label fw-semibold">Address Line 1</label>
                <input type="text" class="form-control" id="field-firm-address-line-1" value="${this.formData.firm_address_line_1}" placeholder="Office / Shop No, Complex, Market" />
              </div>
              <div class="col-12 col-md-6">
                <label class="form-label fw-semibold">Address Line 2</label>
                <input type="text" class="form-control" id="field-firm-address-line-2" value="${this.formData.firm_address_line_2}" placeholder="Area, Landmark, Road" />
              </div>

              <div class="col-12 col-md-6 col-lg-3">
                <label class="form-label fw-semibold">City Name</label>
                <input type="text" class="form-control" id="field-firm-city-name" list="datalist-current-cities" value="${this.formData.firm_city_name}" placeholder="City Name" />
              </div>
              <div class="col-12 col-md-6 col-lg-3">
                <label class="form-label fw-semibold">State Name</label>
                <input type="text" class="form-control" id="field-firm-state-name" list="datalist-states" value="${this.formData.firm_state_name || 'Gujarat'}" placeholder="State Name" />
              </div>
              <div class="col-12 col-md-6 col-lg-3">
                <label class="form-label fw-semibold">Country Name</label>
                <input type="text" class="form-control" id="field-firm-country-name" list="datalist-countries" value="${this.formData.firm_country_name || 'India'}" placeholder="Country Name" />
              </div>
              <div class="col-12 col-md-6 col-lg-3">
                <label class="form-label fw-semibold">Postal Code</label>
                <input type="text" class="form-control" id="field-firm-postal-code" list="datalist-pincodes" value="${this.formData.firm_postal_code}" placeholder="Postal Code" />
              </div>
            </div>
          </div>
        </div>

        <!-- Dynamic Member Entry Cards / Responsive Table -->
        <div class="card mb-4 shadow-sm">
          <div class="card-header bg-light py-2 d-flex justify-content-between align-items-center">
            <span class="fw-bold text-dark"><i class="bi bi-people-fill text-primary me-1"></i> Family Members Entry</span>
            <button type="button" class="btn btn-sm btn-success" id="btn-add-member">
              <i class="bi bi-plus-circle me-1"></i> + Add Member
            </button>
          </div>
          <div class="card-body p-3">
            <div class="alert alert-info py-2 mb-3 small d-flex align-items-center">
              <i class="bi bi-info-circle-fill me-2 fs-5"></i>
              <div>
                <strong>18+ Age Rule (Cutoff Date 31/12/2026):</strong> Members born on or before 31-12-2008 (or completing 18 years by 31-12-2026) are subject to ₹500 lifetime membership fee. 18+ status is automatically calculated from Date of Birth.
              </div>
            </div>

            <!-- Mobile View: Collapsible Cards per Member (Visible on screens < 768px) -->
            <div class="d-md-none" id="members-cards-container">
              ${this.formData.members
                .map(
                  (m, idx) => `
                <div class="card member-card ${m.is_adult_18_plus ? 'is-adult' : ''}">
                  <div class="member-card-header d-flex justify-content-between align-items-center" data-bs-toggle="collapse" data-bs-target="#member-collapse-${idx}">
                    <div class="d-flex align-items-center">
                      <div class="form-check d-inline-block me-2" onclick="event.stopPropagation();">
                        <input class="form-check-input member-main-radio" type="radio" name="main_member_selection" data-index="${idx}" id="main-member-radio-m-${idx}" ${m.is_main_member ? 'checked' : ''} />
                        <label class="form-check-label small fw-bold text-primary" for="main-member-radio-m-${idx}">Main</label>
                      </div>
                      <span class="badge bg-secondary me-1">#${idx + 1}</span>
                      <span>${[m.first_name, m.middle_name, this.formData.surname].filter(Boolean).join(' ') || m.name || `Member ${idx + 1}`}</span>
                      ${m.relation ? `<small class="text-muted ms-1">(${m.relation})</small>` : ''}
                    </div>
                    <div>
                      ${
                        m.is_adult_18_plus
                          ? '<span class="badge bg-success me-1">18+ (₹500)</span>'
                          : '<span class="badge bg-secondary me-1">< 18</span>'
                      }
                      ${
                        this.formData.members.length > 1
                          ? `<button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 btn-remove-member" data-index="${idx}">×</button>`
                          : ''
                      }
                    </div>
                  </div>
                  <div class="collapse show p-3" id="member-collapse-${idx}">
                    <div class="row g-2">
                      <div class="col-12 col-sm-6">
                        <label class="form-label small fw-semibold">First Name <span class="text-danger">*</span></label>
                        <input type="text" class="form-control member-input member-name-part" data-index="${idx}" data-field="first_name" value="${m.first_name || ''}" placeholder="First Name" required />
                      </div>
                      <div class="col-12 col-sm-6">
                        <label class="form-label small fw-semibold">Middle Name</label>
                        <input type="text" class="form-control member-input member-name-part" data-index="${idx}" data-field="middle_name" value="${m.middle_name || ''}" placeholder="Father/Husband Name" />
                      </div>
                      <div class="col-6">
                        <label class="form-label small fw-semibold">Relation <span class="text-danger">*</span></label>
                        <input type="text" class="form-control member-input" data-index="${idx}" data-field="relation" list="datalist-relations" value="${m.relation}" placeholder="e.g. Self, Wife, Son" required />
                      </div>
                      <div class="col-6">
                        <label class="form-label small fw-semibold">Gender <span class="text-danger">*</span></label>
                        <select class="form-select member-input" data-index="${idx}" data-field="gender">
                          <option value="M" ${m.gender === 'M' ? 'selected' : ''}>Male</option>
                          <option value="F" ${m.gender === 'F' ? 'selected' : ''}>Female</option>
                        </select>
                      </div>
                      <div class="col-7">
                        <label class="form-label small fw-semibold">Date of Birth (DOB) <span class="text-danger">*</span></label>
                        <input type="date" class="form-control member-dob-input" data-index="${idx}" value="${m.dob}" max="2026-12-31" required />
                      </div>
                      <div class="col-5 d-flex align-items-center pt-3">
                        <div>
                          <label class="form-label small d-block mb-1 fw-semibold text-muted">18+ Adult Status</label>
                          <span class="badge ${m.is_adult_18_plus ? 'bg-success' : 'bg-secondary'} member-adult-badge px-2 py-1" data-index="${idx}">
                            ${m.is_adult_18_plus ? 'YES (18+)' : 'NO (< 18)'}
                          </span>
                        </div>
                      </div>
                      <div class="col-12 col-sm-4">
                        <label class="form-label small">Education</label>
                        <input type="text" class="form-control form-control-sm member-input" data-index="${idx}" data-field="education" list="datalist-educations" value="${m.education}" placeholder="Education" />
                      </div>
                      <div class="col-12 col-sm-4">
                        <label class="form-label small">Mobile ${m.is_main_member ? '<span class="text-danger">* (Main Member)</span>' : ''}</label>
                        <div class="input-group input-group-sm">
                          <span class="input-group-text">+91</span>
                          <input type="tel" class="form-control form-control-sm member-mobile-input" data-index="${idx}" value="${this.extract10Digits(m.mobile_number)}" placeholder="10 digits" ${m.is_main_member ? 'required' : ''} maxlength="10" />
                        </div>
                      </div>
                      <div class="col-12 col-sm-4">
                        <label class="form-label small">Blood Group</label>
                        <select class="form-select form-select-sm member-input" data-index="${idx}" data-field="blood_group">
                          <option value="">Select Blood Group</option>
                          ${(this.distinctOptions.blood_groups || ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).map(
                            (bg) => `<option value="${bg}" ${m.blood_group === bg ? 'selected' : ''}>${bg}</option>`
                          ).join('')}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              `
                )
                .join('')}
            </div>

            <!-- Desktop View: Responsive Table (Visible on screens >= 768px) -->
            <div class="table-responsive d-none d-md-block">
              <table class="table table-bordered table-hover align-middle mb-0">
                <thead class="table-light">
                  <tr class="small text-center">
                    <th style="width: 50px;">Main</th>
                    <th style="width: 35px;">#</th>
                    <th style="min-width: 140px;">First Name *</th>
                    <th style="min-width: 130px;">Middle Name</th>
                    <th style="min-width: 100px;">Relation *</th>
                    <th style="width: 80px;">Gender</th>
                    <th style="min-width: 130px;">DOB (Date) *</th>
                    <th style="width: 90px;">18+ Adult</th>
                    <th style="min-width: 110px;">Education</th>
                    <th style="min-width: 140px;">Mobile (+91)</th>
                    <th style="min-width: 95px;">Blood Group</th>
                    <th style="width: 40px;">-</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.formData.members
                    .map(
                      (m, idx) => `
                    <tr>
                      <td class="text-center">
                        <input class="form-check-input member-main-radio" type="radio" name="main_member_selection" data-index="${idx}" ${m.is_main_member ? 'checked' : ''} title="Select as Main Family Member" />
                      </td>
                      <td class="text-center fw-bold">${idx + 1}</td>
                      <td>
                        <input type="text" class="form-control form-control-sm member-input member-name-part" data-index="${idx}" data-field="first_name" value="${m.first_name || ''}" placeholder="First Name" required />
                      </td>
                      <td>
                        <input type="text" class="form-control form-control-sm member-input member-name-part" data-index="${idx}" data-field="middle_name" value="${m.middle_name || ''}" placeholder="Middle Name" />
                      </td>
                      <td>
                        <input type="text" class="form-control form-control-sm member-input" data-index="${idx}" data-field="relation" list="datalist-relations" value="${m.relation}" placeholder="Relation" required />
                      </td>
                      <td>
                        <select class="form-select form-select-sm member-input" data-index="${idx}" data-field="gender">
                          <option value="M" ${m.gender === 'M' ? 'selected' : ''}>Male</option>
                          <option value="F" ${m.gender === 'F' ? 'selected' : ''}>Female</option>
                        </select>
                      </td>
                      <td>
                        <input type="date" class="form-control form-control-sm member-dob-input" data-index="${idx}" value="${m.dob}" max="2026-12-31" required />
                      </td>
                      <td class="text-center">
                        <span class="badge ${m.is_adult_18_plus ? 'bg-success' : 'bg-secondary'} member-adult-badge" data-index="${idx}">${m.is_adult_18_plus ? 'YES' : 'NO'}</span>
                      </td>
                      <td>
                        <input type="text" class="form-control form-control-sm member-input" data-index="${idx}" data-field="education" list="datalist-educations" value="${m.education}" placeholder="Education" />
                      </td>
                      <td>
                        <div class="input-group input-group-sm">
                          <span class="input-group-text p-1 text-muted" style="font-size: 0.75rem;">+91</span>
                          <input type="tel" class="form-control form-control-sm member-mobile-input" data-index="${idx}" value="${this.extract10Digits(m.mobile_number)}" placeholder="10 digits" ${m.is_main_member ? 'required' : ''} maxlength="10" />
                        </div>
                      </td>
                      <td>
                        <select class="form-select form-select-sm member-input" data-index="${idx}" data-field="blood_group">
                          <option value="">Select</option>
                          ${(this.distinctOptions.blood_groups || ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).map(
                            (bg) => `<option value="${bg}" ${m.blood_group === bg ? 'selected' : ''}>${bg}</option>`
                          ).join('')}
                        </select>
                      </td>
                      <td class="text-center">
                        ${
                          this.formData.members.length > 1
                            ? `<button type="button" class="btn btn-sm btn-outline-danger p-0 px-2 btn-remove-member" data-index="${idx}">×</button>`
                            : ''
                        }
                      </td>
                    </tr>
                  `
                    )
                    .join('')}
                </tbody>
              </table>
            </div>

          </div>
        </div>

        <!-- Sticky Mobile Fee Calculator Bar (Floating Bottom on Mobile, static card on desktop) -->
        <div class="sticky-fee-bar">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <span class="fee-badge-pill">
                18+ Members: <strong id="adults-count-display">${totalAdults}</strong>
              </span>
              <div class="fee-total-amount mt-1">
                Total Fee: ₹<span id="total-fee-display">${totalFee.toLocaleString('en-IN')}</span>
                <small class="text-muted fs-6 fw-normal">(₹500 × ${totalAdults})</small>
              </div>
            </div>
            <div class="d-flex align-items-center gap-2">
              ${this.editingFormId ? `<button type="button" class="btn btn-outline-secondary touch-btn" id="btn-cancel-edit-bar">Cancel</button>` : ''}
              <button type="submit" class="btn btn-success touch-btn px-4 fw-bold shadow" ${this.isSubmitting ? 'disabled' : ''}>
                ${
                  this.isSubmitting
                    ? '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Submitting...'
                    : this.editingFormId
                    ? '<i class="bi bi-check2-circle me-1"></i> Update Form'
                    : '<i class="bi bi-check2-circle me-1"></i> Submit Form'
                }
              </button>
            </div>
          </div>
        </div>

        <!-- Dynamic Datalists for Distinct Value Dropdowns -->
        <datalist id="datalist-surnames">${this.renderDatalistOptions(this.distinctOptions.surnames)}</datalist>
        <datalist id="datalist-gotras">${this.renderDatalistOptions(this.distinctOptions.gotras)}</datalist>
        <datalist id="datalist-native-places">${this.renderDatalistOptions(this.distinctOptions.native_places)}</datalist>
        <datalist id="datalist-talukas">${this.renderDatalistOptions(this.distinctOptions.talukas)}</datalist>
        <datalist id="datalist-districts">${this.renderDatalistOptions(this.distinctOptions.districts)}</datalist>
        <datalist id="datalist-current-cities">${this.renderDatalistOptions(this.distinctOptions.current_cities)}</datalist>
        <datalist id="datalist-states">${this.renderDatalistOptions(this.distinctOptions.states || [])}</datalist>
        <datalist id="datalist-countries">${this.renderDatalistOptions(this.distinctOptions.countries || [])}</datalist>
        <datalist id="datalist-pincodes">${this.renderDatalistOptions(this.distinctOptions.pincodes)}</datalist>
        <datalist id="datalist-relations">${this.renderDatalistOptions(this.distinctOptions.relations)}</datalist>
        <datalist id="datalist-educations">${this.renderDatalistOptions(this.distinctOptions.educations)}</datalist>

      </form>
    `;
  }

  renderSubmissionsView(): string {
    return `
      <div class="card border-0 shadow-sm mb-4">
        <div class="card-body p-3">
          <div class="row g-2 align-items-center mb-3">
            <div class="col-12 col-md-5">
              <div class="input-group">
                <span class="input-group-text"><i class="bi bi-search"></i></span>
                <input type="text" class="form-control" id="search-submissions-input" placeholder="Search Family No, Name, Mobile, City..." value="${this.submissionsSearch}" />
              </div>
            </div>
            <div class="col-12 col-md-5">
              <div class="btn-group w-100" role="group">
                <button type="button" class="btn btn-outline-primary btn-sm btn-filter ${this.submissionsFilter === 'ALL' ? 'active' : ''}" data-filter="ALL">All</button>
                <button type="button" class="btn btn-outline-warning btn-sm btn-filter ${this.submissionsFilter === 'PENDING' ? 'active' : ''}" data-filter="PENDING">Pending</button>
                <button type="button" class="btn btn-outline-success btn-sm btn-filter ${this.submissionsFilter === 'APPROVED' ? 'active' : ''}" data-filter="APPROVED">Approved</button>
                <button type="button" class="btn btn-outline-danger btn-sm btn-filter ${this.submissionsFilter === 'REJECTED' ? 'active' : ''}" data-filter="REJECTED">Rejected</button>
              </div>
            </div>
            <div class="col-12 col-md-2 d-flex justify-content-md-end align-items-center">
              <div class="input-group input-group-sm">
                <span class="input-group-text bg-light text-muted small">Show</span>
                <select class="form-select form-select-sm" id="submissions-page-size">
                  <option value="10" ${this.submissionsPageSize === 10 ? 'selected' : ''}>10</option>
                  <option value="25" ${this.submissionsPageSize === 25 ? 'selected' : ''}>25</option>
                  <option value="50" ${this.submissionsPageSize === 50 ? 'selected' : ''}>50</option>
                  <option value="100" ${this.submissionsPageSize === 100 ? 'selected' : ''}>100</option>
                </select>
              </div>
            </div>
          </div>

          <div id="submissions-list-container">
            <!-- Dynamic Content loaded via renderSubmissionsList -->
            <div class="text-center py-4 text-muted"><i class="bi bi-arrow-repeat spin"></i> Loading submissions...</div>
          </div>
        </div>
      </div>
    `;
  }

  renderPaginationControls(): string {
    const totalPages = this.submissionsTotalPages;
    const current = this.submissionsPage;

    if (totalPages <= 1) {
      return '';
    }

    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      const start = Math.max(2, current - 1);
      const end = Math.min(totalPages - 1, current + 1);

      if (start > 2) {
        pages.push('...');
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < totalPages - 1) {
        pages.push('...');
      }

      pages.push(totalPages);
    }

    return `
      <nav aria-label="Submissions pagination">
        <ul class="pagination pagination-sm mb-0 justify-content-center">
          <li class="page-item ${current <= 1 ? 'disabled' : ''}">
            <button type="button" class="page-link btn-page" data-page="1" title="First Page" ${current <= 1 ? 'disabled' : ''}>&laquo;</button>
          </li>
          <li class="page-item ${current <= 1 ? 'disabled' : ''}">
            <button type="button" class="page-link btn-page" data-page="${current - 1}" title="Previous Page" ${current <= 1 ? 'disabled' : ''}>&lsaquo;</button>
          </li>
          ${pages
            .map((p) => {
              if (p === '...') {
                return `<li class="page-item disabled"><span class="page-link">&hellip;</span></li>`;
              }
              const isCurrent = p === current;
              return `
                <li class="page-item ${isCurrent ? 'active' : ''}">
                  <button type="button" class="page-link btn-page" data-page="${p}">${p}</button>
                </li>
              `;
            })
            .join('')}
          <li class="page-item ${current >= totalPages ? 'disabled' : ''}">
            <button type="button" class="page-link btn-page" data-page="${current + 1}" title="Next Page" ${current >= totalPages ? 'disabled' : ''}>&rsaquo;</button>
          </li>
          <li class="page-item ${current >= totalPages ? 'disabled' : ''}">
            <button type="button" class="page-link btn-page" data-page="${totalPages}" title="Last Page" ${current >= totalPages ? 'disabled' : ''}>&raquo;</button>
          </li>
        </ul>
      </nav>
    `;
  }

  renderSubmissionsList() {
    const container = this.querySelector('#submissions-list-container');
    if (!container) return;

    if (this.submissions.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5 text-muted">
          <i class="bi bi-folder-x fs-1 d-block mb-2"></i>
          No submissions found.
        </div>
      `;
      return;
    }

    const isAdmin = this.currentUser?.role === 'ADMIN' || this.currentUser?.role === 'SUPER_ADMIN';
    const fromItem = this.submissionsTotal > 0 ? (this.submissionsPage - 1) * this.submissionsPageSize + 1 : 0;
    const toItem = Math.min(this.submissionsPage * this.submissionsPageSize, this.submissionsTotal);

    // Mobile View: Stacked Submission Cards
    // Desktop View: Responsive Table
    container.innerHTML = `
      <!-- Mobile Cards (< 768px) -->
      <div class="d-md-none">
        ${this.submissions
          .map(
            (f) => `
          <div class="card submission-card border-0 shadow-sm mb-3">
            <div class="card-body p-3">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <span class="badge bg-primary me-1">${this.getZoneLabel(f.zone_number)}</span>
                  <span class="badge bg-secondary">Family #${f.family_number}</span>
                </div>
                <div>
                  ${
                    f.status === 'APPROVED'
                      ? '<span class="badge bg-success">APPROVED</span>'
                      : f.status === 'REJECTED'
                      ? '<span class="badge bg-danger">REJECTED</span>'
                      : '<span class="badge bg-warning text-dark">PENDING</span>'
                  }
                </div>
              </div>

              <h6 class="mb-1 fw-bold">${f.filler_name} (${f.surname || ''} ${f.gotra ? `- ${f.gotra}` : ''})</h6>
              <div class="small text-muted mb-2">
                <div><i class="bi bi-geo-alt me-1"></i> ${f.native_place ? `${f.native_place} ` : ''}(Current: ${f.city_name || f.current_city_or_place || '-'})</div>
                <div><i class="bi bi-telephone me-1"></i> ${f.filler_mobile || '-'}</div>
                <div><i class="bi bi-cash-stack me-1"></i> 18+ Members: <strong>${f.total_adults_count}</strong> | Amount: <strong>₹${f.total_amount}</strong></div>
                ${f.receipt_number ? `<div class="text-success fw-bold"><i class="bi bi-receipt me-1"></i> Receipt No: ${f.receipt_number}</div>` : ''}
              </div>

              <div class="d-flex gap-2 mt-3">
                <button class="btn btn-sm btn-outline-primary flex-fill btn-view-submission" data-id="${f.id}">
                  <i class="bi bi-eye"></i> View Details
                </button>
                ${
                  f.status !== 'APPROVED'
                    ? `<button class="btn btn-sm btn-outline-warning flex-fill btn-edit-submission" data-id="${f.id}">
                        <i class="bi bi-pencil-square"></i> Edit
                      </button>`
                    : ''
                }
                ${
                  f.status === 'APPROVED'
                    ? `<a href="/api/forms/${f.id}/receipt" target="_blank" class="btn btn-sm btn-success flex-fill">
                        <i class="bi bi-file-earmark-pdf"></i> Receipt PDF
                      </a>`
                    : ''
                }
                ${
                  isAdmin && f.status === 'PENDING'
                    ? `<button class="btn btn-sm btn-warning flex-fill btn-approve-modal-trigger" data-id="${f.id}">
                        <i class="bi bi-check-circle"></i> Review & Approve
                      </button>`
                    : ''
                }
              </div>
            </div>
          </div>
        `
          )
          .join('')}
      </div>

      <!-- Desktop Table (>= 768px) -->
      <div class="table-responsive d-none d-md-block">
        <table class="table table-hover align-middle mb-0">
          <thead class="table-light">
            <tr class="small">
              <th>ID</th>
              <th>Zone / Family</th>
              <th>Filler Name</th>
              <th>Surname / Gotra</th>
              <th>Native / Current</th>
              <th>Mobile</th>
              <th>18+ Members</th>
              <th>Total Amount</th>
              <th>Receipt No</th>
              <th>Status</th>
              <th class="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${this.submissions
              .map(
                (f) => `
              <tr>
                <td class="fw-bold">#${f.id}</td>
                <td><span class="badge bg-primary">${this.getZoneLabel(f.zone_number)}</span> <span class="badge bg-secondary">F${f.family_number}</span></td>
                <td class="fw-semibold">${f.filler_name}</td>
                <td>${f.surname || '-'} <small class="text-muted">(${f.gotra || ''})</small></td>
                <td>${f.native_place || '-'} <small class="text-muted">(${f.city_name || f.current_city_or_place || ''})</small></td>
                <td>${f.filler_mobile || '-'}</td>
                <td class="text-center fw-bold">${f.total_adults_count}</td>
                <td class="fw-bold text-primary">₹${f.total_amount}</td>
                <td>${f.receipt_number ? `<span class="badge bg-success-subtle text-success">${f.receipt_number}</span>` : '-'}</td>
                <td>
                  ${
                    f.status === 'APPROVED'
                      ? '<span class="badge bg-success">APPROVED</span>'
                      : f.status === 'REJECTED'
                      ? '<span class="badge bg-danger">REJECTED</span>'
                      : '<span class="badge bg-warning text-dark">PENDING</span>'
                  }
                </td>
                <td class="text-end">
                  <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary btn-view-submission" data-id="${f.id}" title="View Details"><i class="bi bi-eye"></i></button>
                    ${
                      f.status !== 'APPROVED'
                        ? `<button class="btn btn-outline-warning btn-edit-submission" data-id="${f.id}" title="Edit Form"><i class="bi bi-pencil-square"></i></button>`
                        : ''
                    }
                    ${
                      f.status === 'APPROVED'
                        ? `<a href="/api/forms/${f.id}/receipt" target="_blank" class="btn btn-outline-success" title="PDF Receipt"><i class="bi bi-file-earmark-pdf"></i></a>`
                        : ''
                    }
                    ${
                      isAdmin && f.status === 'PENDING'
                        ? `<button class="btn btn-warning btn-approve-modal-trigger" data-id="${f.id}" title="Approve"><i class="bi bi-check-circle"></i></button>`
                        : ''
                    }
                  </div>
                </td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>

      <!-- Pagination Bar -->
      <div class="d-flex flex-column flex-md-row justify-content-between align-items-center gap-3 pt-3 mt-3 border-top">
        <div class="small text-muted text-center text-md-start">
          Showing <span class="fw-semibold text-dark">${fromItem}</span> to <span class="fw-semibold text-dark">${toItem}</span> of <span class="fw-semibold text-dark">${this.submissionsTotal}</span> submissions
          ${this.submissionsTotalPages > 1 ? `&bull; Page <span class="fw-semibold text-dark">${this.submissionsPage}</span> of <span class="fw-semibold text-dark">${this.submissionsTotalPages}</span>` : ''}
        </div>
        ${this.renderPaginationControls()}
      </div>
    `;

    this.attachSubmissionsListeners();
  }

  renderSuperAdminView(): string {
    const wa = this.whatsappStatus;
    return `
      <div class="row g-4">
        <!-- WhatsApp Web Integration Module -->
        <div class="col-12 col-lg-6">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
              <h5 class="mb-0 fw-bold"><i class="bi bi-whatsapp text-success me-2"></i> WhatsApp Web Connectivity (wwebjs)</h5>
              <span id="wa-status-badge" class="badge ${
                wa.status === 'CONNECTED' ? 'bg-success' : wa.status === 'PAIRING' ? 'bg-warning text-dark' : wa.status === 'INITIALIZING' ? 'bg-info text-dark' : 'bg-danger'
              } px-3 py-2">
                ${wa.status}
              </span>
            </div>
            <div class="card-body p-4 text-center">
              <p class="text-muted small mb-3">
                Used to automatically dispatch styled PDF receipts directly to the family's registered mobile number upon Admin approval.
              </p>

              <!-- QR Code Streaming Screen -->
              <div id="wa-qr-container" class="qr-container mb-3 mx-auto" style="max-width: 320px; min-height: 200px;">
                ${this.renderWhatsAppQrContent()}
              </div>

              <!-- Controls -->
              <div class="d-flex flex-wrap gap-2 justify-content-center align-items-center mb-2">
                <button type="button" class="btn btn-success btn-sm" id="btn-wa-connect" ${wa.status === 'CONNECTED' || wa.status === 'INITIALIZING' ? 'disabled' : ''}>
                  <i class="bi bi-play-fill me-1"></i> Initialize & Pair (Live)
                </button>
                <button type="button" class="btn btn-outline-success btn-sm" id="btn-wa-simulate" ${wa.status === 'CONNECTED' ? 'disabled' : ''}>
                  <i class="bi bi-laptop me-1"></i> Simulate Connect (Headless)
                </button>
                <button type="button" class="btn btn-outline-danger btn-sm" id="btn-wa-disconnect" ${wa.status === 'DISCONNECTED' ? 'disabled' : ''}>
                  <i class="bi bi-power me-1"></i> Disconnect
                </button>
                <button type="button" class="btn btn-primary btn-sm" id="btn-wa-refresh" ${this.isCheckingWhatsApp ? 'disabled' : ''} title="Check WhatsApp status and fetch latest QR code">
                  <i class="bi bi-arrow-repeat me-1 ${this.isCheckingWhatsApp ? 'spin' : ''}" id="wa-refresh-icon"></i> Refresh Status / QR
                </button>
              </div>
              <div class="mb-3">
                <small id="wa-last-checked" class="text-muted">${this.waLastCheckedText ? `Last checked: ${this.waLastCheckedText}` : ''}</small>
              </div>

              <!-- Test Dispatch -->
              <div class="mt-4 pt-3 border-top text-start">
                <label class="form-label small fw-semibold">Test WhatsApp Send:</label>
                <div class="input-group">
                  <input type="tel" class="form-control form-control-sm" id="wa-test-mobile" placeholder="Enter 10-digit mobile" />
                  <button class="btn btn-outline-success btn-sm" type="button" id="btn-wa-test-send">Send Test Message</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- User Management Module -->
        <div class="col-12 col-lg-6">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
              <h5 class="mb-0 fw-bold"><i class="bi bi-people-fill text-primary me-2"></i> User Management</h5>
              <button class="btn btn-sm btn-primary" id="btn-toggle-user-form">+ Add User</button>
            </div>
            <div class="card-body p-3">
              <!-- Create User Form -->
              <form id="create-user-form" class="mb-4 p-3 bg-light rounded border d-none">
                <h6 class="fw-bold mb-3">Create New User</h6>
                <div class="row g-2">
                  <div class="col-6">
                    <label class="form-label small">Username *</label>
                    <input type="text" class="form-control form-control-sm" id="new-username" required />
                  </div>
                  <div class="col-6">
                    <label class="form-label small">Password *</label>
                    <input type="password" class="form-control form-control-sm" id="new-password" required />
                  </div>
                  <div class="col-6">
                    <label class="form-label small">Role *</label>
                    <select class="form-select form-select-sm" id="new-role">
                      <option value="REGULAR_USER">REGULAR_USER (Form Entry)</option>
                      <option value="ADMIN">ADMIN (Approval & PDF)</option>
                      <option value="SUPER_ADMIN">SUPER_ADMIN (Full Access)</option>
                    </select>
                  </div>
                  <div class="col-6">
                    <label class="form-label small">Zone (for Regular User)</label>
                    <select class="form-select form-select-sm" id="new-zone-id">
                      <option value="">None / All Zones (for Admin)</option>
                      ${STANDARD_ZONES.map((z) => `<option value="${z.code}">${z.label}</option>`).join('')}
                    </select>
                  </div>
                  <div class="col-12 mt-2 text-end">
                    <button type="submit" class="btn btn-sm btn-primary">Save User</button>
                  </div>
                </div>
              </form>

              <!-- Users List Table -->
              <div class="table-responsive">
                <table class="table table-hover table-sm align-middle">
                  <thead>
                    <tr class="small">
                      <th>ID</th>
                      <th>Username</th>
                      <th>Role</th>
                      <th>Zone</th>
                      <th class="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody id="users-table-body">
                    ${this.usersList
                      .map(
                        (u) => `
                      <tr>
                        <td>#${u.id}</td>
                        <td class="fw-semibold">${u.username}</td>
                        <td><span class="badge ${
                          u.role === 'SUPER_ADMIN' ? 'bg-danger' : u.role === 'ADMIN' ? 'bg-warning text-dark' : 'bg-info text-dark'
                        }">${u.role}</span></td>
                        <td>${u.zone_id ? `<span class="badge bg-light text-dark border">${this.getZoneLabel(u.zone_id)}</span>` : '<span class="text-muted">All Zones</span>'}</td>
                        <td class="text-end text-nowrap">
                          <button class="btn btn-outline-secondary btn-sm p-0 px-2 me-1 btn-edit-user"
                            data-id="${u.id}"
                            data-username="${u.username}"
                            data-role="${u.role}"
                            data-zone="${u.zone_id || ''}"
                            title="Edit User">
                            <i class="bi bi-pencil-square me-1"></i>Edit
                          </button>
                          <button class="btn btn-outline-primary btn-sm p-0 px-2 me-1 btn-edit-user-password" data-id="${u.id}" data-username="${u.username}" title="Update Password">
                            <i class="bi bi-key-fill me-1"></i>Password
                          </button>
                          ${
                            u.username !== 'admin'
                              ? `<button class="btn btn-outline-danger btn-sm p-0 px-2 btn-delete-user" data-id="${u.id}" title="Delete User">×</button>`
                              : ''
                          }
                        </td>
                      </tr>
                    `
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- Legacy Data Migration (samaaj_db) Module -->
        <div class="col-12 mt-4">
          <div class="card border-0 shadow-sm">
            <div class="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
              <h5 class="mb-0 fw-bold">
                <i class="bi bi-database-fill-gear text-info me-2"></i> Legacy Database Migration (samaaj_db)
              </h5>
              <span class="badge bg-warning text-dark px-3 py-2">
                Unapproved by Default (PENDING)
              </span>
            </div>
            <div class="card-body p-4">
              <p class="text-muted mb-3">
                Directly imports existing member and family records from legacy MySQL database <code>samaaj_db</code> into <code>abkkpss_forms_db</code>.
                Automatically resolves schema mappings, converts Gujarati numerals (<code>૩૮૨૨૧૦</code> &rarr; <code>382210</code>), translates relationship names (<code>પોતે</code> &rarr; <code>Self</code>, <code>પત્ની</code> &rarr; <code>Wife</code>, etc.), normalizes 10-digit mobile numbers, resolves native taluka/district, and computes lifetime membership fees based on 18+ adult status (cutoff date: 31/12/2026).
                <strong>All imported records will be saved as PENDING (Unapproved).</strong>
              </p>

              <!-- Controls bar -->
              <div class="p-3 bg-light rounded border mb-4">
                <div class="row g-3 align-items-end">
                  <div class="col-12 col-md-3">
                    <label class="form-label small fw-bold">Import Limit</label>
                    <input type="number" class="form-control form-control-sm" id="mig-limit" placeholder="All (leave blank) or N" />
                    <small class="text-muted">e.g. enter 10 to test first 10 families</small>
                  </div>
                  <div class="col-12 col-md-4">
                    <div class="form-check">
                      <input class="form-check-input" type="checkbox" id="mig-skip-existing" checked />
                      <label class="form-check-label small fw-semibold" for="mig-skip-existing">
                        Skip existing families (match Zone & Family #)
                      </label>
                    </div>
                    <div class="form-check mt-1">
                      <input class="form-check-input" type="checkbox" id="mig-clean-first" />
                      <label class="form-check-label small fw-semibold text-danger" for="mig-clean-first">
                        <i class="bi bi-exclamation-triangle-fill me-1"></i> Wipe/clean existing target records before import
                      </label>
                    </div>
                  </div>
                  <div class="col-12 col-md-5 text-md-end d-flex gap-2 justify-content-md-end">
                    <button type="button" class="btn btn-outline-primary btn-sm px-3" id="btn-load-migration-preview" ${this.isLoadingMigrationPreview ? 'disabled' : ''}>
                      ${this.isLoadingMigrationPreview ? '<span class="spinner-border spinner-border-sm me-1"></span> Loading Preview...' : '<i class="bi bi-eye me-1"></i> Preview Mapping & Stats'}
                    </button>
                    <button type="button" class="btn btn-success btn-sm px-4 fw-bold" id="btn-run-migration" ${this.isExecutingMigration ? 'disabled' : ''}>
                      ${this.isExecutingMigration ? '<span class="spinner-border spinner-border-sm me-1"></span> Importing Data...' : '<i class="bi bi-cloud-arrow-down-fill me-1"></i> Execute Migration'}
                    </button>
                  </div>
                </div>
              </div>

              <!-- Execution Result Alert -->
              ${this.migrationResult ? `
                <div class="alert ${this.migrationResult.success ? 'alert-success' : 'alert-warning'} border mb-4">
                  <h6 class="alert-heading fw-bold mb-2">
                    <i class="bi bi-check-circle-fill me-1"></i> Migration Execution Completed in ${(this.migrationResult.durationMs / 1000).toFixed(2)}s
                  </h6>
                  <div class="row g-2 small">
                    <div class="col-6 col-md-3"><strong>Source Families:</strong> ${this.migrationResult.totalSourceFamilies}</div>
                    <div class="col-6 col-md-3"><strong>Imported Families:</strong> ${this.migrationResult.importedFamilies}</div>
                    <div class="col-6 col-md-3"><strong>Imported Members:</strong> ${this.migrationResult.importedMembers}</div>
                    <div class="col-6 col-md-3"><strong>Skipped (Existing):</strong> ${this.migrationResult.skippedFamilies}</div>
                  </div>
                  ${this.migrationResult.errors?.length > 0 ? `
                    <div class="mt-2 text-danger small">
                      <strong>Errors encountered:</strong> ${this.migrationResult.errors.join('; ')}
                    </div>
                  ` : ''}
                </div>
              ` : ''}

              <!-- Preview Stats Display -->
              ${this.migrationPreview ? `
                <div class="mb-4">
                  <h6 class="fw-bold text-primary mb-3"><i class="bi bi-bar-chart-line me-1"></i> Migration Preview Analysis</h6>
                  <div class="row g-3 mb-3">
                    <div class="col-6 col-md-3">
                      <div class="p-3 bg-light rounded text-center border">
                        <div class="fs-4 fw-bold text-dark">${this.migrationPreview.totalFamilies}</div>
                        <small class="text-muted text-uppercase fw-semibold">Total Families</small>
                      </div>
                    </div>
                    <div class="col-6 col-md-3">
                      <div class="p-3 bg-light rounded text-center border">
                        <div class="fs-4 fw-bold text-dark">${this.migrationPreview.totalMembers}</div>
                        <small class="text-muted text-uppercase fw-semibold">Total Members</small>
                      </div>
                    </div>
                    <div class="col-6 col-md-3">
                      <div class="p-3 bg-light rounded text-center border">
                        <div class="fs-4 fw-bold text-success">${this.migrationPreview.totalEstimatedAdults}</div>
                        <small class="text-muted text-uppercase fw-semibold">18+ Adults</small>
                      </div>
                    </div>
                    <div class="col-6 col-md-3">
                      <div class="p-3 bg-light rounded text-center border">
                        <div class="fs-4 fw-bold text-primary">₹${this.migrationPreview.totalEstimatedFee.toLocaleString('en-IN')}</div>
                        <small class="text-muted text-uppercase fw-semibold">Total Estimated Fee</small>
                      </div>
                    </div>
                  </div>

                  <!-- Zone Breakdown Table -->
                  <h6 class="fw-bold mb-2 small text-uppercase text-muted">Zone Breakdown</h6>
                  <div class="table-responsive mb-3 border rounded">
                    <table class="table table-sm table-striped mb-0 small align-middle">
                      <thead class="table-light">
                        <tr>
                          <th>Zone Code & Name</th>
                          <th class="text-center">Total Families</th>
                          <th class="text-center">Total Members</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${Object.entries(this.migrationPreview.zonesSummary || {})
                          .sort(([za], [zb]) => za.localeCompare(zb))
                          .map(([zCode, info]: [string, any]) => `
                            <tr>
                              <td class="fw-semibold"><span class="badge bg-primary me-2">${zCode}</span> ${this.getZoneLabel(zCode)} (${info.zoneName})</td>
                              <td class="text-center fw-bold">${info.familyCount}</td>
                              <td class="text-center">${info.memberCount}</td>
                            </tr>
                          `).join('')}
                      </tbody>
                    </table>
                  </div>

                  <!-- Sample Mapped Family Card -->
                  ${this.migrationPreview.sampleFamilies?.length > 0 ? `
                    <h6 class="fw-bold mb-2 small text-uppercase text-muted">Sample Mapped Record (Family #1)</h6>
                    <div class="border rounded p-3 bg-light small">
                      <div class="row g-2 mb-2">
                        <div class="col-md-3"><strong>Zone:</strong> ${this.getZoneLabel(this.migrationPreview.sampleFamilies[0].form.zone_number)}</div>
                        <div class="col-md-3"><strong>Family #:</strong> ${this.migrationPreview.sampleFamilies[0].form.family_number}</div>
                        <div class="col-md-3"><strong>Head of Family:</strong> ${this.migrationPreview.sampleFamilies[0].form.filler_name}</div>
                        <div class="col-md-3"><strong>WhatsApp Mobile:</strong> ${this.migrationPreview.sampleFamilies[0].form.filler_mobile}</div>
                        <div class="col-md-3"><strong>Native Place:</strong> ${this.migrationPreview.sampleFamilies[0].form.native_place}</div>
                        <div class="col-md-3"><strong>Taluka / District:</strong> ${this.migrationPreview.sampleFamilies[0].form.taluka} / ${this.migrationPreview.sampleFamilies[0].form.district}</div>
                        <div class="col-md-3"><strong>Gotra:</strong> ${this.migrationPreview.sampleFamilies[0].form.gotra}</div>
                        <div class="col-md-3"><strong>Status:</strong> <span class="badge bg-warning text-dark">${this.migrationPreview.sampleFamilies[0].form.status}</span></div>
                        <div class="col-12"><strong>Residential Address:</strong> ${this.migrationPreview.sampleFamilies[0].form.residential_address}</div>
                      </div>
                      <strong>Members (${this.migrationPreview.sampleFamilies[0].members.length}):</strong>
                      <div class="table-responsive mt-1">
                        <table class="table table-bordered table-sm bg-white mb-0" style="font-size: 0.82rem;">
                          <thead>
                            <tr class="table-secondary">
                              <th>#</th>
                              <th>Name</th>
                              <th>Relation</th>
                              <th>DOB</th>
                              <th>18+ Adult</th>
                              <th>Mobile</th>
                              <th>Education</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${this.migrationPreview.sampleFamilies[0].members.map((m: any) => `
                              <tr>
                                <td>${m.serial_no}</td>
                                <td class="fw-semibold">${m.name} ${m.is_main_member ? '<span class="badge bg-success ms-1">Head</span>' : ''}</td>
                                <td>${m.relation}</td>
                                <td>${m.dob || '-'}</td>
                                <td>${m.is_adult_18_plus ? '<span class="badge bg-success">Yes (₹500)</span>' : '<span class="badge bg-secondary">No</span>'}</td>
                                <td>${m.mobile_number || '-'}</td>
                                <td>${m.education || '-'}</td>
                              </tr>
                            `).join('')}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ` : ''}
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderSuperAdmin() {
    if (this.activeTab === 'superadmin') {
      const main = this.querySelector('main');
      if (main) main.innerHTML = this.renderSuperAdminView();
      this.attachSuperAdminListeners();
    }
  }

  renderPasswordModalContent(): string {
    if (!this.showPasswordModal || !this.passwordModalUser) return '';
    const user = this.passwordModalUser;
    const isSelf = this.isSelfPasswordUpdate;

    return `
      <div class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,0.5); overflow-y: auto; z-index: 1060;">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content border-0 shadow-lg">
            <div class="modal-header abkkpss-navbar text-white py-3">
              <h5 class="modal-title fw-bold">
                <i class="bi bi-key-fill text-warning me-2"></i>${isSelf ? 'Change Password' : 'Reset User Password'}
              </h5>
              <button type="button" class="btn-close btn-close-white" id="btn-close-pass-modal"></button>
            </div>
            <div class="modal-body p-4">
              <p class="text-muted small mb-3">
                ${
                  isSelf
                    ? `Change login password for your account (<strong class="text-dark">${user.username}</strong>).`
                    : `Update login password for user <strong class="text-dark">${user.username}</strong>.`
                }
              </p>

              ${
                this.passwordModalError
                  ? `<div class="alert alert-danger py-2 px-3 small">${this.passwordModalError}</div>`
                  : ''
              }
              ${
                this.passwordModalSuccess
                  ? `<div class="alert alert-success py-2 px-3 small">${this.passwordModalSuccess}</div>`
                  : ''
              }

              <form id="form-update-password">
                ${
                  isSelf
                    ? `
                <div class="mb-3">
                  <label class="form-label small fw-semibold">Current Password *</label>
                  <input type="password" class="form-control" id="modal-current-pass" placeholder="Enter current password" required />
                </div>`
                    : ''
                }
                <div class="mb-3">
                  <label class="form-label small fw-semibold">New Password *</label>
                  <input type="password" class="form-control" id="modal-new-pass" minlength="4" placeholder="At least 4 characters" required />
                </div>
                <div class="mb-3">
                  <label class="form-label small fw-semibold">Confirm Password *</label>
                  <input type="password" class="form-control" id="modal-confirm-pass" minlength="4" placeholder="Re-enter new password" required />
                </div>
                <div class="form-check mb-3">
                  <input class="form-check-input" type="checkbox" id="modal-show-pass" />
                  <label class="form-check-label small text-muted" for="modal-show-pass">Show Passwords</label>
                </div>

                <div class="d-flex justify-content-end gap-2 pt-2 border-top">
                  <button type="button" class="btn btn-secondary touch-btn" id="btn-cancel-pass-modal" ${this.isSavingPassword ? 'disabled' : ''}>Cancel</button>
                  <button type="submit" class="btn btn-primary touch-btn" id="btn-submit-pass" ${this.isSavingPassword ? 'disabled' : ''}>
                    ${this.isSavingPassword ? '<span class="spinner-border spinner-border-sm me-1"></span>Saving...' : '<i class="bi bi-check2 me-1"></i>Update Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderEditUserModalContent(): string {
    if (!this.showEditUserModal || !this.editModalUser) return '';
    const user = this.editModalUser;

    return `
      <div class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,0.5); overflow-y: auto; z-index: 1060;">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content border-0 shadow-lg">
            <div class="modal-header abkkpss-navbar text-white py-3">
              <h5 class="modal-title fw-bold">
                <i class="bi bi-person-gear text-warning me-2"></i>Edit User Account
              </h5>
              <button type="button" class="btn-close btn-close-white" id="btn-close-edit-user-modal"></button>
            </div>
            <div class="modal-body p-4">
              <p class="text-muted small mb-3">
                Update account details for user <strong class="text-dark">#${user.id} (${user.username})</strong>.
              </p>

              ${
                this.editModalError
                  ? `<div class="alert alert-danger py-2 px-3 small">${this.editModalError}</div>`
                  : ''
              }
              ${
                this.editModalSuccess
                  ? `<div class="alert alert-success py-2 px-3 small">${this.editModalSuccess}</div>`
                  : ''
              }

              <form id="form-edit-user">
                <div class="mb-3">
                  <label class="form-label small fw-semibold">Username *</label>
                  <input type="text" class="form-control" id="modal-edit-username" value="${user.username}" minlength="3" required />
                </div>
                <div class="mb-3">
                  <label class="form-label small fw-semibold">Role *</label>
                  <select class="form-select form-select-sm" id="modal-edit-role" required>
                    <option value="REGULAR_USER" ${user.role === 'REGULAR_USER' ? 'selected' : ''}>REGULAR_USER (Form Entry & View)</option>
                    <option value="ADMIN" ${user.role === 'ADMIN' ? 'selected' : ''}>ADMIN (Approval & PDF)</option>
                    <option value="SUPER_ADMIN" ${user.role === 'SUPER_ADMIN' ? 'selected' : ''}>SUPER_ADMIN (Full Access)</option>
                  </select>
                </div>
                <div class="mb-3">
                  <label class="form-label small fw-semibold">Zone (for Regular User)</label>
                  <select class="form-select form-select-sm" id="modal-edit-zone">
                    <option value="" ${!user.zone_id ? 'selected' : ''}>None / All Zones (for Admin)</option>
                    ${STANDARD_ZONES.map((z) => `<option value="${z.code}" ${user.zone_id === z.code ? 'selected' : ''}>${z.label}</option>`).join('')}
                  </select>
                </div>

                <div class="d-flex justify-content-end gap-2 pt-2 border-top">
                  <button type="button" class="btn btn-secondary touch-btn" id="btn-cancel-edit-user-modal" ${this.isSavingEditUser ? 'disabled' : ''}>Cancel</button>
                  <button type="submit" class="btn btn-primary touch-btn" id="btn-submit-edit-user" ${this.isSavingEditUser ? 'disabled' : ''}>
                    ${this.isSavingEditUser ? '<span class="spinner-border spinner-border-sm me-1"></span>Saving...' : '<i class="bi bi-check2 me-1"></i>Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderModalContent(): string {
    if (!this.showApprovalModal || !this.selectedSubmission) return '';
    const { form, members } = this.selectedSubmission;
    const isPending = form.status === 'PENDING';
    const isAdmin = this.currentUser?.role === 'ADMIN' || this.currentUser?.role === 'SUPER_ADMIN';

    return `
      <div class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,0.5); overflow-y: auto;">
        <div class="modal-dialog modal-dialog-centered modal-lg">
          <div class="modal-content border-0 shadow-lg">
            <div class="modal-header abkkpss-navbar text-white py-3">
              <h5 class="modal-title fw-bold">
                <i class="bi bi-file-text me-2"></i> Form Details & Approval - #${form.id}
              </h5>
              <button type="button" class="btn-close btn-close-white" id="btn-close-modal"></button>
            </div>
            <div class="modal-body p-4">
              <!-- Header Badges -->
              <div class="d-flex flex-wrap justify-content-between align-items-center mb-3 pb-2 border-bottom">
                <div>
                  <span class="badge bg-primary fs-6 me-1">${this.getZoneLabel(form.zone_number)}</span>
                  <span class="badge bg-secondary fs-6 me-1">Family #${form.family_number}</span>
                  <span class="badge ${form.status === 'APPROVED' ? 'bg-success' : 'bg-warning text-dark'} fs-6">
                    ${form.status}
                  </span>
                </div>
                <div class="text-end">
                  <div class="fw-bold fs-5 text-primary">₹${form.total_amount}</div>
                  <small class="text-muted">18+ Members: ${form.total_adults_count} (₹500 × ${form.total_adults_count})</small>
                </div>
              </div>

              <!-- General details grid -->
              <div class="row g-2 mb-3 small">
                <div class="col-6 col-md-3"><strong>Main Member:</strong> ${form.filler_name}</div>
                <div class="col-6 col-md-3"><strong>WhatsApp Mobile:</strong> ${form.filler_mobile}</div>
                <div class="col-6 col-md-3"><strong>Surname/Gotra:</strong> ${form.surname} (${form.gotra})</div>
                <div class="col-6 col-md-3"><strong>Native:</strong> ${form.native_place || '-'}</div>
                <div class="col-6 col-md-3"><strong>Current City:</strong> ${form.city_name || form.current_city_or_place || '-'}</div>
                <div class="col-6 col-md-3"><strong>Pincode:</strong> ${form.pincode}</div>
                <div class="col-12 col-md-6"><strong>Address:</strong> ${form.residential_address || [form.address_line_1, form.address_line_2, form.city_name, form.state_name, form.country_name, form.pincode].filter(Boolean).join(', ')}</div>
                ${(form.firm_name || form.firm_address || form.firm_address_line_1) ? `<div class="col-12 col-md-6"><strong>Firm:</strong> ${form.firm_name ? `${form.firm_name} - ` : ''}${form.firm_address || [form.firm_address_line_1, form.firm_address_line_2, form.firm_city_name, form.firm_state_name, form.firm_country_name, form.firm_postal_code].filter(Boolean).join(', ')}</div>` : ''}
                ${form.receipt_number ? `<div class="col-12 text-success fw-bold"><strong>Receipt No:</strong> ${form.receipt_number}</div>` : ''}
              </div>

              <!-- Live Embedded Receipt Preview (if activated) -->
              ${
                this.previewReceiptUrl
                  ? `
                <div class="card border-primary mb-3 shadow-sm">
                  <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center py-2">
                    <span class="fw-bold"><i class="bi bi-eye-fill me-1"></i> Live Receipt Preview</span>
                    <div class="d-flex gap-2">
                      <a href="${this.previewReceiptUrl}" target="_blank" class="btn btn-sm btn-light py-0 px-2 text-primary fw-semibold" title="Open in New Tab">
                        <i class="bi bi-box-arrow-up-right me-1"></i> Full Window
                      </a>
                      <button type="button" class="btn btn-sm btn-close btn-close-white" id="btn-close-receipt-preview" aria-label="Close"></button>
                    </div>
                  </div>
                  <div class="card-body p-0" style="height: 480px;">
                    <iframe src="${this.previewReceiptUrl}" style="width: 100%; height: 100%; border: none;"></iframe>
                  </div>
                </div>
              `
                  : ''
              }

              <!-- Members Table with Fixed Member ID and Receipt Preview Icon -->
              <div class="d-flex justify-content-between align-items-center border-bottom pb-1 mb-2">
                <h6 class="fw-bold mb-0">Members List & ID Allocation:</h6>
                ${
                  form.receipt_number
                    ? `
                  <button type="button" class="btn btn-outline-primary btn-sm btn-preview-receipt" data-url="/api/forms/${form.id}/receipt">
                    <i class="bi bi-eye-fill me-1"></i> Preview Full Family Receipt
                  </button>
                `
                    : ''
                }
              </div>
              <div class="table-responsive mb-3">
                <table class="table table-sm table-bordered align-middle">
                  <thead class="table-light small">
                    <tr>
                      <th style="width: 30px;">#</th>
                      <th>Member Name</th>
                      <th>Relation</th>
                      <th>DOB</th>
                      <th>18+ Status</th>
                      <th>Member ID Format</th>
                      <th style="width: 50px;" class="text-center">Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${members
                      .map(
                        (m: any, idx: number) => `
                      <tr>
                        <td class="text-center">${idx + 1}</td>
                        <td class="fw-semibold">
                          ${m.name}
                          ${m.is_main_member ? '<span class="badge bg-primary-subtle text-primary ms-1">Main</span>' : ''}
                        </td>
                        <td>${m.relation}</td>
                        <td>${m.dob}</td>
                        <td>${m.is_adult_18_plus ? '<span class="badge bg-success">YES (18+)</span>' : '<span class="badge bg-secondary">NO (< 18)</span>'}</td>
                        <td class="fw-bold text-primary">
                          ${m.fixed_member_number || `${String(form.zone_number).padStart(2, '0')}/${String(form.family_number).padStart(2, '0')}/${String(idx + 1).padStart(2, '0')}-XXXXX (On Approval)`}
                        </td>
                        <td class="text-center">
                          ${
                            form.status === 'APPROVED'
                              ? `<button type="button" class="btn btn-sm btn-outline-primary p-1 btn-preview-receipt" data-url="/api/forms/${form.id}/receipt?memberId=${m.id}" title="Preview Member Receipt">
                                  <i class="bi bi-eye-fill"></i>
                                </button>`
                              : '<span class="text-muted small">-</span>'
                          }
                        </td>
                      </tr>
                    `
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>

              ${
                form.receipt_number
                  ? `
                <div class="alert alert-success d-flex justify-content-between align-items-center">
                  <div>
                    <i class="bi bi-check-circle-fill me-2 fs-5"></i> All member receipts dispatched to Main Member WhatsApp (${form.filler_mobile}).
                  </div>
                  <div class="d-flex gap-2">
                    <button type="button" class="btn btn-primary btn-sm btn-preview-receipt" data-url="/api/forms/${form.id}/receipt">
                      <i class="bi bi-eye-fill me-1"></i> Preview Receipt
                    </button>
                    <a href="/api/forms/${form.id}/receipt" target="_blank" class="btn btn-outline-success btn-sm">
                      <i class="bi bi-file-earmark-pdf me-1"></i> Download PDF
                    </a>
                  </div>
                </div>
              `
                  : ''
              }
            </div>
            <div class="modal-footer bg-light">
              <button type="button" class="btn btn-secondary touch-btn" id="btn-close-modal-footer">Close</button>
              ${
                isAdmin && isPending
                  ? `
                <button type="button" class="btn btn-danger touch-btn" id="btn-reject-submission" data-id="${form.id}">
                  <i class="bi bi-x-circle me-1"></i> Reject Form
                </button>
                <button type="button" class="btn btn-success touch-btn fw-bold px-4" id="btn-approve-submission" data-id="${form.id}">
                  <i class="bi bi-check2-circle me-1"></i> Approve & Generate Receipt
                </button>
              `
                  : ''
              }
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // --- EVENT LISTENERS ---
  attachAuthListeners() {
    const form = this.querySelector('#login-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const u = (this.querySelector('#login-username') as HTMLInputElement).value;
        const p = (this.querySelector('#login-password') as HTMLInputElement).value;
        this.login(u, p);
      });
    }

    this.querySelectorAll('.quick-login').forEach((btn) => {
      btn.addEventListener('click', () => {
        const u = btn.getAttribute('data-u')!;
        const p = btn.getAttribute('data-p')!;
        this.login(u, p);
      });
    });
  }

  attachGlobalListeners() {
    this.querySelector('#btn-logout')?.addEventListener('click', () => this.logout());

    this.querySelector('#btn-change-own-password')?.addEventListener('click', () => {
      if (this.currentUser) {
        this.openPasswordModal(this.currentUser.id, this.currentUser.username, true);
      }
    });

    this.querySelector('#tab-form')?.addEventListener('click', () => {
      this.activeTab = 'form';
      this.render();
    });

    this.querySelector('#tab-submissions')?.addEventListener('click', () => {
      this.activeTab = 'submissions';
      this.render();
      this.loadSubmissions();
    });

    this.querySelector('#tab-superadmin')?.addEventListener('click', () => {
      this.activeTab = 'superadmin';
      this.render();
      this.loadUsers();
      this.loadWhatsAppStatus(false);
    });

    if (this.activeTab === 'form') {
      this.attachFormListeners();
    } else if (this.activeTab === 'submissions') {
      this.attachSubmissionsListeners();
    } else if (this.activeTab === 'superadmin') {
      this.attachSuperAdminListeners();
    }

    this.attachModalListeners();
  }

  attachFormListeners() {
    const entryForm = this.querySelector('#abkkpss-entry-form');
    entryForm?.addEventListener('submit', (e) => this.submitForm(e));

    this.querySelector('#btn-fetch-family')?.addEventListener('click', () => this.fetchExistingFamily());
    this.querySelector('#btn-add-member')?.addEventListener('click', () => this.addMember());

    // Bind inputs to state
    const bindField = (id: string, prop: keyof FormInput) => {
      const el = this.querySelector(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      const syncVal = () => {
        (this.formData as any)[prop] = el.value;
      };
      el?.addEventListener('input', syncVal);
      el?.addEventListener('change', syncVal);
    };

    bindField('#field-zone-number', 'zone_number');
    bindField('#field-family-number', 'family_number');
    bindField('#field-surname', 'surname');
    bindField('#field-gotra', 'gotra');
    bindField('#field-native-place', 'native_place');
    bindField('#field-payment-mode', 'payment_mode');

    // Residential Address
    bindField('#field-address-line-1', 'address_line_1');
    bindField('#field-address-line-2', 'address_line_2');
    bindField('#field-city-name', 'city_name');
    bindField('#field-state-name', 'state_name');
    bindField('#field-country-name', 'country_name');
    bindField('#field-pincode', 'pincode');

    // Firm Details
    bindField('#field-firm-name', 'firm_name');
    bindField('#field-firm-postal-code', 'firm_postal_code');
    bindField('#field-firm-address-line-1', 'firm_address_line_1');
    bindField('#field-firm-address-line-2', 'firm_address_line_2');
    bindField('#field-firm-city-name', 'firm_city_name');
    bindField('#field-firm-state-name', 'firm_state_name');
    bindField('#field-firm-country-name', 'firm_country_name');

    // When surname input changes, auto-populate empty member surnames
    const surnameEl = this.querySelector('#field-surname') as HTMLInputElement;
    surnameEl?.addEventListener('input', () => {
      const val = surnameEl.value;
      this.formData.surname = val;
      this.formData.members.forEach((m) => {
        m.last_name = val;
        m.name = [m.first_name, m.middle_name, m.last_name].filter(Boolean).join(' ');
      });
      const main = this.formData.members.find((m) => m.is_main_member) || this.formData.members[0];
      if (main) {
        this.formData.filler_name = main.name;
      }
    });

    // Main Member Radio selection
    this.querySelectorAll('.member-main-radio').forEach((radio) => {
      radio.addEventListener('change', () => {
        const idx = parseInt(radio.getAttribute('data-index')!, 10);
        this.formData.members.forEach((m, i) => {
          m.is_main_member = i === idx;
        });
        const main = this.formData.members[idx];
        if (main) {
          this.formData.filler_name = main.name || [main.first_name, main.middle_name, this.formData.surname].filter(Boolean).join(' ');
          this.formData.filler_mobile = main.mobile_number || '';
        }
        this.render();
      });
    });

    // Remove member buttons
    this.querySelectorAll('.btn-remove-member').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-index')!, 10);
        this.removeMember(idx);
      });
    });

    // Member text/select inputs
    this.querySelectorAll('.member-input').forEach((input) => {
      input.addEventListener('input', (e: any) => {
        const idx = parseInt(input.getAttribute('data-index')!, 10);
        const field = input.getAttribute('data-field')!;
        (this.formData.members[idx] as any)[field] = e.target.value;
        const m = this.formData.members[idx];
        if (field === 'first_name' || field === 'middle_name') {
          m.last_name = this.formData.surname;
          m.name = [m.first_name, m.middle_name, this.formData.surname].filter(Boolean).join(' ');
          if (m.is_main_member) {
            this.formData.filler_name = m.name;
          }
        }
      });
    });

    // Mobile inputs (+91 auto-prefix & 10 digits sanitize)
    this.querySelectorAll('.member-mobile-input').forEach((input) => {
      input.addEventListener('input', (e: any) => {
        const idx = parseInt(input.getAttribute('data-index')!, 10);
        const raw = e.target.value;
        const digits = this.extract10Digits(raw);
        e.target.value = digits;
        const formatted = digits ? `+91 ${digits}` : '';
        this.formData.members[idx].mobile_number = formatted;
        if (this.formData.members[idx].is_main_member) {
          this.formData.filler_mobile = formatted;
        }
      });
    });

    // Member DOB inputs (triggers automatic 18+ calculation and updates read-only label)
    this.querySelectorAll('.member-dob-input').forEach((input) => {
      const handleDob = (e: any) => {
        const idx = parseInt(input.getAttribute('data-index')!, 10);
        const val = e.target.value;
        this.formData.members[idx].dob = val;
        // Evaluate 18+ based on 31/12/2026 cutoff rule
        const isAdult = this.evaluateAdult(val);
        this.formData.members[idx].is_adult_18_plus = isAdult;

        // Update read-only badges in mobile cards and desktop table
        this.querySelectorAll(`.member-adult-badge[data-index="${idx}"]`).forEach((el) => {
          el.className = `badge ${isAdult ? 'bg-success' : 'bg-secondary'} member-adult-badge px-2 py-1`;
          el.textContent = isAdult ? 'YES (18+)' : 'NO (< 18)';
        });
        this.querySelectorAll(`.table .member-adult-badge[data-index="${idx}"]`).forEach((el) => {
          el.className = `badge ${isAdult ? 'bg-success' : 'bg-secondary'} member-adult-badge`;
          el.textContent = isAdult ? 'YES' : 'NO';
        });

        const card = this.querySelector(`#member-collapse-${idx}`)?.closest('.member-card');
        if (card) {
          if (isAdult) card.classList.add('is-adult');
          else card.classList.remove('is-adult');
        }

        // Update fee counters display
        this.updateCountersDisplay();
      };
      input.addEventListener('input', handleDob);
      input.addEventListener('change', handleDob);
    });

    // Cancel edit and close banner buttons
    this.querySelector('#btn-close-success-banner')?.addEventListener('click', () => {
      this.successBannerMessage = null;
      this.render();
    });
    this.querySelector('#btn-cancel-edit')?.addEventListener('click', () => this.cancelEdit());
    this.querySelector('#btn-cancel-edit-bar')?.addEventListener('click', () => this.cancelEdit());
  }

  updateCountersDisplay() {
    const totalAdults = this.get18PlusCount();
    const totalFee = this.getTotalAmount();
    const countEl = this.querySelector('#adults-count-display');
    const feeEl = this.querySelector('#total-fee-display');
    if (countEl) countEl.textContent = String(totalAdults);
    if (feeEl) feeEl.textContent = totalFee.toLocaleString('en-IN');
  }

  attachSubmissionsListeners() {
    this.querySelectorAll('.btn-filter').forEach((btn) => {
      (btn as HTMLElement).onclick = () => {
        this.submissionsFilter = btn.getAttribute('data-filter') as any;
        this.submissionsPage = 1;
        this.loadSubmissions();
        this.querySelectorAll('.btn-filter').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      };
    });

    const pageSizeSelect = this.querySelector('#submissions-page-size') as HTMLSelectElement;
    if (pageSizeSelect) {
      pageSizeSelect.onchange = () => {
        this.submissionsPageSize = parseInt(pageSizeSelect.value, 10) || 10;
        this.submissionsPage = 1;
        this.loadSubmissions();
      };
    }

    const searchInput = this.querySelector('#search-submissions-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.oninput = (e: any) => {
        this.submissionsSearch = e.target.value;
        if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = setTimeout(() => {
          this.submissionsPage = 1;
          this.loadSubmissions();
        }, 300);
      };
    }

    this.querySelectorAll('.btn-page').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const page = parseInt(btn.getAttribute('data-page')!, 10);
        if (page && page !== this.submissionsPage && page >= 1 && page <= this.submissionsTotalPages) {
          this.loadSubmissions(page);
        }
      });
    });

    this.querySelectorAll('.btn-view-submission').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id')!, 10);
        this.openApprovalModal(id);
      });
    });

    this.querySelectorAll('.btn-edit-submission').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id')!, 10);
        this.startEditForm(id);
      });
    });

    this.querySelectorAll('.btn-approve-modal-trigger').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id')!, 10);
        this.openApprovalModal(id);
      });
    });

    this.querySelectorAll('a[href*="/receipt"]').forEach((link) => {
      link.addEventListener('click', () => {
        this.showLoading('Fetching and generating receipt PDF...', 'Receipt Fetch');
        setTimeout(() => this.hideLoading(), 2000);
      });
    });
  }

  attachModalListeners() {
    const closeModal = () => {
      this.showApprovalModal = false;
      this.previewReceiptUrl = null;
      this.render();
    };

    this.querySelector('#btn-close-modal')?.addEventListener('click', closeModal);
    this.querySelector('#btn-close-modal-footer')?.addEventListener('click', closeModal);

    // Live Receipt Preview buttons and close button
    this.querySelectorAll('.btn-preview-receipt').forEach((btn) => {
      btn.addEventListener('click', () => {
        const url = btn.getAttribute('data-url');
        if (url) {
          this.showLoading('Generating and loading receipt preview...', 'Receipt Preview');
          this.previewReceiptUrl = url;
          this.render();
          setTimeout(() => {
            const iframe = this.querySelector('iframe');
            if (iframe) {
              iframe.onload = () => this.hideLoading();
              iframe.onerror = () => this.hideLoading();
              setTimeout(() => this.hideLoading(), 3000);
            } else {
              this.hideLoading();
            }
          }, 50);
        }
      });
    });

    this.querySelector('#btn-close-receipt-preview')?.addEventListener('click', () => {
      this.previewReceiptUrl = null;
      this.render();
    });

    this.querySelector('#btn-approve-submission')?.addEventListener('click', (e: any) => {
      const id = parseInt(e.target.getAttribute('data-id') || e.target.closest('button').getAttribute('data-id'), 10);
      this.approveSubmission(id);
    });

    this.querySelector('#btn-reject-submission')?.addEventListener('click', (e: any) => {
      const id = parseInt(e.target.getAttribute('data-id') || e.target.closest('button').getAttribute('data-id'), 10);
      this.rejectSubmission(id);
    });

    // Password Update Modal Listeners
    this.querySelector('#btn-close-pass-modal')?.addEventListener('click', () => this.closePasswordModal());
    this.querySelector('#btn-cancel-pass-modal')?.addEventListener('click', () => this.closePasswordModal());

    const showPassCheckbox = this.querySelector('#modal-show-pass') as HTMLInputElement;
    showPassCheckbox?.addEventListener('change', () => {
      const currentPassInput = this.querySelector('#modal-current-pass') as HTMLInputElement;
      const newPassInput = this.querySelector('#modal-new-pass') as HTMLInputElement;
      const confirmPassInput = this.querySelector('#modal-confirm-pass') as HTMLInputElement;
      const type = showPassCheckbox.checked ? 'text' : 'password';
      if (currentPassInput) currentPassInput.type = type;
      if (newPassInput) newPassInput.type = type;
      if (confirmPassInput) confirmPassInput.type = type;
    });

    const passForm = this.querySelector('#form-update-password');
    passForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const currentPass = (this.querySelector('#modal-current-pass') as HTMLInputElement)?.value;
      const newPass = (this.querySelector('#modal-new-pass') as HTMLInputElement)?.value;
      const confirmPass = (this.querySelector('#modal-confirm-pass') as HTMLInputElement)?.value;

      if (this.isSelfPasswordUpdate && !currentPass) {
        this.passwordModalError = 'Current password is required';
        this.render();
        return;
      }

      if (!newPass || newPass.trim().length < 4) {
        this.passwordModalError = 'Password must be at least 4 characters long';
        this.render();
        return;
      }
      if (newPass !== confirmPass) {
        this.passwordModalError = 'Passwords do not match';
        this.render();
        return;
      }

      if (this.isSelfPasswordUpdate) {
        this.updateSelfPassword(currentPass, newPass.trim());
      } else if (this.passwordModalUser) {
        this.updateUserPassword(this.passwordModalUser.id, newPass.trim());
      }
    });

    // Edit User Modal Listeners
    this.querySelector('#btn-close-edit-user-modal')?.addEventListener('click', () => this.closeEditUserModal());
    this.querySelector('#btn-cancel-edit-user-modal')?.addEventListener('click', () => this.closeEditUserModal());

    const editUserForm = this.querySelector('#form-edit-user');
    editUserForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!this.editModalUser) return;
      const u = (this.querySelector('#modal-edit-username') as HTMLInputElement)?.value?.trim();
      const r = (this.querySelector('#modal-edit-role') as HTMLSelectElement)?.value;
      const z = (this.querySelector('#modal-edit-zone') as HTMLSelectElement)?.value;

      if (!u || u.length < 3) {
        this.editModalError = 'Username must be at least 3 characters long';
        this.render();
        return;
      }

      this.updateUserDetails(this.editModalUser.id, u, r, z || null);
    });
  }

  attachSuperAdminListeners() {
    this.querySelector('#btn-toggle-user-form')?.addEventListener('click', () => {
      const form = this.querySelector('#create-user-form');
      form?.classList.toggle('d-none');
    });

    const userForm = this.querySelector('#create-user-form');
    userForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const u = (this.querySelector('#new-username') as HTMLInputElement).value;
      const p = (this.querySelector('#new-password') as HTMLInputElement).value;
      const r = (this.querySelector('#new-role') as HTMLSelectElement).value;
      const z = (this.querySelector('#new-zone-id') as HTMLInputElement).value;
      this.createUser(u, p, r, z);
    });

    this.querySelectorAll('.btn-edit-user').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id')!, 10);
        const username = btn.getAttribute('data-username') || '';
        const role = btn.getAttribute('data-role') || 'REGULAR_USER';
        const zone_id = btn.getAttribute('data-zone') || null;
        this.openEditUserModal({ id, username, role, zone_id });
      });
    });

    this.querySelectorAll('.btn-edit-user-password').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id')!, 10);
        const username = btn.getAttribute('data-username') || 'User';
        this.openPasswordModal(id, username);
      });
    });

    this.querySelectorAll('.btn-delete-user').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id')!, 10);
        this.deleteUser(id);
      });
    });

    this.querySelector('#btn-wa-connect')?.addEventListener('click', () => this.connectWhatsApp());
    this.querySelector('#btn-wa-simulate')?.addEventListener('click', () => this.simulateConnectWhatsApp());
    this.querySelector('#btn-wa-disconnect')?.addEventListener('click', () => this.disconnectWhatsApp());
    this.querySelector('#btn-wa-refresh')?.addEventListener('click', () => this.loadWhatsAppStatus(true));

    this.querySelector('#btn-wa-test-send')?.addEventListener('click', async () => {
      const mobile = (this.querySelector('#wa-test-mobile') as HTMLInputElement).value;
      if (!mobile) {
        alert('Please enter a mobile number');
        return;
      }
      return this.withLoading(async () => {
        try {
          const res = await fetch('/api/whatsapp/test-send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.token}`,
            },
            body: JSON.stringify({ mobile }),
          });
          const data = await res.json();
          alert(data.data?.message || 'Test message processed');
        } catch (err: any) {
          alert('Send failed: ' + err.message);
        }
      }, 'Dispatching WhatsApp test message...', 'WhatsApp Delivery');
    });

    // Legacy Data Migration Listeners
    this.querySelector('#btn-load-migration-preview')?.addEventListener('click', () => this.loadMigrationPreview());
    this.querySelector('#btn-run-migration')?.addEventListener('click', () => this.executeMigration());
  }

  async loadMigrationPreview() {
    this.isLoadingMigrationPreview = true;
    this.render();
    return this.withLoading(async () => {
      try {
        const res = await fetch('/api/forms/import/samaaj/preview', {
          headers: { Authorization: `Bearer ${this.token}` },
        });
        const data = await res.json();
        if (data.data?.success && data.data?.preview) {
          this.migrationPreview = data.data.preview;
        } else {
          alert(data.data?.error || data.error || 'Failed to load migration preview');
        }
      } catch (err: any) {
        alert('Failed to connect or load preview: ' + err.message);
      } finally {
        this.isLoadingMigrationPreview = false;
        this.render();
      }
    }, 'Analyzing legacy database...', 'Migration Analysis');
  }

  async executeMigration() {
    const cleanCheck = (this.querySelector('#mig-clean-first') as HTMLInputElement)?.checked || false;
    const skipCheck = (this.querySelector('#mig-skip-existing') as HTMLInputElement)?.checked ?? true;
    const limitVal = (this.querySelector('#mig-limit') as HTMLInputElement)?.value;
    const limit = limitVal ? parseInt(limitVal, 10) : undefined;

    if (cleanCheck) {
      const confirmClean = confirm(
        '⚠️ WARNING: You have selected "Wipe/clean existing target records before import". This will DELETE all existing forms and members in abkkpss_forms_db! Are you sure you want to proceed?'
      );
      if (!confirmClean) return;
    } else {
      const confirmRun = confirm(
        `Are you sure you want to run the migration from samaaj_db? All records will be imported as Unapproved (PENDING).${
          limit ? ` Limit: ${limit} families.` : ''
        }`
      );
      if (!confirmRun) return;
    }

    this.isExecutingMigration = true;
    this.migrationResult = null;
    this.render();

    return this.withLoading(async () => {
      try {
        const res = await fetch('/api/forms/import/samaaj/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.token}`,
          },
          body: JSON.stringify({
            cleanExisting: cleanCheck,
            skipExisting: skipCheck,
            limit,
          }),
        });
        const data = await res.json();
        if (data.data?.result) {
          this.migrationResult = data.data.result;
          this.loadSubmissions(); // refresh submissions in background
        } else {
          alert(data.data?.error || data.error || 'Migration execution failed');
        }
      } catch (err: any) {
        alert('Migration error: ' + err.message);
      } finally {
        this.isExecutingMigration = false;
        this.render();
      }
    }, 'Executing database migration... Please wait, this may take a moment.', 'Data Migration');
  }
}

// Define the custom web component
if (!customElements.get('abkkpss-app')) {
  customElements.define('abkkpss-app', AbkkpssAppElement);
}
