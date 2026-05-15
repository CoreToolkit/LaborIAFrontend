module.exports = {
  output: 'standalone',
  reactStrictMode: true,
  turbopack: {
    resolveAlias: {
      tailwindcss: require('path').resolve(__dirname, 'node_modules/tailwindcss'),
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      tailwindcss: require('path').resolve(__dirname, 'node_modules/tailwindcss'),
    };
    return config;
  },
};
