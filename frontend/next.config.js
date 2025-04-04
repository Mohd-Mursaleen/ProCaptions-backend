/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      // API rewrites
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/v1/:path*',
      },
      // Serve static files directly from backend
      {
        source: '/uploads/:path*',
        destination: 'http://localhost:8000/uploads/:path*',
      }
      
    ];
    
  },
  httpAgentOptions: {
    keepAlive: true,
  },
  // Add proxy configuration for API requests
  async serverRuntimeConfig() {
    return {
      httpProxy: {
        '/api': {
          target: 'http://localhost:8000',
          pathRewrite: { '^/api': '/api/v1' },
          changeOrigin: true,
          timeout: 60000, // 60 seconds
        },
      },
    };
  },
  // Add images configuration
  images: {
    domains: ['localhost', 'res.cloudinary.com'],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/uploads/**',
      },
    ],
  },
  // Add CORS headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
};

module.exports = nextConfig; 