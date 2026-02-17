import React, { useState } from 'react';
import UIBlock from './UIBlock';
import UIButton from './UIButton';
import { parseNarrative } from '../utils/parseNarrative';
import '../styles/step2.css';

export default function Step2UploadNarrative({ narrativeResult, setNarrativeResult }) {
  const [file, setFile] = useState(null);
  const [rawText, setRawText] = useState(narrativeResult?.rawText || '');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
  };

  const handleRunScanner = async () => {
    if (!file) return;

    setIsScanning(true);
    
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const result = parseNarrative(text);
        setRawText(result.rawText);
        setNarrativeResult(result);
        setIsScanning(false);
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('Scanner error:', error);
      setIsScanning(false);
    }
  };

  return (
    <div className="step2-container">
      <UIBlock title="VA Rating Narrative Upload">
        <div className={`step2-upload-zone ${file ? 'has-file' : ''}`}>
          <input 
            type="file"
            id="narrative-file"
            className="step2-file-input"
            accept=".pdf,.txt,.doc,.docx"
            onChange={handleFileChange}
          />
          <label htmlFor="narrative-file">
            <div className="step2-upload-icon">📄</div>
            <div className="step2-upload-text">
              {file ? file.name : 'Click to upload VA rating decision'}
            </div>
            <div className="step2-upload-hint">
              PDF, TXT, DOC, or DOCX
            </div>
          </label>
        </div>

        <UIButton 
          className="step2-scanner-button"
          onClick={handleRunScanner}
          disabled={!file || isScanning}
        >
          {isScanning ? 'Scanning...' : 'Run Scanner'}
        </UIButton>

        {extractedText && (
          <div className="step2-preview">
            <button 
              className="step2-preview-toggle"
        {rawText && (
          <div className="step2-preview">
            <button 
              className="step2-preview-toggle"
              onClick={() => setIsPreviewOpen(!isPreviewOpen)}
            >
              {isPreviewOpen ? 'Hide' : 'View'} Raw Output
            </button>
            {isPreviewOpen && (
              <div className="step2-preview-content">
                {rawText}
      </UIBlock>
    </div>
  );
}
