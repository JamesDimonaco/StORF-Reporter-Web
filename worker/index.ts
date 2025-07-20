import { exec } from 'child_process'
import { promisify } from 'util'
import { promises as fs } from 'fs'
import path from 'path'
import { storfQueue, StorfJobData } from '../lib/queue'

const execAsync = promisify(exec)

// Process StORF jobs
storfQueue.process(async (job) => {
  const data: StorfJobData = job.data
  console.log(`Processing job ${data.jobId}`)

  try {
    // Update job progress
    await job.progress(10)

    // Build docker command
    const dockerCmd = buildDockerCommand(data.inputPath, data.outputDir, data.options)
    
    // Update job progress
    await job.progress(20)
    
    // Execute docker command
    console.log(`Executing: ${dockerCmd}`)
    const { stdout, stderr } = await execAsync(dockerCmd)
    
    // Update job progress
    await job.progress(80)
    
    // Save logs
    const jobDir = path.dirname(data.inputPath)
    await fs.writeFile(path.join(jobDir, 'stdout.log'), stdout)
    await fs.writeFile(path.join(jobDir, 'stderr.log'), stderr)
    
    // Update job progress
    await job.progress(100)
    
    // Return success result
    return {
      status: 'completed',
      stdout,
      stderr,
      outputDir: data.outputDir,
    }
  } catch (error: any) {
    console.error(`Job ${data.jobId} failed:`, error)
    
    // Save error log
    const jobDir = path.dirname(data.inputPath)
    await fs.writeFile(
      path.join(jobDir, 'error.log'),
      error.message || 'Unknown error'
    )
    
    throw error
  }
})

function buildDockerCommand(inputPath: string, outputDir: string, options: any): string {
  const mountDir = path.dirname(inputPath)
  const inputFile = path.basename(inputPath)
  
  let cmd = `docker run --rm --network storf-network -v "${mountDir}:/data" -v "${outputDir}:/output" storf-reporter:latest`
  
  // Add annotation type and input type
  cmd += ` -anno ${options.annotationType} ${options.inputType}`
  
  // Add input path
  cmd += ` -p /data/${inputFile}`
  
  // Add output directory
  cmd += ` -odir /output`
  
  // Add optional parameters
  if (options.minLen !== 30) cmd += ` -min_len ${options.minLen}`
  if (options.maxLen !== 100000) cmd += ` -max_len ${options.maxLen}`
  if (options.minOrf !== 99) cmd += ` -minorf ${options.minOrf}`
  if (options.maxOrf !== 60000) cmd += ` -maxorf ${options.maxOrf}`
  if (options.aminoAcid) cmd += ` -aa True`
  if (options.gzOutput) cmd += ` -gz True`
  if (options.verbose) cmd += ` -verbose True`
  if (options.annotationType === 'Pyrodigal' && options.pyTrain !== 'longest') {
    cmd += ` -py_train ${options.pyTrain}`
  }
  if (options.stopCodons !== 'TAG,TGA,TAA') cmd += ` -codons ${options.stopCodons}`
  if (options.olapFilt !== 'both-strand') cmd += ` -olap_filt ${options.olapFilt}`
  
  return cmd
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing queue...')
  await storfQueue.close()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing queue...')
  await storfQueue.close()
  process.exit(0)
})

console.log('StORF-Reporter worker started, waiting for jobs...')