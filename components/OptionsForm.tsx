'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

interface OptionsFormProps {
  file: File
  onJobSubmit: (jobId: string) => void
}

export function OptionsForm({ file, onJobSubmit }: OptionsFormProps) {
  const [loading, setLoading] = useState(false)
  const [options, setOptions] = useState({
    annotationType: 'Pyrodigal',
    inputType: 'Single_FASTA',
    minLen: 30,
    maxLen: 100000,
    minOrf: 99,
    maxOrf: 60000,
    aminoAcid: false,
    gzOutput: false,
    pyTrain: 'longest',
    stopCodons: 'TAG,TGA,TAA',
    olapFilt: 'both-strand',
    verbose: false
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('options', JSON.stringify(options))

    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to submit job')
      }

      const data = await response.json()
      onJobSubmit(data.jobId)
    } catch (error) {
      console.error('Error submitting job:', error)
      alert('Failed to submit job. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
      <h2 className="text-2xl font-semibold text-gray-900">Analysis Options</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Annotation Type
          </label>
          <select
            value={options.annotationType}
            onChange={(e) => setOptions({ ...options, annotationType: e.target.value })}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="Pyrodigal">Complete Annotation (Pyrodigal)</option>
            <option value="Prokka">Prokka Annotation</option>
            <option value="Bakta">Bakta Annotation</option>
            <option value="Feature_Types">Standard GFF</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pyrodigal Training Mode
          </label>
          <select
            value={options.pyTrain}
            onChange={(e) => setOptions({ ...options, pyTrain: e.target.value })}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            disabled={options.annotationType !== 'Pyrodigal'}
          >
            <option value="longest">Longest Contig</option>
            <option value="individual">Individual</option>
            <option value="meta">Meta</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Minimum UR Length (nt)
          </label>
          <input
            type="number"
            value={options.minLen}
            onChange={(e) => setOptions({ ...options, minLen: parseInt(e.target.value) })}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            min="1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Maximum UR Length (nt)
          </label>
          <input
            type="number"
            value={options.maxLen}
            onChange={(e) => setOptions({ ...options, maxLen: parseInt(e.target.value) })}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            min="1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Minimum StORF Size (nt)
          </label>
          <input
            type="number"
            value={options.minOrf}
            onChange={(e) => setOptions({ ...options, minOrf: parseInt(e.target.value) })}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            min="1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Maximum StORF Size (nt)
          </label>
          <input
            type="number"
            value={options.maxOrf}
            onChange={(e) => setOptions({ ...options, maxOrf: parseInt(e.target.value) })}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            min="1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Stop Codons
          </label>
          <input
            type="text"
            value={options.stopCodons}
            onChange={(e) => setOptions({ ...options, stopCodons: e.target.value })}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="TAG,TGA,TAA"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Overlap Filtering
          </label>
          <select
            value={options.olapFilt}
            onChange={(e) => setOptions({ ...options, olapFilt: e.target.value })}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="none">None</option>
            <option value="single-strand">Single Strand</option>
            <option value="both-strand">Both Strand</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        <label className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={options.aminoAcid}
            onChange={(e) => setOptions({ ...options, aminoAcid: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Output amino acid sequences</span>
        </label>

        <label className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={options.gzOutput}
            onChange={(e) => setOptions({ ...options, gzOutput: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Compress output (.gz)</span>
        </label>

        <label className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={options.verbose}
            onChange={(e) => setOptions({ ...options, verbose: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Verbose output</span>
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />
            Submitting...
          </>
        ) : (
          'Run Analysis'
        )}
      </button>
    </form>
  )
}