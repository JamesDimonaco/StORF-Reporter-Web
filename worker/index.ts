import { exec } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import path from "path";
import { storfQueue, StorfJobData } from "../lib/queue";

const execAsync = promisify(exec);

// Process StORF jobs
storfQueue.process(async (job) => {
  const data: StorfJobData = job.data;
  console.log(`Processing job ${data.jobId}`);

  // Declare variables outside try block
  let inputPath = data.inputPath;
  let outputDir = data.outputDir;

  try {
    // Update job progress
    await job.progress(10);

    // Handle file content from Vercel (base64) or local path

    if (data.fileContent) {
      // Vercel mode: decode base64 and save to shared volume
      const tempDir = `/app/jobs/${data.jobId}`;
      await fs.mkdir(tempDir, { recursive: true });

      inputPath = path.join(tempDir, data.filename);
      outputDir = path.join(tempDir, "output");

      console.log(`Saving file to: ${inputPath}`);
      
      // Decode and save file
      const fileBuffer = Buffer.from(data.fileContent, "base64");
      await fs.writeFile(inputPath, fileBuffer);
      console.log(`File saved, size: ${fileBuffer.length} bytes`);
      
      await fs.mkdir(outputDir, { recursive: true });
    }

    // Build docker command
    const dockerCmd = await buildDockerCommand(inputPath!, outputDir!, data.options);

    // Update job progress
    await job.progress(20);

    // Debug: Check if file exists
    try {
      await fs.access(inputPath!);
      console.log(`File exists at: ${inputPath}`);
      const stats = await fs.stat(inputPath!);
      console.log(`File size: ${stats.size} bytes`);
    } catch (err) {
      console.error(`File not found at: ${inputPath}`);
    }
    
    // Test if Docker is accessible and can see the file
    try {
      const { stdout: dockerTest } = await execAsync('docker --version');
      console.log(`Docker version: ${dockerTest.trim()}`);
      
      // Get the actual host path for the Docker volume
      const volumeName = 'storf-reporter_storf-data';
      const { stdout: volumePath } = await execAsync(`docker volume inspect ${volumeName} --format '{{.Mountpoint}}'`);
      const hostPath = volumePath.trim();
      const jobHostPath = hostPath + inputPath!.replace('/app/jobs', '');
      
      console.log(`Volume mount point: ${hostPath}`);
      console.log(`Job file host path: ${jobHostPath}`);
      
      // Test if the file is accessible
      const testFileCmd = `docker run --rm -v "${path.dirname(jobHostPath)}:/data" alpine:latest ls -la /data/`;
      console.log(`Testing file access: ${testFileCmd}`);
      const { stdout: lsOutput } = await execAsync(testFileCmd);
      console.log(`Files in container: ${lsOutput}`);
    } catch (err) {
      console.error(`Docker test failed: ${err}`);
    }
    
    // Execute docker command
    console.log(`Executing: ${dockerCmd}`);
    const { stdout, stderr } = await execAsync(dockerCmd);
    
    console.log(`Command stdout (first 500 chars): ${stdout.substring(0, 500)}`);
    console.log(`Command stderr (first 500 chars): ${stderr.substring(0, 500)}`);

    // Update job progress
    await job.progress(80);

    // Save logs
    const jobDir = path.dirname(inputPath!);
    await fs.writeFile(path.join(jobDir, "stdout.log"), stdout);
    await fs.writeFile(path.join(jobDir, "stderr.log"), stderr);

    // Update job progress
    await job.progress(100);

    // For Vercel mode, read output files and return content
    let outputs: any = {};
    if (data.fileContent) {
      // Read output files
      try {
        const outputFiles = await fs.readdir(outputDir!);
        console.log(`Output files found: ${outputFiles.join(', ')}`);

        for (const file of outputFiles) {
          if (file.endsWith(".gff") || file.endsWith(".gff.gz")) {
            const stats = await fs.stat(path.join(outputDir!, file));
            outputs.gff = {
              filename: file,
              size: stats.size,
              isGzipped: file.endsWith(".gz"),
            };
          } else if (
            file.endsWith(".fa") ||
            file.endsWith(".fasta") ||
            file.endsWith(".fna") ||
            file.endsWith(".fa.gz") ||
            file.endsWith(".fasta.gz") ||
            file.endsWith(".fna.gz")
          ) {
            const stats = await fs.stat(path.join(outputDir!, file));
            outputs.fasta = {
              filename: file,
              size: stats.size,
              isGzipped: file.endsWith(".gz"),
            };
          }
        }
      } catch (error) {
        console.error("Error reading output files:", error);
      }
    }

    // Return success result
    const result = {
      status: "completed",
      stdout,
      stderr,
      outputDir: data.outputDir,
      outputs,
    };
    
    console.log(`Job ${data.jobId} returning result with:`, {
      stdoutLength: stdout.length,
      stderrLength: stderr.length,
      outputFiles: Object.keys(outputs),
      outputSizes: Object.entries(outputs).map(([key, val]: [string, any]) => 
        `${key}: ${val.content ? val.content.length : 0} bytes`
      )
    });
    
    return result;
  } catch (error: any) {
    console.error(`Job ${data.jobId} failed:`, error);

    // Save error log
    if (inputPath) {
      const jobDir = path.dirname(inputPath);
      await fs.writeFile(
        path.join(jobDir, "error.log"),
        error?.message || error?.toString() || "Unknown error"
      );
    }

    throw error;
  }
});

