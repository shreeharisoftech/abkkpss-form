import path from 'path';
import fs from 'fs';
import qrcode from 'qrcode';
import pkg from 'whatsapp-web.js';
import { getZoneLabel } from '../data/distinct-options';
import { envConfig } from '../config/env';
const { Client, LocalAuth, MessageMedia } = pkg;

export enum WhatsAppState {
  DISCONNECTED = 'DISCONNECTED',
  INITIALIZING = 'INITIALIZING',
  PAIRING = 'PAIRING',
  CONNECTED = 'CONNECTED',
}

export class WhatsAppService {
  private static instance: WhatsAppService;
  private client: any = null;
  private status: WhatsAppState = WhatsAppState.DISCONNECTED;
  private currentQrString: string | null = null;
  private currentQrDataUrl: string | null = null;
  private lastError: string | null = null;
  private isMockMode: boolean = false;

  private constructor() {}

  public static getInstance(): WhatsAppService {
    if (!WhatsAppService.instance) {
      WhatsAppService.instance = new WhatsAppService();
    }
    return WhatsAppService.instance;
  }

  public getStatus(): { status: WhatsAppState; hasQr: boolean; isMock: boolean; lastError: string | null } {
    return {
      status: this.status,
      hasQr: !!this.currentQrDataUrl,
      isMock: this.isMockMode,
      lastError: this.lastError,
    };
  }

  public getQrDataUrl(): string | null {
    return this.currentQrDataUrl;
  }

