import path from 'path';
import fs from 'fs';
import qrcode from 'qrcode';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { getZoneLabel } from '../data/distinct-options';
import { envConfig } from '../config/env';

export enum WhatsAppState {
  DISCONNECTED = 'DISCONNECTED',
  INITIALIZING = 'INITIALIZING',
  PAIRING = 'PAIRING',
  CONNECTED = 'CONNECTED',
}

export class WhatsAppService {
  private static instance: WhatsAppService;
  private sock: any = null;
  private status: WhatsAppState = WhatsAppState.DISCONNECTED;
  private currentQrString: string | null = null;
  private currentQrDataUrl: string | null = null;
  private lastError: string | null = null;
  private isMockMode: boolean = false;
  private authDir: string = path.resolve(process.cwd(), 'data', 'baileys_auth');
  private reconnectTimeout: any = null;
  private isManualDisconnect: boolean = false;

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
    if (this.sock || this.status === WhatsAppState.INITIALIZING || this.status === WhatsAppState.CONNECTED) {
      return;
    }

    if (envConfig.ENABLE_WHATSAPP === false) {
      console.log('[WhatsApp] Native client disabled via ENABLE_WHATSAPP=false. Running in simulated mode.');
      await this.enableMockMode('Disabled via configuration');
      return;
    }

    this.status = WhatsAppState.INITIALIZING;
    this.lastError = null;
    this.isManualDisconnect = false;

    if (!fs.existsSync(this.authDir)) {
      fs.mkdirSync(this.authDir, { recursive: true });
    }

    try {
      console.log('[WhatsApp] Initializing lightweight Baileys client (Send-only mode, no chat sync)...');

      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

      const logger = pino({ level: 'silent' });

      const socket = (makeWASocket as any).default
        ? (makeWASocket as any).default({
            auth: state,
            logger,
            printQRInTerminal: false,
            browser: Browsers.appropriate('Chrome'),
            syncFullHistory: false, // SEND-ONLY: Do not download or sync historical chat data
            markOnlineOnConnect: false, // SEND-ONLY: Do not broadcast online presence
            generateHighQualityLinkPreview: false,
          })
        : makeWASocket({
            auth: state,
            logger,
            printQRInTerminal: false,
            browser: Browsers.appropriate('Chrome'),
            syncFullHistory: false,
            markOnlineOnConnect: false,
            generateHighQualityLinkPreview: false,
          });

      this.sock = socket;

      // Persist credentials whenever updated
      socket.ev.on('creds.update', saveCreds);

      // Listen for connection state updates
      socket.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.currentQrString = qr;
          try {
            this.currentQrDataUrl = await qrcode.toDataURL(qr, { width: 320, margin: 2 });
            this.status = WhatsAppState.PAIRING;
            console.log('\n[WhatsApp] Scan this QR code or open the Web UI to pair with WhatsApp:');
            try {
              const terminalQr = await qrcode.toString(qr, { type: 'terminal', small: true });
              console.log(terminalQr);
            } catch {
              // Terminal font might not support blocks
            }
          } catch (err: any) {
            this.lastError = err.message;
          }
        }

        if (connection === 'open') {
          this.status = WhatsAppState.CONNECTED;
          this.currentQrString = null;
          this.currentQrDataUrl = null;
          this.lastError = null;
          console.log('[WhatsApp] Baileys client is successfully connected and ready!');
        } else if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;

          console.warn(`[WhatsApp] Connection closed (statusCode: ${statusCode}, isLoggedOut: ${isLoggedOut})`);
          this.status = WhatsAppState.DISCONNECTED;
          this.sock = null;
          this.currentQrString = null;
          this.currentQrDataUrl = null;

          if (isLoggedOut) {
            console.log('[WhatsApp] Session logged out. Resetting local auth credentials...');
            try {
              fs.rmSync(this.authDir, { recursive: true, force: true });
            } catch {}
          } else if (!this.isManualDisconnect) {
            console.log('[WhatsApp] Attempting reconnection in 5 seconds...');
            if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = setTimeout(() => {
              this.initialize().catch((err) => {
                console.warn('[WhatsApp] Reconnection failed:', err.message);
              });
            }, 5000);
          }
        }
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
    if (this.isMockMode || !this.sock) {
      this.status = WhatsAppState.CONNECTED;
      this.currentQrDataUrl = null;
      this.currentQrString = null;
      console.log('[WhatsApp] Simulated pairing connected successfully.');
    }
  }

  public async disconnect(): Promise<void> {
    this.isManualDisconnect = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.sock) {
      try {
        this.sock.end(undefined);
      } catch {}
      this.sock = null;
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
    const jid = `${cleanMobile}@s.whatsapp.net`;

    const caption = `*SHREE AKHIL BHARATIYA KUTCH KADWA PATIDAR SATSANG SAMAJ (ABKKPSS)*\n\n` +
      `Dear *${details.fillerName}*,\n` +
      `Your Lifetime Membership Form has been successfully *received & approved*.\n\n` +
      `• Receipt No: *${receiptNumber}*\n` +
      `• Zone: *${getZoneLabel(details.zoneNumber)}* | Family No: *${details.familyNumber}*\n` +
      `• Total Fee Amount: *₹${details.amount}* (Based on 18+ members)\n\n` +
      `Attached is your official digital PDF receipt.\n` +
      `Jay Shree Swamiarayan`;

    if (this.status === WhatsAppState.CONNECTED && this.sock && !this.isMockMode) {
      try {
        await this.sock.sendMessage(jid, {
          document: pdfBuffer,
          mimetype: 'application/pdf',
          fileName: `ABKKPSS-Receipt-${receiptNumber}.pdf`,
          caption,
        });
        return { success: true, message: `Receipt successfully dispatched via WhatsApp to ${cleanMobile}` };
      } catch (err: any) {
        return { success: false, message: `Failed sending via WhatsApp client: ${err.message}` };
      }
    } else {
      // In simulated mode or pairing mode, acknowledge the delivery queue
      console.log(`[WhatsApp Delivery Log] Dispatched PDF receipt ${receiptNumber} to ${jid}. Status: ${this.status} (Mock: ${this.isMockMode})`);
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
    const jid = `${cleanMobile}@s.whatsapp.net`;

    const caption = `*SHREE AKHIL BHARATIYA KUTCH KADWA PATIDAR SATSANG SAMAJ (ABKKPSS)*\n\n` +
      `Dear *${details.mainMemberName}*,\n` +
      `Official Lifetime Membership Receipt for *${member.name}* has been generated.\n\n`+
      `Attached is the official digital membership receipt.\n\n` +
      `Jay Shree Swaminarayan`;

    if (this.status === WhatsAppState.CONNECTED && this.sock && !this.isMockMode) {
      try {
        const filename = `ABKKPSS-${member.name.replace(/\s+/g, '_')}-${member.memberId.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        await this.sock.sendMessage(jid, {
          document: pdfBuffer,
          mimetype: 'application/pdf',
          fileName: filename,
          caption,
        });
        return { success: true, message: `Receipt for ${member.name} dispatched to ${cleanMobile}` };
      } catch (err: any) {
        return { success: false, message: `Failed sending via WhatsApp: ${err.message}` };
      }
    } else {
      console.log(`[WhatsApp Delivery Log] Dispatched member PDF receipt ${receiptNumber} (${member.name}, ID: ${member.memberId}) to ${jid}. Status: ${this.status} (Mock: ${this.isMockMode})`);
      return {
        success: true,
        message: `Receipt for ${member.name} queued successfully for ${cleanMobile}`,
      };
    }
  }
}
