import {access, readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, '..');
const extensionDirectory = path.join(projectDirectory, 'extension');
const manifestPath = path.join(extensionDirectory, 'manifest.json');
const packagePath = path.join(projectDirectory, 'package.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const packageMetadata = JSON.parse(await readFile(packagePath, 'utf8'));

const expectedPermissions = ['proxy', 'storage'];
const actualPermissions = [...manifest.permissions].sort();
if (JSON.stringify(actualPermissions) !== JSON.stringify(expectedPermissions)) {
  throw new Error('Manifest permissions must be exactly: proxy, storage');
}
if (manifest.manifest_version !== 3) {
  throw new Error('Manifest V3 is required.');
}
if (manifest.host_permissions || manifest.optional_host_permissions) {
  throw new Error('Host permissions are not allowed.');
}
if (manifest.homepage_url !== 'https://github.com/eugeny-dementev/proxy-profiles-switcher') {
  throw new Error('Manifest homepage_url must point to the public fork.');
}
if (manifest.name !== 'Proxy Profiles Switcher') {
  throw new Error('Unexpected extension name.');
}
if (manifest.version !== packageMetadata.version) {
  throw new Error('Manifest and package versions must match.');
}
if (packageMetadata.license !== 'MPL-2.0') {
  throw new Error('Package metadata must preserve the MPL-2.0 license.');
}

const requiredPaths = [
  manifest.background.service_worker,
  manifest.action.default_popup,
  manifest.options_ui.page,
  ...Object.values(manifest.icons),
  ...Object.values(manifest.action.default_icon)
];
const requiredProjectPaths = [
  'LICENSE',
  'NOTICE',
  'PRIVACY.md',
  'SECURITY.md',
  'docs/ARCHITECTURE.md',
  'docs/BACKUP_FORMAT.md'
];
for (const relativePath of new Set(requiredPaths)) {
  await access(path.join(extensionDirectory, relativePath));
}
for (const relativePath of requiredProjectPaths) {
  await access(path.join(projectDirectory, relativePath));
}

console.log('Extension manifest and packaged resources are valid.');
