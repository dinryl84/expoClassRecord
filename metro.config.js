// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// .xlsx isn't a default Metro asset extension — without this, `require('./assets/ecr-template.xlsx')`
// would be treated as a source file (and fail to bundle) instead of a binary asset.
config.resolver.assetExts.push('xlsx');

module.exports = config;
