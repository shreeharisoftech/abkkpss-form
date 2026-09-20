import { AcWebController, AcWebRoute, AcWebResponse, IAcWebRequestHandlerArgs } from 'ac-web';
import { DbService } from '../database/db-service';
import { FormStatus } from '../database/schema';
import { generateMemberReceiptPdf } from '../services/pdf-receipt';

@AcWebController()
@AcWebRoute({ path: '/api/public' })
export class PublicController {
  @AcWebRoute({ path: '/status', method: 'get' })
  async checkStatus(args: IAcWebRequestHandlerArgs | any): Promise<AcWebResponse> {
    const request = args?.request || args;
    const mobile = request.get?.mobile || '';

    if (!mobile || mobile.replace(/\D/g, '').length < 10) {
      return AcWebResponse.json({
        data: { success: false, error: 'Please enter a valid 10-digit mobile number' },
        responseCode: 400,
      });
    }

    const db = DbService.getInstance();
    const results = await db.findFormsByMobile(mobile);

    if (results.length === 0) {
      return AcWebResponse.json({
        data: {
          success: true,
          found: false,
          message: 'No application found for this mobile number.',
        },
      });
    }

    // Return form details with members (read-only info)
    const forms = results.map(({ form, members }) => ({
      id: form.id,
      zone_number: form.zone_number,
      family_number: form.family_number,
      filler_name: form.filler_name,
      filler_mobile: form.filler_mobile,
      surname: form.surname,
      gotra: form.gotra,
      native_place: form.native_place,
      city_name: form.city_name,
      address_line_1: form.address_line_1,
      address_line_2: form.address_line_2,
      state_name: form.state_name,
      country_name: form.country_name,
      pincode: form.pincode,
      firm_name: form.firm_name,
      firm_address_line_1: form.firm_address_line_1,
      firm_city_name: form.firm_city_name,
      taluka: form.taluka,
      district: form.district,
      total_adults_count: form.total_adults_count,
      total_amount: form.total_amount,
      payment_mode: form.payment_mode,
      receipt_number: form.receipt_number,
      status: form.status,
      created_at: form.created_at,
      members: members.map((m) => ({
        serial_no: m.serial_no,
        name: m.name,
        first_name: m.first_name,
        middle_name: m.middle_name,
        last_name: m.last_name,
        dob: m.dob,
        gender: m.gender,
        relation: m.relation,
        education: m.education,
        mobile_number: m.mobile_number,
        blood_group: m.blood_group,
        is_adult_18_plus: m.is_adult_18_plus,
        is_main_member: m.is_main_member,
        fixed_member_number: m.fixed_member_number,
      })),
    }));

    return AcWebResponse.json({
      data: {
        success: true,
        found: true,
        count: forms.length,
        forms,
      },
    });
  }

  @AcWebRoute({ path: '/receipt/:id', method: 'get' })
  async getPublicReceipt(args: IAcWebRequestHandlerArgs | any): Promise<AcWebResponse> {
    const request = args?.request || args;
    const id = parseInt(request.pathParameters?.id || request.get?.id || '0', 10);
    const mobile = request.get?.mobile || '';

    if (!id || !mobile) {
      return AcWebResponse.json({
        data: { success: false, error: 'Form ID and mobile number are required' },
        responseCode: 400,
      });
    }

    const db = DbService.getInstance();
    const formDetails = await db.getFormById(id);
    if (!formDetails) {
      return AcWebResponse.json({
        data: { success: false, error: 'Form not found' },
        responseCode: 404,
      });
    }

    const { form, members } = formDetails;

    // Verify mobile matches and form is approved
    let digits = mobile.replace(/\D/g, '');
    if (digits.startsWith('91') && digits.length === 12) digits = digits.substring(2);
    const formDigits = (form.filler_mobile || '').replace(/\D/g, '').slice(-10);

    if (digits !== formDigits) {
      return AcWebResponse.json({
        data: { success: false, error: 'Mobile number does not match this form' },
        responseCode: 403,
      });
    }

    if (form.status !== FormStatus.APPROVED) {
      return AcWebResponse.json({
        data: { success: false, error: 'Receipt is only available for approved forms' },
        responseCode: 400,
      });
    }

    // Generate individual member receipt if memberId provided
    const memberIdParam = request.get?.memberId || request.get?.member_id;
    if (memberIdParam) {
      const targetMember = members.find(
        (m) => String(m.id) === String(memberIdParam) || String(m.serial_no) === String(memberIdParam)
      );
      if (targetMember) {
        const mainMember = members.find((m) => m.is_main_member === true || m.is_main_member === 1) || members[0];
        const memberPdf = await generateMemberReceiptPdf({
          form,
          member: targetMember,
          mainMember,
          approvalDate: form.created_at ? new Date(form.created_at).toLocaleDateString('en-IN') : undefined,
        });
        const memberName = (targetMember.name || [targetMember.first_name, targetMember.middle_name, form.surname].filter(Boolean).join(' ')).trim();
        const filename = `ABKKPSS-${memberName.replace(/\s+/g, '_')}-${(targetMember.fixed_member_number || 'ID').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        return AcWebResponse.raw({
          content: memberPdf,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${filename}"`,
          },
        });
      }
    }

    // Generate full family receipt
    const { generateReceiptPdf } = await import('../services/pdf-receipt');
    const pdfBuffer = await generateReceiptPdf({
      form,
      members,
      approvalDate: form.created_at ? new Date(form.created_at).toLocaleDateString('en-IN') : undefined,
    });

    const filename = `ABKKPSS-Receipt-${form.receipt_number || `FORM-${form.id}`}.pdf`;
    return AcWebResponse.raw({
      content: pdfBuffer,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    });
  }
}
