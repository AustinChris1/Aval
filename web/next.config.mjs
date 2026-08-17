/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This app lives in web/ inside a repo that also has a Hardhat project, and
  // there are further lockfiles above it. Pinning the tracing root to this
  // directory stops Next inferring a root outside the repo and tracing files it
  // should not. On Vercel, set the project's Root Directory to `web` and this
  // resolves to the same place.
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
