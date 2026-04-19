const fs = require('fs');
const path = require('path');

// Read .env file from root
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
    console.error('❌ Error: No se encontró el archivo .env en la raíz.');
    process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};

// Simple parsing of .env
envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        env[key.trim()] = value;
    }
});

// Build the JS config content
const configContent = `// Archivo generado automáticamente por env-to-config.js
// NO EDITAR MANUALMENTE
window.FIREBASE_CONFIG = {
  apiKey: "${env.FIREBASE_API_KEY || ''}",
  authDomain: "${env.FIREBASE_AUTH_DOMAIN || ''}",
  projectId: "${env.FIREBASE_PROJECT_ID || ''}",
  storageBucket: "${env.FIREBASE_STORAGE_BUCKET || ''}",
  messagingSenderId: "${env.FIREBASE_MESSAGING_SENDER_ID || ''}",
  appId: "${env.FIREBASE_APP_ID || ''}"
};
`;

const outputPath = path.join(__dirname, 'database', 'firebase_config.js');
const outputDir = path.dirname(outputPath);

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputPath, configContent);
console.log('✅ database/firebase_config.js generado correctamente desde .env');
