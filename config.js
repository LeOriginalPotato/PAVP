const fs = require('fs');
const path = require('path');

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) {
    return {};
  }

  return JSON.parse(raw);
}

function loadFileConfig() {
  const candidates = [
    path.join(__dirname, 'config.local.json'),
    path.join(__dirname, 'config.json')
  ];

  for (const candidate of candidates) {
    try {
      const config = readJsonFile(candidate);
      if (config && Object.keys(config).length > 0) {
        return config;
      }
    } catch (error) {
      throw new Error(`Invalid config file ${candidate}: ${error.message}`);
    }
  }

  return {};
}

const fileConfig = loadFileConfig();

function getConfigValue(key, fallback = '') {
  const envValue = process.env[key];
  if (envValue !== undefined && envValue !== null && String(envValue).length > 0) {
    return envValue;
  }

  const fileValue = fileConfig[key];
  if (fileValue !== undefined && fileValue !== null && String(fileValue).length > 0) {
    return fileValue;
  }

  return fallback;
}

module.exports = {
  fileConfig,
  getConfigValue
};
