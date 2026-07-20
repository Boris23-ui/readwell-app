const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Some pnpm packages (multer, expo-document-picker, etc.) create ephemeral
// _tmp_* directories inside their own package folder during or after install.
// Metro's FallbackWatcher tries to watch these and crashes with ENOENT when
// the directory has already been cleaned up.  Block every path matching the
// _tmp_* pattern across the entire node_modules tree.
const extra = /node_modules[/\\][^/\\]*_tmp_\d+/;

const existing = config.resolver.blockList;
if (!existing) {
  config.resolver.blockList = extra;
} else if (Array.isArray(existing)) {
  config.resolver.blockList = [...existing, extra];
} else {
  config.resolver.blockList = [existing, extra];
}

module.exports = config;
