module.exports = {
  apps: [
    {
      name: 'storf-web',
      script: 'npm',
      args: 'start',
      cwd: './web',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
      },
    },
    {
      name: 'storf-worker',
      script: './worker/start.js',
      cwd: './web',
      instances: 2, // Run 2 workers for parallel processing
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
      },
      max_memory_restart: '1G',
      error_file: './logs/worker-error.log',
      out_file: './logs/worker-out.log',
    },
  ],
};

// Usage:
// npm install -g pm2
// pm2 start ecosystem.config.js
// pm2 status
// pm2 logs
// pm2 stop all