/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // standalone: self-contained node server for the Docker production image
  output: 'standalone',
};

module.exports = nextConfig;
