'use client'

import { useEffect, useState } from 'react'
import { Download, CheckCircle, XCircle, Loader2, FileText } from 'lucide-react'

interface ResultsDisplayProps {
  jobId: string
  onResultsReceived: (results: any) => void
}

type JobStatus = 'pending' | 'running' | 'completed' | 'failed'

interface JobResult {
  status: JobStatus
  message?: string
  outputs?: {
    gff?: string
    fasta?: string
    log?: string
  }
  error?: string
}

export function ResultsDisplay({ jobId, onResultsReceived }: ResultsDisplayProps) {
  const [status, setStatus] = useState<JobStatus>('pending')
  const [result, setResult] = useState<JobResult | null>(null)
  const [polling, setPolling] = useState(true)
  const [loadingResults, setLoadingResults] = useState(false)

  useEffect(() => {
    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/jobs/${jobId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch job status')
        }

        const data: JobResult = await response.json()
        setStatus(data.status)

        if (data.status === 'completed' || data.status === 'failed') {
          setPolling(false)
          if (data.status === 'completed') {
            setLoadingResults(true)
            // Give a moment for the results to be fully available
            setTimeout(() => {
              setResult(data)
              setLoadingResults(false)
              onResultsReceived(data)
            }, 1000)
          } else {
            setResult(data)
          }
        } else {
          setResult(data)
        }
      } catch (error) {
        console.error('Error polling job status:', error)
        setStatus('failed')
        setPolling(false)
      }
    }

    if (polling) {
      const interval = setInterval(pollStatus, 2000) // Poll every 2 seconds
      pollStatus() // Initial poll

      return () => clearInterval(interval)
    }
  }, [jobId, polling, onResultsReceived])

  const downloadFile = async (fileType: 'gff' | 'fasta' | 'log') => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/download/${fileType}`)
      if (!response.ok) {
        throw new Error('Failed to download file')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `storf_results.${fileType}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading file:', error)
      alert('Failed to download file')
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-semibold text-gray-900 mb-4">Analysis Results</h2>

      <div className="space-y-4">
        {/* Status Display */}
        <div className="flex items-center space-x-3">
          {status === 'pending' && (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />
              <span className="text-gray-700">Job queued...</span>
            </>
          )}
          {status === 'running' && (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              <span className="text-gray-700">Analysis in progress...</span>
            </>
          )}
          {status === 'completed' && !loadingResults && (
            <>
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-gray-700">Analysis completed successfully!</span>
            </>
          )}
          {status === 'completed' && loadingResults && (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-green-500" />
              <span className="text-gray-700">Loading results...</span>
            </>
          )}
          {status === 'failed' && (
            <>
              <XCircle className="h-5 w-5 text-red-500" />
              <span className="text-gray-700">Analysis failed</span>
            </>
          )}
        </div>

        {/* Job ID */}
        <div className="text-sm text-gray-600">
          Job ID: <code className="bg-gray-100 px-2 py-1 rounded">{jobId}</code>
        </div>

        {/* Error Message */}
        {result?.error && (
          <div className="bg-red-50 border border-red-200 rounded p-4">
            <p className="text-sm text-red-800">{result.error}</p>
          </div>
        )}

        {/* Download Buttons */}
        {status === 'completed' && !loadingResults && result?.outputs && (
          <div className="pt-4 space-y-3">
            <h3 className="text-lg font-medium text-gray-900">Download Results</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {result.outputs.gff && (
                <button
                  onClick={() => downloadFile('gff')}
                  className="flex items-center justify-center space-x-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  <span>GFF File</span>
                  <Download className="h-4 w-4" />
                </button>
              )}
              {result.outputs.fasta && (
                <button
                  onClick={() => downloadFile('fasta')}
                  className="flex items-center justify-center space-x-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  <span>FASTA File</span>
                  <Download className="h-4 w-4" />
                </button>
              )}
              {result.outputs.log && (
                <button
                  onClick={() => downloadFile('log')}
                  className="flex items-center justify-center space-x-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  <span>Log File</span>
                  <Download className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Log Preview */}
        {!loadingResults && result?.outputs?.log && (
          <div className="pt-4">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Analysis Log</h3>
            <pre className="bg-gray-100 p-4 rounded overflow-x-auto text-sm">
              {result.outputs.log}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}