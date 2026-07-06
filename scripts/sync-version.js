const fs = require('fs');
const path = require('path');

const version = process.argv[2];

if (!version) {
  console.error('Please provide a version as an argument');
  process.exit(1);
}

// Clean version string (remove 'v' prefix if present)
const cleanVersion = version.startsWith('v') ? version.substring(1) : version;

const packagePaths = [
  'package.json',
  'backend/package.json',
  'frontend/package.json',
  'worker/package.json'
];

packagePaths.forEach(packagePath => {
  const fullPath = path.resolve(process.cwd(), packagePath);
  if (fs.existsSync(fullPath)) {
    const pkg = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    pkg.version = cleanVersion;
    fs.writeFileSync(fullPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`Updated ${packagePath} to version ${cleanVersion}`);
  } else {
    console.warn(`File not found: ${packagePath}`);
  }
});
