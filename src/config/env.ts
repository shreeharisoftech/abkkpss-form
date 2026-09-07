import fs from 'fs';
import path from 'path';

export interface AppEnvConfig {
  PORT: number;
  JWT_SECRET: string;
  MYSQL_HOST: string;
  MYSQL_PORT: number;
  MYSQL_USER: string;
  MYSQL_PASSWORD: string;
  MYSQL_DATABASE: string;
  PUPPETEER_EXECUTABLE_PATH?: string;
}

const DEFAULT_CONFIG: AppEnvConfig = {
  PORT: 3000,
  JWT_SECRET: 'abkkpss_super_secret_jwt_token_key_2026',
  MYSQL_HOST: '127.0.0.1',
  MYSQL_PORT: 3306,
  MYSQL_USER: 'root',
  MYSQL_PASSWORD: '',
  MYSQL_DATABASE: 'abkkpss_forms_db',
};

let cachedConfig: AppEnvConfig | null = null;

export function loadEnvConfig(): AppEnvConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  let fileConfig: Partial<AppEnvConfig> = {};

  const candidatePaths = [
    path.resolve(process.cwd(), '_env.json'),
    path.resolve(process.cwd(), 'dist', '_env.json'),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      try {
        const content = fs.readFileSync(candidate, 'utf-8');
        fileConfig = JSON.parse(content);
        break;
      } catch (err) {
        console.warn(`[Env] Failed to parse ${candidate}:`, err);
      }
    }
  }

  cachedConfig = {
    PORT: Number(process.env.PORT || fileConfig.PORT || DEFAULT_CONFIG.PORT),
    JWT_SECRET: String(process.env.JWT_SECRET || fileConfig.JWT_SECRET || DEFAULT_CONFIG.JWT_SECRET),
    MYSQL_HOST: String(process.env.MYSQL_HOST || fileConfig.MYSQL_HOST || DEFAULT_CONFIG.MYSQL_HOST),
    MYSQL_PORT: Number(process.env.MYSQL_PORT || fileConfig.MYSQL_PORT || DEFAULT_CONFIG.MYSQL_PORT),
    MYSQL_USER: String(process.env.MYSQL_USER || fileConfig.MYSQL_USER || DEFAULT_CONFIG.MYSQL_USER),
    MYSQL_PASSWORD: String(
      process.env.MYSQL_PASSWORD !== undefined
        ? process.env.MYSQL_PASSWORD
        : fileConfig.MYSQL_PASSWORD !== undefined
        ? fileConfig.MYSQL_PASSWORD
        : DEFAULT_CONFIG.MYSQL_PASSWORD
    ),
    MYSQL_DATABASE: String(process.env.MYSQL_DATABASE || fileConfig.MYSQL_DATABASE || DEFAULT_CONFIG.MYSQL_DATABASE),
    PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH || fileConfig.PUPPETEER_EXECUTABLE_PATH || undefined,
  };

  return cachedConfig;
}

export const envConfig = loadEnvConfig();
