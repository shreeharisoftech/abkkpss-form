import { AcWebController, AcWebRoute, AcWebResponse, IAcWebRequestHandlerArgs } from 'ac-web';
import { DbService } from '../database/db-service';
import { FormStatus, UserRole, FormRow } from '../database/schema';
import { calculateFormFees } from '../services/fee-calculator';
import { requireAuth } from '../middlewares/auth.middleware';
import { SamaajImporter } from '../services/samaaj-importer';

@AcWebController()
@AcWebRoute({ path: '/api/forms' })
export class FormsController {
  @AcWebRoute({ path: '', method: 'post' })
  async createForm(args: IAcWebRequestHandlerArgs | any): Promise<AcWebResponse> {
    const request = args?.request || args;
    const authResult = requireAuth(request);
    if ('responseCode' in authResult) return authResult as AcWebResponse;
    const { user } = authResult;

    const body = request.post || {};
    const {
      zone_number,
      family_number,
      // Residential Address
      address_line_1 = '',
      address_line_2 = '',
      city_name = '',
      state_name = 'Gujarat',
      country_name = 'India',
      pincode = '',
      current_city_or_place,
      residential_address,

      // Firm Details
      firm_name = '',
      firm_address_line_1 = '',
      firm_address_line_2 = '',
      firm_city_name = '',
      firm_state_name = 'Gujarat',
      firm_country_name = 'India',
      firm_postal_code = '',
      firm_address,

      // Native Details (village removed)
      native_place,
      surname,
      gotra,
      taluka,
      district,

      filler_name,
      filler_mobile,
      payment_mode = 'Cash',
      members = [],
    } = body;

    // Resolve filler name and mobile:
    // Automatically derive from the designated Main Family Member (default Member #1)
    const mainMember = members.find((m: any) => m.is_main_member === true || m.is_main_member === 1) || members[0] || {};
    const mainMemberFullName = (
      mainMember.name ||
      [mainMember.first_name, mainMember.middle_name, mainMember.last_name || surname]
        .filter(Boolean)
        .join(' ')
    ).trim();

    const effectiveFillerName = (filler_name || mainMemberFullName || '').trim();

    // Mobile number normalization and validation for Main Member / Filler
    let rawMobile = String(filler_mobile || mainMember.mobile_number || '').trim();
    let cleanMobileDigits = rawMobile.replace(/\D/g, '');
    if (cleanMobileDigits.startsWith('91') && cleanMobileDigits.length === 12) {
      cleanMobileDigits = cleanMobileDigits.substring(2);
    }

    // Validation
    if (!zone_number || !family_number) {
      return AcWebResponse.json({
        data: { success: false, error: 'Zone number and Family number are required' },
        responseCode: 400,
      });
    }

    if (!effectiveFillerName) {
      return AcWebResponse.json({
        data: { success: false, error: 'Head of Family Name (Member 1) is required' },
        responseCode: 400,
      });
    }

    if (!cleanMobileDigits || cleanMobileDigits.length !== 10) {
      return AcWebResponse.json({
        data: { success: false, error: 'A valid 10-digit mobile number is required (for Member 1 / Head of Family)' },
        responseCode: 400,
      });
    }

    const effectiveFillerMobile = `+91 ${cleanMobileDigits}`;

    // Role-based zone restriction for regular users
    if (user.role === UserRole.REGULAR_USER && user.zoneId) {
      if (zone_number.toString().trim() !== user.zoneId.toString().trim()) {
        return AcWebResponse.json({
          data: { success: false, error: `Regular users are restricted to submitting for Zone ${user.zoneId}` },
          responseCode: 403,
        });
      }
    }

    if (!Array.isArray(members) || members.length === 0) {
      return AcWebResponse.json({
        data: { success: false, error: 'At least one family member is required' },
        responseCode: 400,
      });
    }

    // Format and validate each member
    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      // Construct full name if first_name, middle_name, last_name provided
      const memFullName = (m.name || [m.first_name, m.middle_name, m.last_name || surname].filter(Boolean).join(' ')).trim();
      m.name = memFullName;

      if (!m.name) {
        return AcWebResponse.json({
          data: { success: false, error: `Name is required for Member #${i + 1}` },
          responseCode: 400,
        });
      }

      // Member mobile auto-prefix +91 and 10-digit check
      if (i === 0 && !m.mobile_number) {
        m.mobile_number = effectiveFillerMobile;
      } else if (m.mobile_number && String(m.mobile_number).trim()) {
        let mDigits = String(m.mobile_number).replace(/\D/g, '');
        if (mDigits.startsWith('91') && mDigits.length === 12) mDigits = mDigits.substring(2);
        if (mDigits.length !== 10) {
          return AcWebResponse.json({
            data: { success: false, error: `Invalid 10-digit mobile number for Member #${i + 1} (${m.name})` },
            responseCode: 400,
          });
        }
        m.mobile_number = `+91 ${mDigits}`;
      }
    }

