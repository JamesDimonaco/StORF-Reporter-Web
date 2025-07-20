import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const JOBS_DIR = path.join(process.cwd(), 'jobs')

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; type: string }> }
) {
  try {
    const { id: jobId, type } = await params
    const jobDir = path.join(JOBS_DIR, jobId)
    
    // Validate type
    if (!['gff', 'fasta', 'log'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid file type' },
        { status: 400 }
      )
    }

    // Check if job exists
    try {
      await fs.access(jobDir)
    } catch {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    let filePath: string | null = null
    let contentType: string = 'text/plain'

    if (type === 'log') {
      // Return stdout log
      filePath = path.join(jobDir, 'stdout.log')
    } else {
      // Look for output files
      const outputDir = path.join(jobDir, 'output')
      const files = await fs.readdir(outputDir)

      if (type === 'gff') {
        const gffFile = files.find(f => f.endsWith('.gff') || f.endsWith('.gff.gz'))
        if (gffFile) {
          filePath = path.join(outputDir, gffFile)
          if (gffFile.endsWith('.gz')) {
            contentType = 'application/gzip'
          }
        }
      } else if (type === 'fasta') {
        const fastaFile = files.find(f => 
          f.endsWith('.fa') || f.endsWith('.fasta') || f.endsWith('.fna') ||
          f.endsWith('.fa.gz') || f.endsWith('.fasta.gz') || f.endsWith('.fna.gz')
        )
        if (fastaFile) {
          filePath = path.join(outputDir, fastaFile)
          if (fastaFile.endsWith('.gz')) {
            contentType = 'application/gzip'
          }
        }
      }
    }

    if (!filePath) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    // Read and return file
    const fileContent = await fs.readFile(filePath)
    
    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="storf_results.${type}${contentType === 'application/gzip' ? '.gz' : ''}"`
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