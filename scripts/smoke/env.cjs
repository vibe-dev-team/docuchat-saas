const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

const loadedMarker = Symbol.for('docuchat.smoke.env.loaded');

const loadEnv = () => {
  const globalSymbols = globalThis;
  if (globalSymbols[loadedMarker]) {
    return;
  }

  const overridePath = process.env.DOCUCHAT_ENV_FILE;
  if (overridePath) {
    dotenv.config({ path: overridePath });
    globalSymbols[loadedMarker] = true;
    return;
  }

  const envFileNames = ['.env', '.env.local'];
  const searchDirs = [];
  let currentDir = process.cwd();
  while (true) {
    searchDirs.push(currentDir);
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  for (const dir of searchDirs) {
    const envPaths = envFileNames
      .map((filename) => path.join(dir, filename))
      .filter((filePath) => fs.existsSync(filePath));
    if (envPaths.length > 0) {
      for (const envPath of envPaths) {
        dotenv.config({ path: envPath });
      }
      break;
    }
  }

  globalSymbols[loadedMarker] = true;
};

loadEnv();
