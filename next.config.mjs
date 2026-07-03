/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lint is handled separately; don't fail the production build on lint.
  eslint: { ignoreDuringBuilds: true }
}

export default nextConfig
