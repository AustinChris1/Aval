/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This app lives in web/ inside a repo that also has a Hardhat project, and
  // there are further lockfiles above it. Pinning the tracing root to this
  // directory stops Next inferring a root outside the repo and tracing files it
  // should not. On Vercel, set the project's Root Directory to `web` and this
  // resolves to the same place.
  outputFileTracingRoot: import.meta.dirname,
  // The product renamed its instrument pages from /letter to /credit; old links
  // in chats and forms keep working.
  async redirects() {
    return [{ source: "/letter/:id", destination: "/credit/:id", permanent: true }];
  },
};

export default nextConfig;