async function buildDockerCommand(
  inputPath: string,
  outputDir: string,
  options: any
): Promise<string> {
  // Get the actual host path for the Docker volume
  const volumeName = 'storf-reporter_storf-data';
  const { stdout: volumePath } = await execAsync(`docker volume inspect ${volumeName} --format '{{.Mountpoint}}'`);
  const hostPath = volumePath.trim();
  
  // Convert container paths to host paths
  const hostInputPath = hostPath + inputPath.replace('/app/jobs', '');
  const hostOutputDir = hostPath + outputDir.replace('/app/jobs', '');
  
  const mountDir = path.dirname(hostInputPath);
  const inputFile = path.basename(hostInputPath);

  // Use host network mode to avoid network name issues
  let cmd = `docker run --rm --network host -v "${mountDir}:/data" -v "${hostOutputDir}:/output" jamesdimonaco/storf-reporter:latest`;

  // Add annotation type and input type as separate arguments to -anno
  cmd += ` -anno ${options.annotationType} ${options.inputType}`;

  // Add input path
  cmd += ` -p /data/${inputFile}`;

  // Add output directory
  cmd += ` -odir /output`;

  // Add optional parameters
  if (options.minLen !== 30) cmd += ` -min_len ${options.minLen}`;
  if (options.maxLen !== 100000) cmd += ` -max_len ${options.maxLen}`;
  if (options.minOrf !== 99) cmd += ` -minorf ${options.minOrf}`;
  if (options.maxOrf !== 60000) cmd += ` -maxorf ${options.maxOrf}`;
  if (options.aminoAcid) cmd += ` -aa True`;
  if (options.gzOutput) cmd += ` -gz True`;
  if (options.verbose) cmd += ` -verbose True`;
  if (options.annotationType === "Pyrodigal" && options.pyTrain !== "longest") {
    cmd += ` -py_train ${options.pyTrain}`;
  }
  if (options.stopCodons !== "TAG,TGA,TAA")
    cmd += ` -codons ${options.stopCodons}`;
  if (options.olapFilt !== "both-strand")
    cmd += ` -olap_filt ${options.olapFilt}`;

  return cmd;
}

// Handle graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, closing queue...");
  await storfQueue.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, closing queue...");
  await storfQueue.close();
  process.exit(0);
});

// Cleanup old job files every hour
async function cleanupOldFiles() {
  const jobsDir = '/app/jobs';
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  
  try {
    const dirs = await fs.readdir(jobsDir);
    const now = Date.now();
    
    for (const dir of dirs) {
      const dirPath = path.join(jobsDir, dir);
      const stats = await fs.stat(dirPath);
      
      if (stats.isDirectory() && (now - stats.mtimeMs) > maxAge) {
        console.log(`Cleaning up old job directory: ${dir}`);
        await fs.rm(dirPath, { recursive: true, force: true });
      }
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// Run cleanup every hour
setInterval(cleanupOldFiles, 60 * 60 * 1000);

// Clean up old jobs from queue on startup
async function cleanupQueue() {
  try {
    // Clean waiting jobs older than 1 hour
    const waitingJobs = await storfQueue.getWaiting();
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    for (const job of waitingJobs) {
      if (job.timestamp < oneHourAgo) {
        console.log(`Removing old waiting job: ${job.id}`);
        await job.remove();
      }
    }
    
    // Clean completed jobs
    await storfQueue.clean(3600 * 1000, 'completed'); // Jobs older than 1 hour
    await storfQueue.clean(86400 * 1000, 'failed'); // Failed jobs older than 24 hours
    
    console.log('Queue cleanup completed');
  } catch (error) {
    console.error('Error cleaning up queue:', error);
  }
}

// Run cleanup on startup
cleanupOldFiles();
cleanupQueue();

console.log("StORF-Reporter worker started, waiting for jobs...");
