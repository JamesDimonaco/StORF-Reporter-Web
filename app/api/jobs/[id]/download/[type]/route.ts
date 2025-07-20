import { NextRequest, NextResponse } from 'next/server'
import { storfQueue } from '@/lib/queue'
import { promises as fs } from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; type: string }> }
) {
  try {
    const { id: jobId, type } = await params
    
    // Validate type
    if (!['gff', 'fasta', 'log'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid file type' },
        { status: 400 }
      )
    }

    // Get job from queue
    const jobs = await storfQueue.getJobs(['completed'])
    const queueJob = jobs.find(job => job.data.jobId === jobId)
    
    if (!queueJob) {
      return NextResponse.json(
        { error: 'Job not found or not completed' },
        { status: 404 }
      )
    }

    const result = queueJob.returnvalue
    if (!result) {
      return NextResponse.json(
        { error: 'No results available' },
        { status: 404 }
      )
    }

    let fileContent: Buffer | null = null
    let filename: string = ''
    let contentType: string = 'text/plain'

    if (type === 'log') {
      // Return stdout log
      fileContent = Buffer.from(result.stdout || '')
      filename = 'stdout.log'
    } else {
      // For file downloads, read from the actual volume
      try {
        // Get the actual host path for the Docker volume
        const volumeName = 'storf-reporter_storf-data'
        const { stdout: volumePath } = await execAsync(`docker volume inspect ${volumeName} --format '{{.Mountpoint}}'`)
        const hostPath = volumePath.trim()
        
        // Construct the job directory path
        const jobDir = path.join(hostPath, jobId)
        const outputDir = path.join(jobDir, 'output')
        
        if (type === 'gff' && result.outputs?.gff) {
          const filePath = path.join(outputDir, result.outputs.gff.filename)
          fileContent = await fs.readFile(filePath)
          filename = result.outputs.gff.filename
          if (result.outputs.gff.isGzipped) {
            contentType = 'application/gzip'
          }
        } else if (type === 'fasta' && result.outputs?.fasta) {
          const filePath = path.join(outputDir, result.outputs.fasta.filename)
          fileContent = await fs.readFile(filePath)
          filename = result.outputs.fasta.filename
          if (result.outputs.fasta.isGzipped) {
            contentType = 'application/gzip'
          }
        }
      } catch (error) {
        console.error('Error reading file from volume:', error)
        return NextResponse.json(
          { error: 'Failed to read file' },
          { status: 500 }
        )
      }
    }

    if (!fileContent) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }
    
    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
  } catch (error) {
    console.error('Error downloading file:', error)
    return NextResponse.json(
      { error: 'Failed to download file' },
      { status: 500 }
    )
  }
}