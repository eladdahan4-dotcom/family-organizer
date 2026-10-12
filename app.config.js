// Adds settings that depend on where the app is built (GitHub Actions sets these).
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...(config.experiments || {}),
    // Web version is served from https://<user>.github.io/<repo>/
    baseUrl: process.env.BASE_URL || "",
  },
  extra: {
    ...(config.extra || {}),
    webUrl: process.env.WEB_URL || "",
  },
});
