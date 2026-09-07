import { AcWebController, AcWebRoute, AcWebResponse, IAcWebRequestHandlerArgs } from 'ac-web';
import { WhatsAppService, WhatsAppState } from '../services/whatsapp-service';
import { requireAuth } from '../middlewares/auth.middleware';
import { UserRole } from '../database/schema';

@AcWebController()
@AcWebRoute({ path: '/api/whatsapp' })
export class WhatsAppController {
  @AcWebRoute({ path: '/status', method: 'get' })
  async getStatus(args: IAcWebRequestHandlerArgs | any): Promise<AcWebResponse> {
    const request = args?.request || args;
    const authResult = requireAuth(request, [UserRole.ADMIN, UserRole.SUPER_ADMIN]);
    if ('responseCode' in authResult) return authResult as AcWebResponse;

    const waService = WhatsAppService.getInstance();
    const status = waService.getStatus();

    return AcWebResponse.json({
      data: {
        success: true,
        ...status,
      },
    });
  }

  @AcWebRoute({ path: '/qr', method: 'get' })
  async getQr(args: IAcWebRequestHandlerArgs | any): Promise<AcWebResponse> {
    const request = args?.request || args;
    const authResult = requireAuth(request, [UserRole.ADMIN, UserRole.SUPER_ADMIN]);
    if ('responseCode' in authResult) return authResult as AcWebResponse;

    const waService = WhatsAppService.getInstance();
    const qrDataUrl = waService.getQrDataUrl();
    const status = waService.getStatus();

    return AcWebResponse.json({
      data: {
        success: true,
        qr: qrDataUrl,
        status: status.status,
      },
    });
  }

  @AcWebRoute({ path: '/connect', method: 'post' })
  async connect(args: IAcWebRequestHandlerArgs | any): Promise<AcWebResponse> {
    const request = args?.request || args;
    const authResult = requireAuth(request, [UserRole.SUPER_ADMIN]);
    if ('responseCode' in authResult) return authResult as AcWebResponse;

    const waService = WhatsAppService.getInstance();
    await waService.initialize();

    return AcWebResponse.json({
      data: {
        success: true,
        message: 'WhatsApp client initialization started',
        status: waService.getStatus(),
      },
    });
  }

  @AcWebRoute({ path: '/simulate-connect', method: 'post' })
  async simulateConnect(args: IAcWebRequestHandlerArgs | any): Promise<AcWebResponse> {
    const request = args?.request || args;
    const authResult = requireAuth(request, [UserRole.SUPER_ADMIN]);
    if ('responseCode' in authResult) return authResult as AcWebResponse;

    const waService = WhatsAppService.getInstance();
    await waService.simulateConnect();

    return AcWebResponse.json({
      data: {
        success: true,
        message: 'Simulated WhatsApp pairing completed',
        status: waService.getStatus(),
      },
    });
  }

  @AcWebRoute({ path: '/disconnect', method: 'post' })
  async disconnect(args: IAcWebRequestHandlerArgs | any): Promise<AcWebResponse> {
    const request = args?.request || args;
    const authResult = requireAuth(request, [UserRole.SUPER_ADMIN]);
    if ('responseCode' in authResult) return authResult as AcWebResponse;

    const waService = WhatsAppService.getInstance();
    await waService.disconnect();

    return AcWebResponse.json({
      data: {
        success: true,
        message: 'WhatsApp client disconnected',
        status: waService.getStatus(),
      },
    });
  }

  @AcWebRoute({ path: '/test-send', method: 'post' })
  async testSend(args: IAcWebRequestHandlerArgs | any): Promise<AcWebResponse> {
    const request = args?.request || args;
    const authResult = requireAuth(request, [UserRole.SUPER_ADMIN]);
    if ('responseCode' in authResult) return authResult as AcWebResponse;

    const body = request.post || {};
    const { mobile } = body;
    if (!mobile) {
      return AcWebResponse.json({
        data: { success: false, error: 'Mobile number is required' },
        responseCode: 400,
      });
    }

    const waService = WhatsAppService.getInstance();
    // Generate dummy test buffer
    const testBuffer = Buffer.from('ABKKPSS Test Receipt');
    const result = await waService.sendReceiptPdf(mobile, testBuffer, 'TEST-0001', {
      fillerName: 'Test User',
      zoneNumber: '01',
      familyNumber: '01',
      amount: 500,
    });

    return AcWebResponse.json({
      data: result,
    });
  }
}
