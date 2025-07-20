import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { storfQueue } from '@/lib/queue'

export async function POST(request: NextRequest) {
  try {
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

    // Read file content
    const buffer = Buffer.from(await file.arrayBuffer())
    const fileContent = buffer.toString('base64')

    // Add job to queue with file content
    const job = await storfQueue.add({
      jobId,
      filename: file.name,
      fileContent, // Base64 encoded file
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