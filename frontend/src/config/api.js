const fallbackHost = typeof window !== "undefined" ? window.location.hostname : "localhost";
const fallbackProtocol = typeof window !== "undefined" ? window.location.protocol : "http:";
const fallbackBaseUrl = `${fallbackProtocol}//${fallbackHost}:4000`;
const configuredBaseUrl = (import.meta.env.VITE_API_URL || import.meta.env.VITE_SERVER_URL || "").trim().replace(/\/$/, "");

const isLocalHost = (host) => host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
const isPrivateNetworkHost = (host) => /^(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)$/i.test(host);

const getPreviewBackendUrl = (host) => {
  if (!host) return null;
  const match = host.match(/^(.*?)-(?<port>\d+)\.(?<suffix>.+)$/i);
  if (!match?.groups) return null;
  const { suffix } = match.groups;
  if (!/^(app\.github\.dev|preview\.app\.github\.dev|githubpreview\.dev)$/i.test(suffix)) return null;
  return `${window.location.protocol}//${match[1]}-4000.${suffix}`;
};

const getDefaultServerUrl = () => {
  if (typeof window === "undefined") return fallbackBaseUrl;
  const currentOrigin = window.location.origin;
  const currentHost = window.location.hostname;

  if (isLocalHost(currentHost) || isPrivateNetworkHost(currentHost)) {
    return `${window.location.protocol}//${currentHost}:4000`;
  }

  if (currentOrigin.includes("github.dev") || currentOrigin.includes("app.github.dev") || currentOrigin.includes("githubpreview.dev")) {
    const previewBackendUrl = getPreviewBackendUrl(currentHost);
    if (previewBackendUrl) return previewBackendUrl;
  }

  return currentOrigin;
};

export const API_URL = configuredBaseUrl || getDefaultServerUrl();
export const SERVER_URL = configuredBaseUrl || getDefaultServerUrl();
