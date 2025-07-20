import { NextRequest, NextResponse } from 'next/server'
import { storfQueue } from '@/lib/queue'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params

    // Check Bull queue for job status
    const jobs = await storfQueue.getJobs(['waiting', 'active', 'completed', 'failed'])
    const queueJob = jobs.find(job => job.data.jobId === jobId)
    
    if (!queueJob) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    const jobState = await queueJob.getState()
    const progress = queueJob.progress
    
    // Check if job is stuck (waiting for more than 5 minutes)
    if (jobState === 'waiting') {
      const waitTime = Date.now() - queueJob.timestamp
      if (waitTime > 5 * 60 * 1000) { // 5 minutes
        console.warn(`Job ${jobId} has been waiting for ${Math.round(waitTime / 1000)}s`)
        
        // Check if there are any active workers
        const workers = await storfQueue.getWorkers()
        if (workers.length === 0) {
          return NextResponse.json({
            status: 'pending',
            error: 'No workers available. Please ensure the worker service is running.',
            waitTime: Math.round(waitTime / 1000)
          })
        }
      }
    }
    
    let status = 'pending'
    if (jobState === 'waiting') status = 'pending'
    else if (jobState === 'active') status = 'running'
    else if (jobState === 'completed') status = 'completed'
    else if (jobState === 'failed') status = 'failed'

    // Prepare response
    const response: any = {
      status,
      progress,
      createdAt: new Date(queueJob.timestamp).toISOString(),
      updatedAt: queueJob.processedOn ? new Date(queueJob.processedOn).toISOString() : null
    }

    // Get job result if completed
    if (jobState === 'completed' && queueJob.returnvalue) {
      const result = queueJob.returnvalue
      response.outputs = {}
      
      // Include file outputs if present
      if (result.outputs) {
        if (result.outputs.gff) response.outputs.gff = result.outputs.gff.filename
        if (result.outputs.fasta) response.outputs.fasta = result.outputs.fasta.filename
      }
      
      // Include log preview
      if (result.stdout) {
        response.outputs.log = result.stdout.substring(0, 5000) // First 5000 chars
      }
    }

    // Get error if failed
    if (jobState === 'failed' && queueJob.failedReason) {
      response.error = queueJob.failedReason
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