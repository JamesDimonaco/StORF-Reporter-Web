require('ts-node').register({
  project: './tsconfig.worker.json',
  transpileOnly: true
})
require('./index.ts')