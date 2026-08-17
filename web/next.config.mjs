/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Several lockfiles exist above this directory; pin the root so Next does not
  // guess and then trace files from outside the repo.
  outputFileTracingRoot: new URL(".", import.meta.url).pathname,
};

export default nextConfig;
