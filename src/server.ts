import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { AcWebOnExpress, AcWebResponse, IAcWebRequestHandlerArgs } from 'ac-web';
import { DbService, MySqlDbConfig } from './database/db-service';
import { envConfig } from './config/env';
import { WhatsAppService } from './services/whatsapp-service';
import { AuthController } from './controllers/auth.controller';
import { FormsController } from './controllers/forms.controller';
import { ApprovalController } from './controllers/approval.controller';
import { WhatsAppController } from './controllers/whatsapp.controller';
import { UsersController } from './controllers/users.controller';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createServer(port?: number, dbConfig?: MySqlDbConfig): Promise<AcWebOnExpress> {
  const resolvedPort = port || envConfig.PORT;

  // 1. Initialize MySQL Database via ac-sql exclusively
  const db = DbService.getInstance();
  await db.initialize(dbConfig);
  console.log('[ABKKPSS] Database initialized successfully via ac-sql (MySQL).');

  // 2. Initialize WhatsApp Service
  const waService = WhatsAppService.getInstance();
  // Asynchronously initialize WhatsApp so server boots immediately
  waService.initialize().catch((err) => {
    console.warn('[ABKKPSS] WhatsApp init background note:', err.message);
  });

  // 3. Create AcWebOnExpress application
  const app = new AcWebOnExpress();
  app.port = resolvedPort;

  // 4. Determine static frontend directory
  let publicDir = path.resolve(__dirname, 'public');
  if (!fs.existsSync(publicDir)) {
    publicDir = path.resolve(process.cwd(), 'dist', 'public');
  }
  if (!fs.existsSync(publicDir)) {
    publicDir = path.resolve(process.cwd(), 'src', 'frontend');
  }

  console.log(`[ABKKPSS] Serving static frontend from: ${publicDir}`);
  app.staticFilesRoutes.push({ prefix: '/', directory: publicDir });

  // Direct route for serving the client SPA index.html
  app.get({
    url: '/',
    handler: () => {
      const indexPath = fs.existsSync(path.join(publicDir, 'index.html'))
        ? path.join(publicDir, 'index.html')
        : path.resolve(process.cwd(), 'src', 'frontend', 'index.html');
      const htmlContent = fs.readFileSync(indexPath, 'utf-8');
      const response = new AcWebResponse();
      response.responseCode = 200;
      response.responseType = 'view';
      response.content = htmlContent;
      response.headers['Content-Type'] = 'text/html';
      return response;
    },
  });

  // Direct route for serving compiled app.js if requested
  app.get({
    url: '/app.js',
    handler: () => {
      const appJsDist = path.join(publicDir, 'app.js');
      const appJsSrc = path.resolve(process.cwd(), 'src', 'frontend', 'app.ts');
      const response = new AcWebResponse();
      response.responseCode = 200;
      response.responseType = 'raw';
      response.headers['Content-Type'] = 'application/javascript';

      if (fs.existsSync(appJsDist)) {
        response.content = fs.readFileSync(appJsDist, 'utf-8');
      } else if (fs.existsSync(appJsSrc)) {
        // Fallback reading
        response.content = fs.readFileSync(appJsSrc, 'utf-8');
      }
      return response;
    },
  });

  // Direct route for serving styles.css
  app.get({
    url: '/styles.css',
    handler: () => {
      const stylesPath = fs.existsSync(path.join(publicDir, 'styles.css'))
        ? path.join(publicDir, 'styles.css')
        : path.resolve(process.cwd(), 'src', 'frontend', 'styles.css');
      const response = new AcWebResponse();
      response.responseCode = 200;
      response.responseType = 'raw';
      response.headers['Content-Type'] = 'text/css';
      response.content = fs.readFileSync(stylesPath, 'utf-8');
      return response;
    },
  });

  // 5. Register Controllers via ac-web
  app.registerController({ controllerClass: AuthController });
  app.registerController({ controllerClass: FormsController });
  app.registerController({ controllerClass: ApprovalController });
  app.registerController({ controllerClass: WhatsAppController });
  app.registerController({ controllerClass: UsersController });

  // 6. Start the web server
  const startResult = await app.start();
  if (!startResult.isSuccess()) {
    console.error('[ABKKPSS] Error starting server:', startResult.message);
  } else {
    console.log(`[ABKKPSS] Full-Stack Server successfully running at http://localhost:${resolvedPort}`);
  }

  return app;
}

// Start immediately if executed directly
const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('server.ts') ||
  process.argv[1].endsWith('server.js') ||
  process.argv[1].endsWith('index.js')
);

if (isDirectRun) {
  const port = envConfig.PORT;
  createServer(port).catch((err) => {
    console.error('Fatal startup error:', err);
  });
}
