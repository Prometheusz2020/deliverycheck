/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removido standalone para facilitar debug local se houver conflitos de engine
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
}

export default nextConfig
