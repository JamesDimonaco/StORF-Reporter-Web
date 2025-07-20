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
      response.outputs = {
        stdout: result.stdout,
        stderr: result.stderr
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