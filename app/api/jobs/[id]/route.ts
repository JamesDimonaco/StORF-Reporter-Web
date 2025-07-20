import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { storfQueue } from '@/lib/queue'

const JOBS_DIR = path.join(process.cwd(), 'jobs')

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params
    const jobDir = path.join(JOBS_DIR, jobId)
    const metadataPath = path.join(jobDir, 'metadata.json')

    // Check if job exists
    try {
      await fs.access(metadataPath)
    } catch {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Read metadata
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'))

    // Check Bull queue for job status
    const jobs = await storfQueue.getJobs(['waiting', 'active', 'completed', 'failed'])
    const queueJob = jobs.find(job => job.data.jobId === jobId)
    
    let status = metadata.status
    if (queueJob) {
      const jobState = await queueJob.getState()
      if (jobState === 'waiting') status = 'pending'
      else if (jobState === 'active') status = 'running'
      else if (jobState === 'completed') status = 'completed'
      else if (jobState === 'failed') status = 'failed'
      
      // Update metadata if status changed
      if (status !== metadata.status) {
        metadata.status = status
        metadata.updatedAt = new Date().toISOString()
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2))
      }
    }

    // Prepare response
    const response: any = {
      status,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt
    }

    if (metadata.error) {
      response.error = metadata.error
    }

    // If completed, check for output files
    if (metadata.status === 'completed') {
      const outputDir = path.join(jobDir, 'output')
      const outputs: any = {}

      try {
        const files = await fs.readdir(outputDir)
        
        // Look for output files
        for (const file of files) {
          if (file.endsWith('.gff') || file.endsWith('.gff.gz')) {
            outputs.gff = file
          } else if (file.endsWith('.fa') || file.endsWith('.fasta') || 
                     file.endsWith('.fna') || file.endsWith('.fa.gz') || 
                     file.endsWith('.fasta.gz') || file.endsWith('.fna.gz')) {
            outputs.fasta = file
          }
        }

        // Read log file if exists
        try {
          const log = await fs.readFile(path.join(jobDir, 'stdout.log'), 'utf-8')
          outputs.log = log.substring(0, 5000) // First 5000 chars for preview
        } catch {
          // Log file might not exist
        }

        response.outputs = outputs
      } catch {
        // Output directory might not exist
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching job status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch job status' },
      { status: 500 }
    )
  }
}