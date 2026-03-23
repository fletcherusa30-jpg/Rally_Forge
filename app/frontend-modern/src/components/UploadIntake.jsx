import React, { useState } from 'react';

/**
 * UploadIntake Component
 * Handles document upload and initial intake of DD-214, STR, rating decisions, etc.
 */
export default function UploadIntake({ onUploadComplete, veteranId }) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type.includes('enter'));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFiles(e.target.files);
    }
  };

  const processFiles = async (files) => {
    const newFiles = Array.from(files);
    setUploadedFiles([...uploadedFiles, ...newFiles]);

    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i];
      const progress = Math.round(((i + 1) / newFiles.length) * 100);
      setUploadProgress(progress);

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('veteranId', veteranId);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) throw new Error('Upload failed');

        const result = await response.json();
        onUploadComplete?.(result);
      } catch (error) {
        console.error('Upload error:', error);
      }
    }
  };

  const acceptedTypes = '.pdf,.doc,.docx,.jpg,.jpeg,.png';

  return (
    <div className="upload-intake-container p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Upload Military Documents</h2>

      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          multiple
          accept={acceptedTypes}
          onChange={handleChange}
          className="hidden"
          id="file-upload"
        />

        <label htmlFor="file-upload" className="cursor-pointer">
          <div className="mb-4">
            <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 16.17L4.83 12m0 0L12 4.83m0 0L19.17 12" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-gray-700">Drag documents here or click to browse</p>
          <p className="text-sm text-gray-500 mt-2">Supported: PDF, DOC, DOCX, JPG, PNG</p>
        </label>
      </div>

      {uploadProgress > 0 && (
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2">{uploadProgress}% Complete</p>
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold mb-3">Uploaded Files</h3>
          <ul className="space-y-2">
            {uploadedFiles.map((file, idx) => (
              <li key={idx} className="flex items-center text-sm text-gray-700">
                <span className="w-4 h-4 mr-2 text-green-500">✓</span>
                {file.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
