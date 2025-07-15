import fs from 'fs/promises';
const file = 'dist/mcp-server/index.js';
const shebang = '#!/usr/bin/env node\n';
const content = await fs.readFile(file, 'utf8');
if (!content.startsWith(shebang)) {
  await fs.writeFile(file, shebang + content);
}