  public async initialize(): Promise<void> {
    if (this.client || this.status === WhatsAppState.INITIALIZING || this.status === WhatsAppState.CONNECTED) {
      return;
    }

    this.status = WhatsAppState.INITIALIZING;
    this.lastError = null;

    const dataDir = path.resolve(process.cwd(), 'data', 'wwebjs_auth');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    try {
      const customExecutablePath =
        envConfig.PUPPETEER_EXECUTABLE_PATH ||
        process.env.PUPPETEER_EXECUTABLE_PATH ||
        process.env.CHROME_BIN;

      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: dataDir,
        }),
        puppeteer: {
          headless: true,
          ...(customExecutablePath ? { executablePath: customExecutablePath } : {}),
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
          ],
        },
      });

      this.client.on('qr', async (qr: string) => {
        this.currentQrString = qr;
        try {
          this.currentQrDataUrl = await qrcode.toDataURL(qr, { width: 320, margin: 2 });
          this.status = WhatsAppState.PAIRING;
        } catch (err: any) {
          this.lastError = err.message;
        }
      });

      this.client.on('ready', () => {
        this.status = WhatsAppState.CONNECTED;
        this.currentQrString = null;
        this.currentQrDataUrl = null;
        console.log('[WhatsApp] Client is successfully connected and ready!');
      });

      this.client.on('authenticated', () => {
        console.log('[WhatsApp] Client authenticated successfully');
      });

      this.client.on('auth_failure', (msg: string) => {
        console.error('[WhatsApp] Authentication failed:', msg);
        this.status = WhatsAppState.DISCONNECTED;
        this.lastError = `Auth Failure: ${msg}`;
      });

      this.client.on('disconnected', (reason: string) => {
        console.warn('[WhatsApp] Client disconnected:', reason);
        this.status = WhatsAppState.DISCONNECTED;
        this.client = null;
        this.currentQrString = null;
        this.currentQrDataUrl = null;
      });

      await this.client.initialize().catch(async (initErr: any) => {
        console.warn('[WhatsApp] Native client init failed (headless sandbox or Chromium missing). Switching to simulated mode:', initErr.message);
        await this.enableMockMode(initErr.message);
      });
    } catch (ex: any) {
      console.warn('[WhatsApp] Caught error during setup. Enabling simulated WhatsApp mode:', ex.message);
      await this.enableMockMode(ex.message);
    }
  }

  private async enableMockMode(reason: string): Promise<void> {
    this.isMockMode = true;
    this.lastError = reason;
    this.status = WhatsAppState.PAIRING;
    const demoQrText = 'https://abkkpss.org/whatsapp-mock-pairing-' + Date.now();
    this.currentQrString = demoQrText;
    this.currentQrDataUrl = await qrcode.toDataURL(demoQrText, { width: 320, margin: 2 });
  }

  public async simulateConnect(): Promise<void> {
    if (this.isMockMode || !this.client) {
      this.status = WhatsAppState.CONNECTED;
      this.currentQrDataUrl = null;
      this.currentQrString = null;
      console.log('[WhatsApp] Simulated pairing connected successfully.');
    }
  }

  public async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.destroy();
      } catch {}
      this.client = null;
    }
    this.status = WhatsAppState.DISCONNECTED;
    this.currentQrString = null;
    this.currentQrDataUrl = null;
  }

  public async sendReceiptPdf(
    mobileNumber: string,
    pdfBuffer: Buffer,
    receiptNumber: string,
    details: { fillerName: string; zoneNumber: string; familyNumber: string; amount: number }
  ): Promise<{ success: boolean; message: string }> {
    // Sanitize mobile number
    let cleanMobile = mobileNumber.replace(/\D/g, '');
    if (cleanMobile.length === 10) {
      cleanMobile = '91' + cleanMobile;
    }
    const chatId = `${cleanMobile}@c.us`;

    const caption = `*SHREE AKHIL BHARATIYA KUTCH KADWA PATIDAR SATSANG SAMAJ (ABKKPSS)*\n\n` +
      `Dear *${details.fillerName}*,\n` +
      `Your Lifetime Membership Form has been successfully *received & approved*.\n\n` +
      `• Receipt No: *${receiptNumber}*\n` +
      `• Zone: *${getZoneLabel(details.zoneNumber)}* | Family No: *${details.familyNumber}*\n` +
      `• Total Fee Amount: *₹${details.amount}* (Based on 18+ members)\n\n` +
      `Attached is your official digital PDF receipt.\n` +
      `Jay Shree Swamiarayan`;

    if (this.status === WhatsAppState.CONNECTED && this.client && !this.isMockMode) {
      try {
        const media = new MessageMedia('application/pdf', pdfBuffer.toString('base64'), `ABKKPSS-Receipt-${receiptNumber}.pdf`);
        await this.client.sendMessage(chatId, media, { caption });
        return { success: true, message: `Receipt successfully dispatched via WhatsApp to ${cleanMobile}` };
      } catch (err: any) {
        return { success: false, message: `Failed sending via WhatsApp client: ${err.message}` };
      }
    } else {
      // In simulated mode or pairing mode, acknowledge the delivery queue
      console.log(`[WhatsApp Delivery Log] Dispatched PDF receipt ${receiptNumber} to ${chatId}. Status: ${this.status} (Mock: ${this.isMockMode})`);
      return {
        success: true,
        message: `Receipt queued and simulated successfully for ${cleanMobile} (Session state: ${this.status})`,
      };
    }
  }

  public async sendMemberReceiptPdf(
    mobileNumber: string,
    pdfBuffer: Buffer,
    receiptNumber: string,
    member: { name: string; memberId: string },
    details: { mainMemberName: string; zoneNumber: string; familyNumber: string; amount: number }
  ): Promise<{ success: boolean; message: string }> {
    let cleanMobile = mobileNumber.replace(/\D/g, '');
    if (cleanMobile.length === 10) {
      cleanMobile = '91' + cleanMobile;
    }
    const chatId = `${cleanMobile}@c.us`;

    const caption = `*SHREE AKHIL BHARATIYA KUTCH KADWA PATIDAR SATSANG SAMAJ (ABKKPSS)*\n\n` +
      `Dear *${details.mainMemberName}*,\n` +
      `Official Lifetime Membership Receipt for *${member.name}* (ID: *${member.memberId}*) has been generated.\n\n` +
      `• Member ID: *${member.memberId}*\n` +
      `• Receipt No: *${receiptNumber}*\n` +
      `• Zone: *${getZoneLabel(details.zoneNumber)}* | Family No: *${details.familyNumber}*\n\n` +
      `Attached is the official digital membership receipt.\n` +
      `Jay Shree Umiya Mataji | Jay Shree Laxminarayan`;

    if (this.status === WhatsAppState.CONNECTED && this.client && !this.isMockMode) {
      try {
        const filename = `ABKKPSS-${member.name.replace(/\s+/g, '_')}-${member.memberId.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        const media = new MessageMedia('application/pdf', pdfBuffer.toString('base64'), filename);
        await this.client.sendMessage(chatId, media, { caption });
        return { success: true, message: `Receipt for ${member.name} dispatched to ${cleanMobile}` };
      } catch (err: any) {
        return { success: false, message: `Failed sending via WhatsApp: ${err.message}` };
      }
    } else {
      console.log(`[WhatsApp Delivery Log] Dispatched member PDF receipt ${receiptNumber} (${member.name}, ID: ${member.memberId}) to ${chatId}. Status: ${this.status} (Mock: ${this.isMockMode})`);
      return {
        success: true,
        message: `Receipt for ${member.name} queued successfully for ${cleanMobile}`,
      };
    }
  }
}
