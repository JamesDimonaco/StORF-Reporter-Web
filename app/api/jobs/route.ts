import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'
import { storfQueue } from '@/lib/queue'

// Create a jobs directory to store uploaded files and results
const JOBS_DIR = path.join(process.cwd(), 'jobs')

// Ensure jobs directory exists
async function ensureJobsDir() {
  try {
    await fs.access(JOBS_DIR)
  } catch {
    await fs.mkdir(JOBS_DIR, { recursive: true })
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureJobsDir()

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const optionsStr = formData.get('options') as string
    const options = JSON.parse(optionsStr)

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Generate unique job ID
    const jobId = crypto.randomBytes(16).toString('hex')
    const jobDir = path.join(JOBS_DIR, jobId)
    await fs.mkdir(jobDir, { recursive: true })

    // Save uploaded file
    const buffer = Buffer.from(await file.arrayBuffer())
    const inputPath = path.join(jobDir, 'input.fasta')
    await fs.writeFile(inputPath, buffer)

    // Save job metadata
    const metadata = {
      id: jobId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      filename: file.name,
      options
    }
    await fs.writeFile(
      path.join(jobDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    )

    // Add job to queue
    const job = await storfQueue.add({
      jobId,
      filename: file.name,
      inputPath,
      outputDir: path.join(jobDir, 'output'),
      options
    })

    console.log(`Job ${jobId} added to queue with Bull ID: ${job.id}`)

    return NextResponse.json({ jobId })
  } catch (error) {
    console.error('Error creating job:', error)
    return NextResponse.json(
      { error: 'Failed to create job' },
      { status: 500 }
    )
  }
}