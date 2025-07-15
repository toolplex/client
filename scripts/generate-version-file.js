import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the package.json file
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

// Get the version
const version = packageJson.version;

// Generate the version.ts file
const versionFilePath = path.join(__dirname, '../src/version.ts');
const versionFileContent = `export const version = '${version}';\n`;

// Write the version.ts file
fs.writeFileSync(versionFilePath, versionFileContent);