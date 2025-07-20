import { NextRequest, NextResponse } from 'next/server'
import { createBullBoard } from '@bull-board/api'
import { BullAdapter } from '@bull-board/api/bullAdapter'
import { ExpressAdapter } from '@bull-board/express'
import { storfQueue } from '@/lib/queue'

// Create Bull Board
const serverAdapter = new ExpressAdapter()
serverAdapter.setBasePath('/api/admin/queues')

createBullBoard({
  queues: [new BullAdapter(storfQueue)],
  serverAdapter: serverAdapter,
})

export async function GET(request: NextRequest) {
  // Simple authentication check (you should implement proper auth)
  const authHeader = request.headers.get('authorization')
  if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_TOKEN || 'admin-secret'}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Return Bull Board UI
  return new NextResponse(
    `<!DOCTYPE html>
    <html>
    <head>
      <title>Queue Monitor</title>
      <style>
        body { margin: 0; padding: 0; }
        iframe { width: 100%; height: 100vh; border: none; }
      </style>
    </head>
    <body>
      <iframe src="/api/admin/queues/ui"></iframe>
    </body>
    </html>`,
    {
      headers: {
        'Content-Type': 'text/html',
      },
    }
  )
}