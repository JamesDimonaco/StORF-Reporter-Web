'use client'

import { useState } from 'react'
import { FileUpload } from '@/components/FileUpload'
import { OptionsForm } from '@/components/OptionsForm'
import { ResultsDisplay } from '@/components/ResultsDisplay'

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [results, setResults] = useState<any>(null)

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            StORF-Reporter Web Interface
          </h1>
          <p className="text-lg text-gray-600">
            Identify missed CDS genes from prokaryotic genome unannotated regions
          </p>
        </header>

        <div className="space-y-6">
          {!jobId && (
            <>
              <FileUpload onFileSelect={setFile} />
              {file && (
                <OptionsForm 
                  file={file} 
                  onJobSubmit={setJobId}
                />
              )}
            </>
          )}

          {jobId && (
            <ResultsDisplay 
              jobId={jobId} 
              onResultsReceived={setResults}
            />
          )}
        </div>
      </div>
    </main>
  )
}