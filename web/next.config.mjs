/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  poweredByHeader: false,
  // The Python Qiskit server stays private; the browser only talks to this origin.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${process.env.QISKIT_API_URL ?? 'http://127.0.0.1:8000'}/api/:path*` }]
  },
}
