import { AcWebController, AcWebRoute, AcWebResponse, IAcWebRequestHandlerArgs } from 'ac-web';
import { DbService } from '../database/db-service';
import { FormStatus, UserRole } from '../database/schema';
import { generateReceiptPdf, generateMemberReceiptPdf } from '../services/pdf-receipt';
import { WhatsAppService } from '../services/whatsapp-service';
import { requireAuth } from '../middlewares/auth.middleware';

@AcWebController()
@AcWebRoute({ path: '/api/forms' })
export class ApprovalController {
  @AcWebRoute({ path: '/:id/approve', method: 'post' })
  async approveForm(args: IAcWebRequestHandlerArgs | any): Promise<AcWebResponse> {
    const request = args?.request || args;
    const authResult = requireAuth(request, [UserRole.ADMIN, UserRole.SUPER_ADMIN]);
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
    const formDetails = await db.getFormById(id);
    if (!formDetails) {
      return AcWebResponse.json({
        data: { success: false, error: 'Form not found' },
        responseCode: 404,
      });
    }

    const { form, members } = formDetails;

    // 1. Identify Main Family Member
    const mainMember = members.find((m) => m.is_main_member === true || m.is_main_member === 1) || members[0];

    // 2. Assign fixed member numbers: [ZoneNumber]/[FamilyNumber]/[MemberNo]-[Unique Member Id]
    // Value starting from 1 when approved, e.g. 01/01/01-00001
    const zoneStr = String(form.zone_number).padStart(2, '0');
    const familyStr = String(form.family_number).padStart(2, '0');

    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      const memberSerial = String(m.serial_no || i + 1).padStart(2, '0');
      const uniqueSeq = m.unique_member_seq || (await db.getNextUniqueMemberSeq());
      const uniqueSeqStr = String(uniqueSeq).padStart(5, '0');
      const fixedNo = `${zoneStr}/${familyStr}/${memberSerial}-${uniqueSeqStr}`;
      m.fixed_member_number = fixedNo;
      m.unique_member_seq = uniqueSeq;
      if (m.id) {
        await db.updateMemberFixedNumber(m.id, fixedNo, uniqueSeq);
      }
    }

    // 3. Generate receipt number: No prefix in Receipt no. Use member no for receipt no.
    const mainMemberSeq = mainMember?.unique_member_seq || members[0]?.unique_member_seq;
    let receiptNumber = form.receipt_number;
    if (receiptNumber) {
      receiptNumber = receiptNumber.replace(/^.*-(\d+)$/, '$1').replace(/^[A-Za-z]+-/, '');
    } else if (mainMemberSeq) {
      receiptNumber = String(mainMemberSeq).padStart(5, '0');
    } else {
      receiptNumber = await db.getNextReceiptNumber();
    }

    // 4. Update form status in DB
    await db.updateFormStatus({
      id,
      status: FormStatus.APPROVED,
      approvedBy: user.userId,
      receiptNumber,
    });
    form.status = FormStatus.APPROVED;
    form.receipt_number = receiptNumber;
    form.approved_by = user.userId;

    return AcWebResponse.json({
      data: {
        success: true,
        message: 'Form approved and member IDs allocated',
        receiptNumber,
        membersCount: members.length,
      },
    });
  }

  @AcWebRoute({ path: '/:id/reject', method: 'post' })
  async rejectForm(args: IAcWebRequestHandlerArgs | any): Promise<AcWebResponse> {
    const request = args?.request || args;
    const authResult = requireAuth(request, [UserRole.ADMIN, UserRole.SUPER_ADMIN]);
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
    const success = await db.updateFormStatus({
      id,
      status: FormStatus.REJECTED,
      approvedBy: user.userId,
    });

    return AcWebResponse.json({
      data: {
        success,
        message: success ? 'Form rejected successfully' : 'Failed to update form',
      },
    });
  }

  @AcWebRoute({ path: '/:id/receipt', method: 'get' })
  async getReceiptPdf(args: IAcWebRequestHandlerArgs | any): Promise<AcWebResponse> {
    const request = args?.request || args;
    const id = parseInt(request.pathParameters?.id || request.get?.id || '0', 10);
    if (!id) {
      return AcWebResponse.json({
        data: { success: false, error: 'Invalid form id' },
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

  @AcWebRoute({ path: '/:id/members/:memberId/receipt', method: 'get' })
  async getMemberReceiptPdf(args: IAcWebRequestHandlerArgs | any): Promise<AcWebResponse> {
    const request = args?.request || args;
    const authResult = requireAuth(request);
    if ('responseCode' in authResult) return authResult as AcWebResponse;

    const id = parseInt(request.pathParameters?.id || request.get?.id || '0', 10);
    const memberId = request.pathParameters?.memberId || request.get?.memberId;
    const db = DbService.getInstance();
    const formDetails = await db.getFormById(id);
    if (!formDetails) {
      return AcWebResponse.json({
        data: { success: false, error: 'Form not found' },
        responseCode: 404,
      });
    }

    const { form, members } = formDetails;
    const targetMember = members.find(
      (m) => String(m.id) === String(memberId) || String(m.serial_no) === String(memberId)
    );
    if (!targetMember) {
      return AcWebResponse.json({
        data: { success: false, error: 'Member not found' },
        responseCode: 404,
      });
    }

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

  @AcWebRoute({ path: '/:id/resend-receipt', method: 'post' })
  async resendReceipt(args: IAcWebRequestHandlerArgs | any): Promise<AcWebResponse> {
    const request = args?.request || args;
    const authResult = requireAuth(request, [UserRole.ADMIN, UserRole.SUPER_ADMIN]);
    if ('responseCode' in authResult) return authResult as AcWebResponse;

    const id = parseInt(request.pathParameters?.id || request.get?.id || request.post?.id || '0', 10);
    const db = DbService.getInstance();
    const formDetails = await db.getFormById(id);
    if (!formDetails || !formDetails.form.receipt_number) {
      return AcWebResponse.json({
        data: { success: false, error: 'Form is not approved or has no receipt' },
        responseCode: 400,
      });
    }

    const { form, members } = formDetails;
    const pdfBuffer = await generateReceiptPdf({ form, members });

    const waService = WhatsAppService.getInstance();
    const waDispatchResult = await waService.sendReceiptPdf(
      form.filler_mobile,
      pdfBuffer,
      form.receipt_number,
      {
        fillerName: form.filler_name,
        zoneNumber: form.zone_number,
        familyNumber: form.family_number,
        amount: form.total_amount,
      }
    );

    return AcWebResponse.json({
      data: {
        success: true,
        whatsappDispatch: waDispatchResult,
      },
    });
  }
}
