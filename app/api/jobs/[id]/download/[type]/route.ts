import { NextRequest, NextResponse } from 'next/server'
import { storfQueue } from '@/lib/queue'

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
    if (!result || !result.outputs) {
      return NextResponse.json(
        { error: 'No outputs available' },
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
    } else if (type === 'gff' && result.outputs.gff) {
      // Return GFF file
      fileContent = Buffer.from(result.outputs.gff.content, 'base64')
      filename = result.outputs.gff.filename
      if (result.outputs.gff.isGzipped) {
        contentType = 'application/gzip'
      }
    } else if (type === 'fasta' && result.outputs.fasta) {
      // Return FASTA file
      fileContent = Buffer.from(result.outputs.fasta.content, 'base64')
      filename = result.outputs.fasta.filename
      if (result.outputs.fasta.isGzipped) {
        contentType = 'application/gzip'
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