    const effectiveCity = String(city_name || current_city_or_place || '').trim();
    const effectiveState = String(state_name || 'Gujarat').trim();
    const effectiveCountry = String(country_name || 'India').trim();
    const effectiveAddress1 = String(address_line_1 || residential_address || '').trim();
    const effectiveAddress2 = String(address_line_2 || '').trim();
    const effectivePincode = String(pincode || '').trim();

    const effectiveResAddress = (
      residential_address ||
      [effectiveAddress1, effectiveAddress2, effectiveCity, effectiveState, effectiveCountry, effectivePincode].filter(Boolean).join(', ')
    ).trim();

    const effectiveFirmAddress = (
      firm_address ||
      [firm_address_line_1, firm_address_line_2, firm_city_name, firm_state_name, firm_country_name, firm_postal_code].filter(Boolean).join(', ')
    ).trim();

    // English-only validation: reject any Gujarati characters
    const gujaratiRegex = /[\u0A80-\u0AFF]/;
    const textFieldsToTest = [
      effectiveFillerName,
      surname,
      gotra,
      taluka,
      district,
      native_place,
      effectiveAddress1,
      effectiveAddress2,
      effectiveCity,
      effectiveState,
      effectiveCountry,
      firm_name,
      firm_address_line_1,
      firm_address_line_2,
      firm_city_name,
      firm_state_name,
      firm_country_name,
      ...members.map((m: any) => `${m.name || ''} ${m.first_name || ''} ${m.middle_name || ''} ${m.last_name || ''} ${m.relation || ''} ${m.education || ''}`),
    ];

    if (textFieldsToTest.some((t) => gujaratiRegex.test(String(t || '')))) {
      return AcWebResponse.json({
        data: { success: false, error: 'Only English text is allowed. Gujarati characters are not permitted.' },
        responseCode: 400,
      });
    }

    // Calculate 18+ members and total fees
    const feeCalculation = calculateFormFees(members);

    const now = new Date().toISOString();
    const formRow: FormRow = {
      zone_number: String(zone_number).trim(),
      family_number: String(family_number).trim(),
      address_line_1: effectiveAddress1,
      address_line_2: effectiveAddress2,
      city_name: effectiveCity,
      state_name: effectiveState,
      country_name: effectiveCountry,
      pincode: effectivePincode,
      current_city_or_place: effectiveCity,
      residential_address: effectiveResAddress,

      firm_name: String(firm_name || '').trim(),
      firm_address_line_1: String(firm_address_line_1 || '').trim(),
      firm_address_line_2: String(firm_address_line_2 || '').trim(),
      firm_city_name: String(firm_city_name || '').trim(),
      firm_state_name: String(firm_state_name || '').trim(),
      firm_country_name: String(firm_country_name || '').trim(),
      firm_postal_code: String(firm_postal_code || '').trim(),
      firm_address: effectiveFirmAddress,

      native_place: String(native_place || '').trim(),
      surname: String(surname || '').trim(),
      gotra: String(gotra || '').trim(),
      taluka: String(taluka || '').trim(),
      district: String(district || '').trim(),

      filler_name: effectiveFillerName,
      filler_mobile: effectiveFillerMobile,
      total_adults_count: feeCalculation.totalAdultsCount,
      total_amount: feeCalculation.totalAmount,
      payment_mode: 'Cash', // Strictly Cash only
      status: FormStatus.PENDING,
      created_by: user.userId,
      created_at: now,
    };

