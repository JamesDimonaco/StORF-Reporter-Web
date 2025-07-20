import { NextResponse } from 'next/server'
import { storfQueue } from '@/lib/queue'

export async function GET() {
  try {
    // Get all jobs
    const waiting = await storfQueue.getWaitingCount()
    const active = await storfQueue.getActiveCount()
    const completed = await storfQueue.getCompletedCount()
    const failed = await storfQueue.getFailedCount()
    
    // Get actual jobs
    const waitingJobs = await storfQueue.getWaiting()
    const activeJobs = await storfQueue.getActive()
    
    // Get worker info
    const workers = await storfQueue.getWorkers()
    
    return NextResponse.json({
      queue: {
        waiting,
        active,
        completed,
        failed
      },
      waitingJobs: waitingJobs.map(job => ({
        id: job.id,
        jobId: job.data.jobId,
        createdAt: new Date(job.timestamp).toISOString(),
        attempts: job.attemptsMade
      })),
      activeJobs: activeJobs.map(job => ({
        id: job.id,
        jobId: job.data.jobId,
        startedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
        progress: job.progress
      })),
      workers: workers.map(w => ({
        id: w.id,
        addr: w.addr,
        started: w.started,
        name: w.name
      }))
    })
  } catch (error) {
    console.error('Debug queue error:', error)
    return NextResponse.json({ error: 'Failed to get queue info' }, { status: 500 })
  }
}