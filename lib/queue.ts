import Bull from 'bull'
import Redis from 'ioredis'

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
}

// Create Redis clients
export const redis = new Redis(redisConfig)

// Create Bull queue for StORF jobs
export const storfQueue = new Bull('storf-jobs', {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 100 // Keep max 100 completed jobs
    },
    removeOnFail: {
      age: 86400 // Keep failed jobs for 24 hours
    },
    attempts: 3,            // Retry failed jobs 3 times
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
})

// Job data interface
export interface StorfJobData {
  jobId: string
  filename: string
  inputPath?: string
  outputDir?: string
  fileContent?: string  // Base64 encoded file content for Vercel mode
  options: {
    annotationType: string
    inputType: string
    minLen: number
    maxLen: number
    minOrf: number
    maxOrf: number
    aminoAcid: boolean
    gzOutput: boolean
    pyTrain: string
    stopCodons: string
    olapFilt: string
    verbose: boolean
  }
}

// Add event listeners for debugging
storfQueue.on('error', (error) => {
  console.error('Queue error:', error)
})

storfQueue.on('waiting', (jobId) => {
  console.log(`Job ${jobId} is waiting`)
})

storfQueue.on('active', (job) => {
  console.log(`Job ${job.id} has started`)
})

storfQueue.on('completed', (job) => {
  console.log(`Job ${job.id} has completed`)
})

storfQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} has failed:`, err)
})