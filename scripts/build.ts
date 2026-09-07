import * as esbuild from 'esbuild';
import path from 'path';
import fs from 'fs';

async function build() {
  console.log('🚀 [Build] Starting self-contained full-stack bundle build...');

  const rootDir = process.cwd();
  const distDir = path.resolve(rootDir, 'dist');
  const distPublicDir = path.resolve(distDir, 'public');
  const distDataDir = path.resolve(distDir, 'data');

  // 1. Clean and create directories
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });
  fs.mkdirSync(distPublicDir, { recursive: true });
  fs.mkdirSync(distDataDir, { recursive: true });

  console.log('📦 [Build] Bundling frontend client assets (ac-runtime + CoreUI)...');

  // 2. Bundle Client App
  await esbuild.build({
    entryPoints: [path.resolve(rootDir, 'src', 'frontend', 'app.ts')],
    outfile: path.resolve(distPublicDir, 'app.js'),
    bundle: true,
    platform: 'browser',
    target: ['es2022'],
    format: 'esm',
    minify: false,
    sourcemap: true,
  });

  // 3. Copy frontend static files
  fs.copyFileSync(
    path.resolve(rootDir, 'src', 'frontend', 'index.html'),
    path.resolve(distPublicDir, 'index.html')
  );
  fs.copyFileSync(
    path.resolve(rootDir, 'src', 'frontend', 'styles.css'),
    path.resolve(distPublicDir, 'styles.css')
  );

  // Copy assets
  const srcAssetsDir = path.resolve(rootDir, 'src', 'assets');
  const distAssetsDir = path.resolve(distDir, 'assets');
  const distPublicAssetsDir = path.resolve(distPublicDir, 'assets');
  if (fs.existsSync(srcAssetsDir)) {
    if (!fs.existsSync(distAssetsDir)) fs.mkdirSync(distAssetsDir, { recursive: true });
    if (!fs.existsSync(distPublicAssetsDir)) fs.mkdirSync(distPublicAssetsDir, { recursive: true });
    for (const file of fs.readdirSync(srcAssetsDir)) {
      fs.copyFileSync(path.join(srcAssetsDir, file), path.join(distAssetsDir, file));
      fs.copyFileSync(path.join(srcAssetsDir, file), path.join(distPublicAssetsDir, file));
    }
  }

  console.log('✅ [Build] Frontend assets compiled to dist/public');

  // 4. Bundle Server
  console.log('📦 [Build] Bundling server application (ac-web + ac-sql + ac-data-dictionary)...');

  // Externalize native bindings or packages with dynamic runtime files
  const externalDependencies = [
    'mysql2',
    'sqlite3',
    'whatsapp-web.js',
    'bcryptjs',
    'pdfkit',
  ];

  const autoCodeAliases: Record<string, string> = {
    '@autocode-ts/autocode': path.resolve(rootDir, 'node_modules/@autocode-ts/autocode'),
    '@autocode-ts/ac-data-dictionary': path.resolve(rootDir, 'node_modules/@autocode-ts/ac-data-dictionary'),
    '@autocode-ts/ac-extensions': path.resolve(rootDir, 'node_modules/@autocode-ts/ac-extensions'),
    '@autocode-ts/ac-pipes': path.resolve(rootDir, 'node_modules/@autocode-ts/ac-pipes'),
    '@autocode-ts/ac-reactivity': path.resolve(rootDir, 'node_modules/@autocode-ts/ac-reactivity'),
    '@autocode-ts/ac-runtime': path.resolve(rootDir, 'node_modules/@autocode-ts/ac-runtime'),
    '@autocode-ts/ac-sql': path.resolve(rootDir, 'node_modules/@autocode-ts/ac-sql'),
    '@autocode-ts/ac-sql-node': path.resolve(rootDir, 'node_modules/@autocode-ts/ac-sql-node'),
    '@autocode-ts/ac-web': path.resolve(rootDir, 'node_modules/@autocode-ts/ac-web'),
    '@autocode-ts/ac-web-on-express': path.resolve(rootDir, 'node_modules/@autocode-ts/ac-web-on-express'),
  };

  await esbuild.build({
    entryPoints: [path.resolve(rootDir, 'src', 'server.ts')],
    outfile: path.resolve(distDir, 'server.js'),
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    banner: {
      js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
    },
    alias: autoCodeAliases,
    nodePaths: [path.resolve(rootDir, 'node_modules')],
    external: externalDependencies,
    sourcemap: true,
  });

  console.log('✅ [Build] Server application bundled to dist/server.js');

  // 5. Generate self-contained deployment manifest in dist/package.json
  const rootPkg = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'package.json'), 'utf-8'));
  const prodDependencies: Record<string, string> = {};
  for (const dep of externalDependencies) {
    if (rootPkg.dependencies && rootPkg.dependencies[dep]) {
      prodDependencies[dep] = rootPkg.dependencies[dep];
    }
  }

  const distPkg = {
    name: 'abkkpss-form-bundle',
    version: '1.0.0',
    description: 'Self-contained deployment bundle for ABKKPSS Form Digitization System',
    main: 'server.js',
    type: 'module',
    scripts: {
      start: 'node server.js',
    },
    dependencies: prodDependencies,
  };

  fs.writeFileSync(path.resolve(distDir, 'package.json'), JSON.stringify(distPkg, null, 2));

  // 6. Copy _env.json configuration
  if (fs.existsSync(path.resolve(rootDir, '_env.json'))) {
    fs.copyFileSync(
      path.resolve(rootDir, '_env.json'),
      path.resolve(distDir, '_env.json')
    );
  }
  if (fs.existsSync(path.resolve(rootDir, '_env.example.json'))) {
    fs.copyFileSync(
      path.resolve(rootDir, '_env.example.json'),
      path.resolve(distDir, '_env.example.json')
    );
  }

  // 7. Copy README for deployment
  const deploymentReadme = `# ABKKPSS Physical Form Digitization System - Standalone Bundle

This directory is a self-contained production bundle.

## Environment Configuration
Configure your MySQL database connection and server settings in \`_env.json\`:
\`\`\`json
{
  "PORT": 3000,
  "JWT_SECRET": "abkkpss_super_secret_jwt_token_key_2026",
  "MYSQL_HOST": "127.0.0.1",
  "MYSQL_PORT": 3306,
  "MYSQL_USER": "root",
  "MYSQL_PASSWORD": "",
  "MYSQL_DATABASE": "abkkpss_forms_db",
  "PUPPETEER_EXECUTABLE_PATH": ""
}
\`\`\`

## Linux Host WhatsApp Requirements (Chromium)
If deploying on a Linux server/VPS (Ubuntu/Debian), install Chromium dependencies so WhatsApp Web headless browser can launch:
\`\`\`bash
npx puppeteer browsers install chrome --install-deps
\`\`\`
Or install system Chromium via apt:
\`\`\`bash
apt-get update && apt-get install -y chromium
\`\`\`

## Deployment & Run
1. Run \`npm install\` (if deploying on a new host without node_modules).
2. Start the server:
   \`\`\`bash
   npm start
   \`\`\`
   or
   \`\`\`bash
   node server.js
   \`\`\`
3. Open http://localhost:3000 in any browser or mobile device.
`;
  fs.writeFileSync(path.resolve(distDir, 'README.md'), deploymentReadme);

  console.log('🎉 [Build] Self-contained single-folder bundle completed successfully at ./dist');
}

build().catch((err) => {
  console.error('❌ [Build] Build failed:', err);
  process.exit(1);
});