    const db = DbService.getInstance();
    const result = await db.createForm(formRow, feeCalculation.evaluatedMembers as any);

    if (!result) {
      return AcWebResponse.json({
        data: { success: false, error: 'Failed to create form in database' },
        responseCode: 500,
      });
    }

    return AcWebResponse.json({
      data: {
        success: true,
        message: 'Form submitted successfully',
        formId: result.formId,
        totalAdultsCount: feeCalculation.totalAdultsCount,
        totalAmount: feeCalculation.totalAmount,
      },
      responseCode: 201,
    });
  }

  @AcWebRoute({ path: '', method: 'get' })
  async getForms(args: IAcWebRequestHandlerArgs | any): Promise<AcWebResponse> {
    const request = args?.request || args;
    const authResult = requireAuth(request);
    if ('responseCode' in authResult) return authResult as AcWebResponse;
    const { user } = authResult;

    const query = request.get || {};
    let zoneNumber = query.zoneNumber || query.zone;
    const status = query.status;
    const search = query.search;
    const page = parseInt(query.page || '1', 10) || 1;
    const pageSize = parseInt(query.pageSize || query.limit || '10', 10) || 10;

    // Regular users are strictly restricted to their assigned zone
    if (user.role === UserRole.REGULAR_USER) {
      zoneNumber = user.zoneId || '01';
    }

    const db = DbService.getInstance();
    const result = await db.getForms({
      zoneNumber,
      status,
      search,
      page,
      pageSize,
    });

    return AcWebResponse.json({
      data: {
        success: true,
        count: result.forms.length,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
        forms: result.forms,
      },
    });
  }

  @AcWebRoute({ path: '/distinct-values', method: 'get' })
  async getDistinctValues(args: IAcWebRequestHandlerArgs | any): Promise<AcWebResponse> {
    const request = args?.request || args;
    const authResult = requireAuth(request);
    if ('responseCode' in authResult) return authResult as AcWebResponse;

    const db = DbService.getInstance();
    const values = await db.getDistinctValues();
    return AcWebResponse.json({
      data: { success: true, values },
      responseCode: 200,
    });
  }

  @AcWebRoute({ path: '/search', method: 'get' })
  async searchFamily(args: IAcWebRequestHandlerArgs | any): Promise<AcWebResponse> {
    const request = args?.request || args;
    const authResult = requireAuth(request);
    if ('responseCode' in authResult) return authResult as AcWebResponse;
    const { user } = authResult;

    const query = request.get || {};
    const zone = String(query.zone || query.zone_number || '').trim();
    const family = String(query.family || query.family_number || '').trim();

    if (!zone || !family) {
      return AcWebResponse.json({
        data: { success: false, error: 'Zone and family numbers are required' },
        responseCode: 400,
      });
    }

    if (user.role === UserRole.REGULAR_USER && user.zoneId && user.zoneId !== zone) {
      return AcWebResponse.json({
        data: { success: false, error: `You can only query families in your assigned Zone ${user.zoneId}` },
        responseCode: 403,
      });
    }

    const db = DbService.getInstance();
    const existingFamily = await db.findExistingFamily(zone, family);

    if (!existingFamily) {
      return AcWebResponse.json({
        data: {
          success: true,
          found: false,
          message: 'No previous family record found for this Zone and Family number.',
        },
      });
    }

    return AcWebResponse.json({
      data: {
        success: true,
        found: true,
        form: existingFamily.form,
        members: existingFamily.members,
      },
    });
  }

  @AcWebRoute({ path: '/import/samaaj/preview', method: 'get' })
  async previewSamaajImport(args: IAcWebRequestHandlerArgs | any): Promise<AcWebResponse> {
    const request = args?.request || args;
    const authResult = requireAuth(request);
    if ('responseCode' in authResult) return authResult as AcWebResponse;
    const { user } = authResult;

    if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.ADMIN) {
      return AcWebResponse.json({
        data: { success: false, error: 'Unauthorized: Admin or Super Admin access required' },
        responseCode: 403,
      });
    }

    try {
      const db = DbService.getInstance();
      const importer = new SamaajImporter(undefined, db);
      const preview = await importer.dryRun();

      return AcWebResponse.json({
        data: {
          success: true,
          preview,
        },
      });
    } catch (err: any) {
      return AcWebResponse.json({
        data: {
          success: false,
          error: `Failed to load samaaj_db preview: ${err.message}`,
        },
        responseCode: 500,
      });
    }
  }

  @AcWebRoute({ path: '/import/samaaj/execute', method: 'post' })
  async executeSamaajImport(args: IAcWebRequestHandlerArgs | any): Promise<AcWebResponse> {
    const request = args?.request || args;
    const authResult = requireAuth(request);
    if ('responseCode' in authResult) return authResult as AcWebResponse;
    const { user } = authResult;

    if (user.role !== UserRole.SUPER_ADMIN) {
      return AcWebResponse.json({
        data: { success: false, error: 'Unauthorized: Only Super Admin can execute data migration' },
        responseCode: 403,
      });
    }

    const body = request.post || {};
    const limit = body.limit ? parseInt(body.limit, 10) : undefined;
    const cleanExisting = body.cleanExisting === true || body.cleanExisting === 'true';
    const skipExisting = body.skipExisting === true || body.skipExisting === 'true';

    try {
      const db = DbService.getInstance();
      const importer = new SamaajImporter(undefined, db);
      const result = await importer.importAll({
        limit,
        cleanExisting,
        skipExisting,
      });

      return AcWebResponse.json({
        data: {
          success: result.success,
          result,
        },
      });
    } catch (err: any) {
      return AcWebResponse.json({
        data: {
          success: false,
          error: `Migration execution failed: ${err.message}`,
        },
        responseCode: 500,
      });
    }
  }

  @AcWebRoute({ path: '/:id', method: 'get' })
  async getFormById(args: IAcWebRequestHandlerArgs | any): Promise<AcWebResponse> {
    const request = args?.request || args;
    const authResult = requireAuth(request);
    if ('responseCode' in authResult) return authResult as AcWebResponse;
    const { user } = authResult;

    const id = parseInt(request.pathParameters?.id || request.get?.id || '0', 10);
    if (!id) {
      return AcWebResponse.json({
        data: { success: false, error: 'Invalid form id' },
        responseCode: 400,
      });
    }

    const db = DbService.getInstance();
    const details = await db.getFormById(id);
    if (!details) {
      return AcWebResponse.json({
        data: { success: false, error: 'Form not found' },
        responseCode: 404,
      });
    }

    // Role-based check
    if (user.role === UserRole.REGULAR_USER && user.zoneId) {
      if (details.form.zone_number !== user.zoneId) {
        return AcWebResponse.json({
          data: { success: false, error: 'Unauthorized to view this form' },
          responseCode: 403,
        });
      }
    }

    return AcWebResponse.json({
      data: {
        success: true,
        form: details.form,
        members: details.members,
      },
    });
  }

  @AcWebRoute({ path: '/:id', method: 'put' })
  async updateForm(args: IAcWebRequestHandlerArgs | any): Promise<AcWebResponse> {
    const request = args?.request || args;
    const authResult = requireAuth(request);
    if ('responseCode' in authResult) return authResult as AcWebResponse;
    const { user } = authResult;

    const id = parseInt(request.pathParameters?.id || request.get?.id || request.post?.id || '0', 10);
    if (!id) {
      return AcWebResponse.json({
        data: { success: false, error: 'Invalid form id' },
        responseCode: 400,
      });
    }

    const db = DbService.getInstance();
    const existing = await db.getFormById(id);
    if (!existing) {
      return AcWebResponse.json({
        data: { success: false, error: 'Form not found' },
        responseCode: 404,
      });
    }

    if (existing.form.status === FormStatus.APPROVED) {
      return AcWebResponse.json({
        data: { success: false, error: 'Approved forms cannot be edited' },
        responseCode: 400,
      });
    }

    if (user.role === UserRole.REGULAR_USER && user.zoneId) {
      if (existing.form.zone_number !== user.zoneId) {
        return AcWebResponse.json({
          data: { success: false, error: `You can only edit forms in your assigned Zone ${user.zoneId}` },
          responseCode: 403,
        });
      }
    }

    const body = request.post || {};
    const {
      zone_number = existing.form.zone_number,
      family_number = existing.form.family_number,
      address_line_1 = existing.form.address_line_1 || '',
      address_line_2 = existing.form.address_line_2 || '',
      city_name = existing.form.city_name || '',
      state_name = existing.form.state_name || 'Gujarat',
      country_name = existing.form.country_name || 'India',
      pincode = existing.form.pincode || '',
      current_city_or_place,
      residential_address,

      firm_name = existing.form.firm_name || '',
      firm_address_line_1 = existing.form.firm_address_line_1 || '',
      firm_address_line_2 = existing.form.firm_address_line_2 || '',
      firm_city_name = existing.form.firm_city_name || '',
      firm_state_name = existing.form.firm_state_name || 'Gujarat',
      firm_country_name = existing.form.firm_country_name || 'India',
      firm_postal_code = existing.form.firm_postal_code || '',
      firm_address,

      native_place = existing.form.native_place,
      surname = existing.form.surname,
      gotra = existing.form.gotra,
      taluka = existing.form.taluka,
      district = existing.form.district,

      filler_name,
      filler_mobile,
      payment_mode = 'Cash',
      members = [],
    } = body;

    const mainMember = members.find((m: any) => m.is_main_member === true || m.is_main_member === 1) || members[0] || {};
    const mainMemberFullName = (
      mainMember.name ||
      [mainMember.first_name, mainMember.middle_name, mainMember.last_name || surname]
        .filter(Boolean)
        .join(' ')
    ).trim();

    const effectiveFillerName = (filler_name || mainMemberFullName || '').trim();

    let rawMobile = String(filler_mobile || mainMember.mobile_number || '').trim();
    let cleanMobileDigits = rawMobile.replace(/\D/g, '');
    if (cleanMobileDigits.startsWith('91') && cleanMobileDigits.length === 12) {
      cleanMobileDigits = cleanMobileDigits.substring(2);
    }

    if (!zone_number || !family_number) {
      return AcWebResponse.json({
        data: { success: false, error: 'Zone number and Family number are required' },
        responseCode: 400,
      });
    }

    if (!effectiveFillerName) {
      return AcWebResponse.json({
        data: { success: false, error: 'Main Family Member Name is required' },
        responseCode: 400,
      });
    }

    if (!cleanMobileDigits || cleanMobileDigits.length !== 10) {
      return AcWebResponse.json({
        data: { success: false, error: 'A valid 10-digit mobile number is required for Main Family Member' },
        responseCode: 400,
      });
    }

    const effectiveFillerMobile = `+91 ${cleanMobileDigits}`;

    if (!Array.isArray(members) || members.length === 0) {
      return AcWebResponse.json({
        data: { success: false, error: 'At least one family member is required' },
        responseCode: 400,
      });
    }

    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      const memFullName = (m.name || [m.first_name, m.middle_name, m.last_name || surname].filter(Boolean).join(' ')).trim();
      m.name = memFullName;
      m.last_name = m.last_name || surname;

      if (!m.name) {
        return AcWebResponse.json({
          data: { success: false, error: `Name is required for Member #${i + 1}` },
          responseCode: 400,
        });
      }

      if (m.mobile_number && String(m.mobile_number).trim()) {
        let mDigits = String(m.mobile_number).replace(/\D/g, '');
        if (mDigits.startsWith('91') && mDigits.length === 12) mDigits = mDigits.substring(2);
        if (mDigits.length !== 10) {
          return AcWebResponse.json({
            data: { success: false, error: `Invalid 10-digit mobile number for Member #${i + 1} (${m.name})` },
            responseCode: 400,
          });
        }
        m.mobile_number = `+91 ${mDigits}`;
      }
    }

    const effectiveCity = String(city_name || current_city_or_place || '').trim();
    const effectiveState = String(state_name || 'Gujarat').trim();
    const effectiveCountry = String(country_name || 'India').trim();
    const effectiveAddress1 = String(address_line_1 || residential_address || '').trim();
    const effectiveAddress2 = String(address_line_2 || '').trim();
    const effectivePincode = String(pincode || '').trim();

    const effectiveResAddress = (
      residential_address ||
      [effectiveAddress1, effectiveAddress2, effectiveCity, effectiveState, effectiveCountry, effectivePincode].filter(Boolean).join(', ')
    ).trim();

    const effectiveFirmAddress = (
      firm_address ||
      [firm_address_line_1, firm_address_line_2, firm_city_name, firm_state_name, firm_country_name, firm_postal_code].filter(Boolean).join(', ')
    ).trim();

    const gujaratiRegex = /[\u0A80-\u0AFF]/;
    const textFieldsToTest = [
      effectiveFillerName,
      surname,
      gotra,
      taluka,
      district,
      native_place,
      effectiveAddress1,
      effectiveAddress2,
      effectiveCity,
      effectiveState,
      effectiveCountry,
      firm_name,
      firm_address_line_1,
      firm_address_line_2,
      firm_city_name,
      firm_state_name,
      firm_country_name,
      ...members.map((m: any) => `${m.name || ''} ${m.first_name || ''} ${m.middle_name || ''} ${m.last_name || ''} ${m.relation || ''} ${m.education || ''}`),
    ];

    if (textFieldsToTest.some((t) => gujaratiRegex.test(String(t || '')))) {
      return AcWebResponse.json({
        data: { success: false, error: 'Only English text is allowed. Gujarati characters are not permitted.' },
        responseCode: 400,
      });
    }

    const feeCalculation = calculateFormFees(members);

    const formRow: Partial<FormRow> = {
      zone_number: String(zone_number).trim(),
      family_number: String(family_number).trim(),
      address_line_1: effectiveAddress1,
      address_line_2: effectiveAddress2,
      city_name: effectiveCity,
      state_name: effectiveState,
      country_name: effectiveCountry,
      pincode: effectivePincode,
      current_city_or_place: effectiveCity,
      residential_address: effectiveResAddress,

      firm_name: String(firm_name || '').trim(),
      firm_address_line_1: String(firm_address_line_1 || '').trim(),
      firm_address_line_2: String(firm_address_line_2 || '').trim(),
      firm_city_name: String(firm_city_name || '').trim(),
      firm_state_name: String(firm_state_name || '').trim(),
      firm_country_name: String(firm_country_name || '').trim(),
      firm_postal_code: String(firm_postal_code || '').trim(),
      firm_address: effectiveFirmAddress,

      native_place: String(native_place || '').trim(),
      surname: String(surname || '').trim(),
      gotra: String(gotra || '').trim(),
      taluka: String(taluka || '').trim(),
      district: String(district || '').trim(),

      filler_name: effectiveFillerName,
      filler_mobile: effectiveFillerMobile,
      total_adults_count: feeCalculation.totalAdultsCount,
      total_amount: feeCalculation.totalAmount,
      payment_mode: 'Cash',
    };

    const updateSuccess = await db.updateForm(id, formRow, feeCalculation.evaluatedMembers as any);
    if (!updateSuccess) {
      return AcWebResponse.json({
        data: { success: false, error: 'Failed to update form' },
        responseCode: 500,
      });
    }

    return AcWebResponse.json({
      data: {
        success: true,
        message: 'Form updated successfully',
        formId: id,
        totalAdultsCount: feeCalculation.totalAdultsCount,
        totalAmount: feeCalculation.totalAmount,
      },
      responseCode: 200,
    });
  }
}
