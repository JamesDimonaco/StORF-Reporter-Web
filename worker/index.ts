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

  try {
    // Update job progress
    await job.progress(10);

    // Handle file content from Vercel (base64) or local path
    let inputPath = data.inputPath;
    let outputDir = data.outputDir;

    if (data.fileContent) {
      // Vercel mode: decode base64 and save to temp
      const tempDir = `/tmp/jobs/${data.jobId}`;
      await fs.mkdir(tempDir, { recursive: true });

      inputPath = path.join(tempDir, data.filename);
      outputDir = path.join(tempDir, "output");

      // Decode and save file
      const fileBuffer = Buffer.from(data.fileContent, "base64");
      await fs.writeFile(inputPath, fileBuffer);
      await fs.mkdir(outputDir, { recursive: true });
    }

    // Build docker command
    const dockerCmd = buildDockerCommand(inputPath!, outputDir!, data.options);

    // Update job progress
    await job.progress(20);

    // Execute docker command
    console.log(`Executing: ${dockerCmd}`);
    const { stdout, stderr } = await execAsync(dockerCmd);

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

        for (const file of outputFiles) {
          if (file.endsWith(".gff") || file.endsWith(".gff.gz")) {
            const content = await fs.readFile(path.join(outputDir!, file));
            outputs.gff = {
              filename: file,
              content: content.toString("base64"),
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
            const content = await fs.readFile(path.join(outputDir!, file));
            outputs.fasta = {
              filename: file,
              content: content.toString("base64"),
              isGzipped: file.endsWith(".gz"),
            };
          }
        }
      } catch (error) {
        console.error("Error reading output files:", error);
      }
    }

    // Return success result
    return {
      status: "completed",
      stdout,
      stderr,
      outputDir: data.outputDir,
      outputs,
    };
  } catch (error: any) {
    console.error(`Job ${data.jobId} failed:`, error);

    // Save error log
    const jobDir = path.dirname(data.inputPath!);
    await fs.writeFile(
      path.join(jobDir, "error.log"),
      error?.message || error?.toString() || "Unknown error"
    );

    throw error;
  }
});

function buildDockerCommand(
  inputPath: string,
  outputDir: string,
  options: any
): string {
  const mountDir = path.dirname(inputPath);
  const inputFile = path.basename(inputPath);

  let cmd = `docker run --rm --network storf-network -v "${mountDir}:/data" -v "${outputDir}:/output" storf-reporter:latest`;

  // Add annotation type and input type
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

console.log("StORF-Reporter worker started, waiting for jobs...");
