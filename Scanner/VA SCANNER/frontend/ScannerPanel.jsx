import { useEffect, useMemo, useState } from "react";
import { processNarrative } from "./useScanner.js";
import {
  detectDocumentType,
  extractPDFText,
  getPDFManualExtractionInstructions,
  isPDF
} from "./utils/pdfExtractor.js";
import "./ScannerPanel.css";

export default function ScannerPanel({ initialText = "", onScanComplete }) {
  const [inputText, setInputText] = useState("");
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrProgress, setOcrProgress] = useState(0);
  const [fileName, setFileName] = useState("");
  const [docTypeHint, setDocTypeHint] = useState(null);
  const [exportStatus, setExportStatus] = useState("");
  const [ackWarning, setAckWarning] = useState(false);
  const [binaryWarning, setBinaryWarning] = useState("");

  const charCount = inputText.length;
  const isTooShort = inputText.trim().length < 20;
  const sampleText =
    "VA Rating Decision\n\nService connection is granted for: Post-Traumatic Stress Disorder (70%) and Tinnitus (10%).\nService connection is denied for: Migraine headaches (not service connected).\n\nEffective Date: May 1, 2024\nCombined Rating: 70%\nFile Number: 123456789";

  useEffect(() => {
    if (initialText && initialText !== inputText) {
      setInputText(initialText);
    }
  }, [initialText]);

  useEffect(() => {
    if (inputText.trim().length < 20) {
      setDocTypeHint(null);
      setBinaryWarning("");
      return;
    }
    const nonPrintable = (inputText.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g) || []).length;
    const printable = (inputText.match(/[\x20-\x7E]/g) || []).length;
    const printableRatio = printable / Math.max(1, printable + nonPrintable);
    const looksLikePdfBinary = /FlateDecode|endstream|endobj|xref|\/Filter\//i.test(inputText);
    if (printableRatio < 0.85 || looksLikePdfBinary) {
      setBinaryWarning("This looks like raw PDF/binary data. Please upload the PDF file or paste extracted text instead.");
    } else {
      setBinaryWarning("");
    }
    setDocTypeHint(detectDocumentType(inputText));
  }, [inputText]);

  useEffect(() => {
    if (inputText.trim().length > 0) {
      setErrorMessage("");
    }
  }, [inputText]);

  useEffect(() => {
    setAckWarning(false);
  }, [docTypeHint?.warning]);

  const summary = useMemo(() => {
    if (!result) return null;
    const serviceConnected = Array.isArray(result.serviceConnected)
      ? result.serviceConnected
      : result.serviceConnected?.conditions || [];
    const denied = Array.isArray(result.denied)
      ? result.denied
      : result.denied?.conditions || [];
    const ancillary = Array.isArray(result.ancillaryBenefits)
      ? result.ancillaryBenefits
      : result.ancillaryBenefits?.benefits || [];
    const evidence = Array.isArray(result.evidence)
      ? result.evidence
      : result.evidence?.items || [];
    const evidenceByType = result.evidenceByType || result.evidence?.byType || {};
    const evidenceTypes = Object.entries(evidenceByType).map(([type, items]) => ({
      type,
      count: Array.isArray(items) ? items.length : Number(items) || 0
    }));
    return {
      serviceConnected,
      denied,
      ancillary,
      evidence,
      evidenceTypes,
      serviceConnectedCount: serviceConnected.length,
      deniedCount: denied.length,
      ancillaryCount: ancillary.length,
      evidenceCount: evidence.length
    };
  }, [result]);

  const insights = useMemo(() => {
    if (!summary || !result) return null;
    const topConditions = [...summary.serviceConnected]
      .map((item) => ({
        condition: item.condition,
        percentage: Number(String(item.percentage ?? item.rating ?? "").replace(/[^\d]/g, "")) || 0
      }))
      .filter((item) => item.condition)
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 3);

    const evidenceTimeline = summary.evidence.map((item) => ({
      label: item.type || item.description || item.source || "Evidence item",
      date: item.date || item.effectiveDate || item.createdAt || "Unknown date"
    }));

    return {
      combinedRating: result.metadata?.combinedRating || "Unknown",
      decisionDate: result.metadata?.decisionDate || "Unknown",
      topConditions,
      evidenceTimeline
    };
  }, [summary, result]);

  const quality = useMemo(() => {
    if (!result) return null;
    const totalItems = result.extractionSummary?.totalItems ??
      (summary ? summary.serviceConnectedCount + summary.deniedCount + summary.ancillaryCount + summary.evidenceCount : 0);
    return {
      source: result.source || result.metadata?.extractionSource || "scanner",
      scannerVersion: result.scannerVersion || "v3",
      totalItems,
      executionTime: result.extractionSummary?.executionTime || null,
      aiEnhanced: result.aiValidation?.enhanced || false,
      aiConfidence: result.aiValidation?.confidence ?? null
    };
  }, [result, summary]);

  const handleScan = async () => {
    console.log("[UI] handleScan called");
    setErrorMessage("");
    setResult(null);

    if (isTooShort) {
      console.warn("[UI] Input too short:", charCount, "chars");
      setErrorMessage("Please enter at least 20 characters from a VA decision letter.");
      return;
    }

    if (binaryWarning) {
      console.warn("[UI] Binary warning present");
      setErrorMessage(binaryWarning);
      return;
    }

    if (docTypeHint?.warning && !ackWarning) {
      console.warn("[UI] Doc type warning not acknowledged");
      setErrorMessage("Please confirm the document type warning before continuing.");
      return;
    }

    console.log("[UI] Validations passed, starting scan of", charCount, "chars");
    setIsLoading(true);
    try {
      console.log("[UI] Calling processNarrative...");
      const data = await processNarrative(inputText);
      console.log("[UI] processNarrative returned - got", data?.serviceConnected?.length || 0, "service-connected items");
      const serviceConnected = Array.isArray(data.serviceConnected)
        ? data.serviceConnected
        : data.serviceConnected?.conditions || [];
      const denied = Array.isArray(data.denied)
        ? data.denied
        : data.denied?.conditions || [];

      const disabilities = [
        ...serviceConnected.map((item) => item.condition).filter(Boolean),
        ...denied.map((item) => item.condition).filter(Boolean)
      ];

      const ratings = {};
      serviceConnected.forEach((item) => {
        const raw = item.percentage ?? item.rating ?? item.rate ?? null;
        const value = Number(String(raw || "").replace(/[^\d]/g, ""));
        if (item.condition && Number.isFinite(value)) {
          ratings[item.condition] = value;
        }
      });

      const normalized = {
        ...data,
        rawText: inputText,
        disabilities: Array.from(new Set(disabilities)),
        ratings,
        deniedConditions: denied
      };

      console.log("[UI] Setting result with", normalized.disabilities.length, "disabilities");
      setResult(normalized);
      if (typeof onScanComplete === "function") {
        console.log("[UI] Calling onScanComplete callback");
        onScanComplete(normalized);
      }
    } catch (error) {
      console.error("[UI] Scan error:", error.message);
      setErrorMessage(error.message || "Scanner failed. Please try again.");

    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setErrorMessage("");
    setResult(null);
    setFileName(file.name);
    setIsExtracting(true);
    setOcrProgress(0);
    setOcrStatus("");

    try {
      if (isPDF(file)) {
        const text = await extractPDFText(file, {
          ocrTimeoutMs: 120000,
          onOcrProgress: (info) => {
            const totalPages = info.totalPages || 0;
            const currentPage = info.page || 0;
            const progress = typeof info.progress === "number" ? info.progress : 0;
            const overall = totalPages > 0
              ? Math.round(((currentPage - 1 + progress) / totalPages) * 100)
              : Math.round(progress * 100);

            setOcrStatus(info.status || "recognizing text");
            setOcrProgress(Math.min(100, Math.max(0, overall)));
          }
        });
        setInputText(text);
      } else {
        const text = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result || "");
          reader.onerror = () => reject(new Error("Failed to read file."));
          reader.readAsText(file);
        });
        setInputText(String(text));
      }
    } catch (error) {
      if (error.code === "PDF_SCANNED_IMAGE_DETECTED") {
        setErrorMessage(getPDFManualExtractionInstructions(file.name));
      } else if (error.code === "OCR_TIMEOUT") {
        setErrorMessage("OCR timed out. Try a smaller file or paste the text manually.");
      } else {
        setErrorMessage(error.message || "Unable to extract text from file. Please paste the text manually.");
      }
    } finally {
      setIsExtracting(false);
      event.target.value = "";
    }
  };

  const downloadExport = async (format) => {
    if (!result) return;
    setExportStatus(`Preparing ${format.toUpperCase()} export...`);

    try {
      const response = await fetch(`/api/scanner/export/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scanResults: result,
          fileName: "va_scanner_results"
        })
      });

      if (!response.ok) {
        throw new Error("Export failed. Please try again.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `va_scanner_results.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setExportStatus(`Exported ${format.toUpperCase()} successfully.`);
    } catch (error) {
      setExportStatus(error.message || "Export failed.");
    }

    setTimeout(() => setExportStatus(""), 2500);
  };

  const printSummary = () => {
    window.print();
  };

  return (
    <section className="va-scanner-panel">
      <header className="va-scanner-panel__header">
        <div>
          <p className="va-scanner-panel__eyebrow">VA SCANNER</p>
          <h1 className="va-scanner-panel__title">Decision Letter Analyzer</h1>
          <p className="va-scanner-panel__subtitle">
            Paste a VA rating decision letter to extract conditions, benefits, and evidence.
          </p>
        </div>
      </header>

      <div className="va-scanner-panel__card">
        <div className="va-scanner-panel__upload">
          <label className="va-scanner-panel__upload-label" htmlFor="va-scanner-file">
            Upload VA Rating Decision (PDF or TXT)
          </label>
          <input
            id="va-scanner-file"
            type="file"
            accept=".pdf,.txt"
            onChange={handleFileChange}
          />
          {fileName && (
            <p className="va-scanner-panel__file">Selected: {fileName}</p>
          )}
          {isExtracting && (
            <div className="va-scanner-panel__loading">
              <div className="va-scanner-panel__spinner" aria-hidden="true" />
              <span>
                {ocrStatus ? `OCR: ${ocrStatus}` : "Extracting document..."}
                {ocrProgress > 0 ? ` (${ocrProgress}%)` : ""}
              </span>
            </div>
          )}
          <div className="va-scanner-panel__guidance">
            <div className="va-scanner-panel__guidance-title">Scanner Guidance</div>
            <ol className="va-scanner-panel__guidance-list">
              <li>Upload your VA rating decision PDF or paste the narrative.</li>
              <li>Confirm the detected document type before analyzing.</li>
              <li>Export results once the scan is complete.</li>
            </ol>
          </div>
        </div>

        <label className="va-scanner-panel__label" htmlFor="va-scanner-input">
          Decision Letter Text
        </label>
        <textarea
          id="va-scanner-input"
          className="va-scanner-panel__textarea"
          placeholder="Paste the VA decision letter narrative here..."
          value={inputText}
          onChange={(event) => setInputText(event.target.value)}
          aria-describedby="va-scanner-help"
        />
        <div className="va-scanner-panel__meta">
          <span id="va-scanner-help">Minimum 20 characters.</span>
          <span className={charCount > 0 ? "va-scanner-panel__count" : ""}>
            {charCount} chars
          </span>
        </div>

        {docTypeHint?.type && (
          <div className="va-scanner-panel__doc">
            <span>Detected: {docTypeHint.type.replace(/_/g, " ")}</span>
            {docTypeHint.warning && (
              <div className="va-scanner-panel__doc-warning">
                <p>{docTypeHint.warning}</p>
                <label className="va-scanner-panel__warning-ack">
                  <input
                    type="checkbox"
                    checked={ackWarning}
                    onChange={(event) => setAckWarning(event.target.checked)}
                  />
                  I understand and want to continue anyway.
                </label>
              </div>
            )}
          </div>
        )}

        {binaryWarning && (
          <div className="va-scanner-panel__doc-warning">
            <p>{binaryWarning}</p>
          </div>
        )}

        {errorMessage && (
          <div className="va-scanner-panel__error" role="alert">
            {errorMessage}
          </div>
        )}

        <div className="va-scanner-panel__actions">
          <button
            type="button"
            className="va-scanner-panel__secondary"
            onClick={() => setInputText(sampleText)}
          >
            Load Sample
          </button>
          <button
            type="button"
            className="va-scanner-panel__secondary"
            onClick={() => setInputText("")}
          >
            Clear
          </button>
        </div>

        <button
          type="button"
          className="va-scanner-panel__primary"
          onClick={handleScan}
          disabled={isLoading || isExtracting || !!binaryWarning || (docTypeHint?.warning && !ackWarning)}
        >
          {isLoading ? "Analyzing..." : "Analyze Decision"}
        </button>

        {isLoading && (
          <div className="va-scanner-panel__loading" aria-live="polite">
            <div className="va-scanner-panel__spinner" aria-hidden="true" />
            <span>Analyzing your VA decision...</span>
          </div>
        )}
      </div>

      {summary && (
        <section className="va-scanner-panel__results">
          <div className="va-scanner-panel__results-header">
            <div>
              <p className="va-scanner-panel__eyebrow">Results Overview</p>
              <h2 className="va-scanner-panel__section-title">Extraction Summary</h2>
              <p className="va-scanner-panel__section-subtitle">
                Review conditions, benefits, evidence, and presumptive indicators.
              </p>
            </div>
            <div className="va-scanner-panel__export">
              <button
                type="button"
                className="va-scanner-panel__secondary"
                onClick={() => downloadExport("json")}
              >
                Export JSON
              </button>
              <button
                type="button"
                className="va-scanner-panel__secondary"
                onClick={() => downloadExport("csv")}
              >
                Export CSV
              </button>
              <button
                type="button"
                className="va-scanner-panel__secondary"
                onClick={() => downloadExport("txt")}
              >
                Export TXT
              </button>
              {exportStatus && (
                <span className="va-scanner-panel__export-status">{exportStatus}</span>
              )}
            </div>
          </div>

          <div className="va-scanner-panel__summary">
            <div className="va-scanner-panel__summary-card">
              <div className="va-scanner-panel__summary-header">
                <span className="va-scanner-panel__summary-icon va-scanner-panel__summary-icon--sc" aria-hidden="true" />
                <p className="va-scanner-panel__summary-label">Service-Connected</p>
              </div>
              <p className="va-scanner-panel__summary-value">{summary.serviceConnectedCount}</p>
            </div>
            <div className="va-scanner-panel__summary-card">
              <div className="va-scanner-panel__summary-header">
                <span className="va-scanner-panel__summary-icon va-scanner-panel__summary-icon--den" aria-hidden="true" />
                <p className="va-scanner-panel__summary-label">Denied</p>
              </div>
              <p className="va-scanner-panel__summary-value">{summary.deniedCount}</p>
            </div>
            <div className="va-scanner-panel__summary-card">
              <div className="va-scanner-panel__summary-header">
                <span className="va-scanner-panel__summary-icon va-scanner-panel__summary-icon--ben" aria-hidden="true" />
                <p className="va-scanner-panel__summary-label">Ancillary Benefits</p>
              </div>
              <p className="va-scanner-panel__summary-value">{summary.ancillaryCount}</p>
            </div>
            <div className="va-scanner-panel__summary-card">
              <div className="va-scanner-panel__summary-header">
                <span className="va-scanner-panel__summary-icon va-scanner-panel__summary-icon--evd" aria-hidden="true" />
                <p className="va-scanner-panel__summary-label">Evidence</p>
              </div>
              <p className="va-scanner-panel__summary-value">{summary.evidenceCount}</p>
            </div>
          </div>

          {insights && (
            <div className="va-scanner-panel__insights">
              <div>
                <p className="va-scanner-panel__summary-label">Mission Insights</p>
                <div className="va-scanner-panel__insights-metrics">
                  <div>
                    <span className="va-scanner-panel__detail-label">Combined Rating</span>
                    <span className="va-scanner-panel__metric">{insights.combinedRating}</span>
                  </div>
                  <div>
                    <span className="va-scanner-panel__detail-label">Decision Date</span>
                    <span className="va-scanner-panel__metric">{insights.decisionDate}</span>
                  </div>
                </div>
              </div>
              <div>
                <span className="va-scanner-panel__detail-label">Top Conditions</span>
                {insights.topConditions.length > 0 ? (
                  <div className="va-scanner-panel__chips">
                    {insights.topConditions.map((item) => (
                      <span key={item.condition} className="va-scanner-panel__chip">
                        {item.condition} {item.percentage}%
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="va-scanner-panel__empty">No rated conditions detected.</p>
                )}
              </div>
            </div>
          )}

          {result.pactAct?.summary && (
            <div className="va-scanner-panel__callout">
              <div>
                <strong>PACT Act Signals</strong>
                <p>
                  {result.pactAct.summary?.totalPACTActConditions || 0} conditions flagged for
                  PACT Act review.
                </p>
              </div>
              <span className="va-scanner-panel__pill">PACT ACT</span>
            </div>
          )}

          {quality && (
            <div className="va-scanner-panel__quality">
              <div>
                <p className="va-scanner-panel__summary-label">Scan Quality</p>
                <p className="va-scanner-panel__summary-value">{quality.totalItems}</p>
                <p className="va-scanner-panel__section-subtitle">Total extracted items</p>
              </div>
              <div className="va-scanner-panel__quality-grid">
                <div>
                  <span className="va-scanner-panel__detail-label">Source</span>
                  <span>{quality.source}</span>
                </div>
                <div>
                  <span className="va-scanner-panel__detail-label">Version</span>
                  <span>{quality.scannerVersion}</span>
                </div>
                <div>
                  <span className="va-scanner-panel__detail-label">Execution Time</span>
                  <span>{quality.executionTime ? `${quality.executionTime} ms` : "Not captured"}</span>
                </div>
                <div>
                  <span className="va-scanner-panel__detail-label">AI Enhanced</span>
                  <span>{quality.aiEnhanced ? "Yes" : "No"}</span>
                </div>
                <div>
                  <span className="va-scanner-panel__detail-label">AI Confidence</span>
                  <span>
                    {quality.aiConfidence === null
                      ? "N/A"
                      : `${Math.round(quality.aiConfidence * 100)}%`}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="va-scanner-panel__summary-card va-scanner-panel__summary-card--wide">
            <div className="va-scanner-panel__summary-header">
              <span className="va-scanner-panel__summary-icon" aria-hidden="true" />
              <p className="va-scanner-panel__summary-label">Executive Summary</p>
            </div>
            <p className="va-scanner-panel__summary-value">{summary.serviceConnectedCount + summary.deniedCount} conditions</p>
            <p className="va-scanner-panel__section-subtitle">
              Combined Rating: {result.metadata?.combinedRating || "Unknown"} · Decision Date: {result.metadata?.decisionDate || "Unknown"}
            </p>
            <button
              type="button"
              className="va-scanner-panel__secondary"
              onClick={printSummary}
            >
              Print Summary
            </button>
          </div>

          <div className="va-scanner-panel__details">
            <details open>
              <summary>
                Metadata
                <span className="va-scanner-panel__pill">{result.metadata?.decisionDate || "Unknown"}</span>
              </summary>
              <div className="va-scanner-panel__detail-grid">
                <div>
                  <span className="va-scanner-panel__detail-label">Veteran Name</span>
                  <span>{result.metadata?.veteranName || "Unknown"}</span>
                </div>
                <div>
                  <span className="va-scanner-panel__detail-label">File Number</span>
                  <span>{result.metadata?.fileNumber || "Unknown"}</span>
                </div>
                <div>
                  <span className="va-scanner-panel__detail-label">Decision Date</span>
                  <span>{result.metadata?.decisionDate || "Unknown"}</span>
                </div>
                <div>
                  <span className="va-scanner-panel__detail-label">Combined Rating</span>
                  <span>{result.metadata?.combinedRating || "Unknown"}</span>
                </div>
              </div>
            </details>

            <details open>
              <summary>
                Service-Connected Conditions
                <span className="va-scanner-panel__pill">{summary.serviceConnectedCount}</span>
              </summary>
              {summary.serviceConnectedCount > 0 ? (
                <div className="va-scanner-panel__disability-grid">
                  {summary.serviceConnected.map((item, index) => (
                    <div key={`${item.condition}-${index}`} className="va-scanner-panel__disability-card">
                      <div className="va-scanner-panel__card-header">
                        <span className="va-scanner-panel__disability-name">{item.condition}</span>
                        <span className="va-scanner-panel__disability-rating">
                          {item.percentage ? `${item.percentage}%` : (item.rating || "0%")}
                        </span>
                      </div>
                      {item.effectiveDate && (
                        <div className="va-scanner-panel__card-date">
                          <span className="va-scanner-panel__card-label">Effective:</span>
                          <span>{item.effectiveDate}</span>
                        </div>
                      )}
                      {item.isBilateral && item.laterality && (
                        <div className="va-scanner-panel__card-bilateral">
                          <span className="va-scanner-panel__bilateral-badge">
                            {item.laterality === 'left' ? '← Left (Non-Dominant)' : '→ Right (Dominant)'}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="va-scanner-panel__empty">No service-connected conditions detected.</p>
              )}
            </details>

            <details>
              <summary>
                Denied Conditions
                <span className="va-scanner-panel__pill">{summary.deniedCount}</span>
              </summary>
              {summary.deniedCount > 0 ? (
                <div className="va-scanner-panel__denied-grid">
                  {summary.denied.map((item, index) => (
                    <div key={`${item.condition}-${index}`} className="va-scanner-panel__denied-card">
                      <span className="va-scanner-panel__denied-name">{item.condition}</span>
                      <span className="va-scanner-panel__denied-reason">
                        {item.reason || "Reason not listed"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="va-scanner-panel__empty">No denied conditions detected.</p>
              )}
            </details>

            <details>
              <summary>
                Ancillary Benefits
                <span className="va-scanner-panel__pill">{summary.ancillaryCount}</span>
              </summary>
              {summary.ancillaryCount > 0 ? (
                <ul className="va-scanner-panel__list">
                  {summary.ancillary.map((item, index) => (
                    <li key={`${item}-${index}`}>{item.benefit || item.shortName || item}</li>
                  ))}
                </ul>
              ) : (
                <p className="va-scanner-panel__empty">No ancillary benefits detected.</p>
              )}
            </details>

            <details>
              <summary>
                Combined Rating Analysis
                <span className="va-scanner-panel__pill">{summary.serviceConnectedCount}</span>
              </summary>
              {result.ratingCalculation ? (
                <div className="va-scanner-panel__rating-analysis">
                  <div className="va-scanner-panel__detail-grid">
                    <div>
                      <span className="va-scanner-panel__detail-label">Extracted Combined Rating</span>
                      <span className="va-scanner-panel__rating-value">
                        {result.ratingCalculation.extractedCombinedRating || result.metadata?.combinedRating || "Unknown"}
                      </span>
                    </div>
                    <div>
                      <span className="va-scanner-panel__detail-label">Calculated From Conditions</span>
                      <span className="va-scanner-panel__rating-value">
                        {result.ratingCalculation.calculatedCombinedRating}%
                      </span>
                    </div>
                  </div>
                  {result.ratingCalculation.bilateralPairs?.length > 0 && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(26,26,26,0.1)' }}>
                      <span className="va-scanner-panel__detail-label" style={{ marginBottom: '8px', display: 'block' }}>
                        Bilateral Conditions (Per 38 CFR 4.25/4.26):
                      </span>
                      <div style={{ fontSize: '0.9rem', color: 'rgba(26,26,26,0.8)' }}>
                        {result.ratingCalculation.bilateralPairs.join(', ')}
                      </div>
                    </div>
                  )}
                  {result.ratingCalculation.conditions?.length > 0 && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(26,26,26,0.1)' }}>
                      <span className="va-scanner-panel__detail-label" style={{ marginBottom: '8px', display: 'block' }}>
                        Individual Ratings:
                      </span>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '8px' }}>
                        {result.ratingCalculation.conditions.map((rating, idx) => (
                          <div key={idx} style={{
                            background: 'rgba(85, 107, 47, 0.08)',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            textAlign: 'center',
                            fontWeight: '600',
                            color: 'var(--rf-primary)'
                          }}>
                            {rating}%
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="va-scanner-panel__empty">No combined rating data available.</p>
              )}
            </details>

            <details>
              <summary>
                Presumptive Flags
                <span className="va-scanner-panel__pill">3</span>
              </summary>
              <div className="va-scanner-panel__detail-grid">
                <div>
                  <span className="va-scanner-panel__detail-label">Presumptive Eligible</span>
                  <span>{result.presumptiveFlags?.presumptiveEligible ? "Yes" : "No"}</span>
                </div>
                <div>
                  <span className="va-scanner-panel__detail-label">Burn Pit Presumption</span>
                  <span>{result.presumptiveFlags?.burnPitPresumption ? "Yes" : "No"}</span>
                </div>
                <div>
                  <span className="va-scanner-panel__detail-label">Combat Presumption</span>
                  <span>{result.presumptiveFlags?.combatPresumption ? "Yes" : "No"}</span>
                </div>
              </div>
            </details>

            <details>
              <summary>
                Claimant Profile
                <span className="va-scanner-panel__pill">{result.claimantInfo?.fileNumber ? 1 : 0}</span>
              </summary>
              <div className="va-scanner-panel__detail-grid">
                <div>
                  <span className="va-scanner-panel__detail-label">Claimant Name</span>
                  <span>{result.claimantInfo?.claimantName || result.metadata?.veteranName || "Unknown"}</span>
                </div>
                <div>
                  <span className="va-scanner-panel__detail-label">File Number</span>
                  <span>{result.claimantInfo?.fileNumber || result.metadata?.fileNumber || "Not found"}</span>
                </div>
                <div>
                  <span className="va-scanner-panel__detail-label">Regional Office</span>
                  <span>{result.claimantInfo?.regionalOffice || result.metadata?.regionalOffice || "Unknown"}</span>
                </div>
                <div>
                  <span className="va-scanner-panel__detail-label">Claimant Confidence</span>
                  <span>{result.claimantInfo?.confidence?.overall ?? 0}%</span>
                </div>
              </div>
            </details>

            <details>
              <summary>
                Combat and Presumptive Context
                <span className="va-scanner-panel__pill">{(result.combatStatus?.combatAwards || []).length}</span>
              </summary>
              <div className="va-scanner-panel__detail-grid">
                <div>
                  <span className="va-scanner-panel__detail-label">Combat Era</span>
                  <span>{result.combatStatus?.combatStatus || "Not detected"}</span>
                </div>
                <div>
                  <span className="va-scanner-panel__detail-label">Service Branch</span>
                  <span>{result.combatStatus?.serviceBranch || result.metadata?.serviceBranch || "Unknown"}</span>
                </div>
                <div>
                  <span className="va-scanner-panel__detail-label">CRSC Eligibility</span>
                  <span>{result.combatStatus?.crscEligible ? "Likely" : "Not indicated"}</span>
                </div>
                <div>
                  <span className="va-scanner-panel__detail-label">Presumptive Categories</span>
                  <span>{(result.combatStatus?.presumptiveCategories || []).join(', ') || "None detected"}</span>
                </div>
              </div>
            </details>

            <details>
              <summary>
                Unemployability (TDIU)
                <span className="va-scanner-panel__pill">{result.tdiu?.isGranted ? 1 : 0}</span>
              </summary>
              <div className="va-scanner-panel__detail-grid">
                <div>
                  <span className="va-scanner-panel__detail-label">TDIU Status</span>
                  <span>{result.tdiu?.isGranted ? "Granted" : "Not granted / unclear"}</span>
                </div>
                <div>
                  <span className="va-scanner-panel__detail-label">Effective Date</span>
                  <span>{result.tdiu?.effectiveDate || "Not found"}</span>
                </div>
                <div>
                  <span className="va-scanner-panel__detail-label">TDIU Type</span>
                  <span>{result.tdiu?.type || "Unknown"}</span>
                </div>
                <div>
                  <span className="va-scanner-panel__detail-label">Confidence</span>
                  <span>{result.tdiu?.confidence?.overall ?? 0}%</span>
                </div>
              </div>
              {result.tdiu?.unemployabilityReason && (
                <p className="va-scanner-panel__muted" style={{ marginTop: '10px' }}>
                  {result.tdiu.unemployabilityReason}
                </p>
              )}
            </details>

            <details>
              <summary>
                Special Monthly Compensation (SMC)
                <span className="va-scanner-panel__pill">
                  {(result.smc?.explicit?.length || 0) + (result.smc?.inferred?.length || 0)}
                </span>
              </summary>
              {(result.smc?.explicit?.length || result.smc?.inferred?.length) ? (
                <div className="va-scanner-panel__detail-grid">
                  <div>
                    <span className="va-scanner-panel__detail-label">Explicit</span>
                    <span>{(result.smc?.explicit || []).join(", ") || "None"}</span>
                  </div>
                  <div>
                    <span className="va-scanner-panel__detail-label">Inferred</span>
                    <span>{(result.smc?.inferred || []).join(", ") || "None"}</span>
                  </div>
                  <div>
                    <span className="va-scanner-panel__detail-label">Indicators</span>
                    <span>{(result.smc?.eligibilityIndicators || []).join(", ") || "None"}</span>
                  </div>
                </div>
              ) : (
                <p className="va-scanner-panel__empty">No SMC indicators detected.</p>
              )}
            </details>

            <details>
              <summary>
                Dependents
                <span className="va-scanner-panel__pill">{(result.dependents || []).length}</span>
              </summary>
              {(result.dependents || []).length ? (
                <ul className="va-scanner-panel__list">
                  {(result.dependents || []).map((item, index) => (
                    <li key={`${item.name}-${index}`}>
                      <span>{item.name}</span>
                      <span className="va-scanner-panel__muted">{item.type} • {item.effectiveDate}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="va-scanner-panel__empty">No dependents detected.</p>
              )}
            </details>

            <details>
              <summary>
                Award-Based Inference
                <span className="va-scanner-panel__pill">{(result.awardEntitlements || []).length}</span>
              </summary>
              {result.awardEntitlements?.length > 0 ? (
                <ul className="va-scanner-panel__list">
                  {(result.awardEntitlements || []).map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="va-scanner-panel__empty">No award-based entitlements detected.</p>
              )}
            </details>

            <details>
              <summary>
                Evidence by Type
                <span className="va-scanner-panel__pill">{summary.evidenceTypes.length}</span>
              </summary>
              {summary.evidenceTypes.length ? (
                <div className="va-scanner-panel__bars">
                  {summary.evidenceTypes.map((item) => (
                    <div key={item.type} className="va-scanner-panel__bar-row">
                      <span className="va-scanner-panel__bar-label">{item.type}</span>
                      <div className="va-scanner-panel__bar-track">
                        <div
                          className="va-scanner-panel__bar-fill"
                          style={{
                            width: `${Math.min(100, (item.count / Math.max(1, Math.max(...summary.evidenceTypes.map((entry) => entry.count)))) * 100)}%`
                          }}
                        />
                      </div>
                      <span className="va-scanner-panel__bar-count">{item.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="va-scanner-panel__empty">No evidence types detected.</p>
              )}
            </details>

            <details>
              <summary>
                Evidence Timeline
                <span className="va-scanner-panel__pill">{insights?.evidenceTimeline.length || 0}</span>
              </summary>
              {insights?.evidenceTimeline.length ? (
                <ul className="va-scanner-panel__timeline">
                  {insights.evidenceTimeline.map((item, index) => (
                    <li key={`${item.label}-${index}`}>
                      <span className="va-scanner-panel__timeline-dot" aria-hidden="true" />
                      <div>
                        <div className="va-scanner-panel__timeline-label">{item.label}</div>
                        <div className="va-scanner-panel__timeline-date">{item.date}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="va-scanner-panel__empty">No evidence timeline items available.</p>
              )}
            </details>
          </div>
        </section>
      )}

      {isLoading && !summary && (
        <section className="va-scanner-panel__results">
          <div className="va-scanner-panel__summary va-scanner-panel__summary--skeleton">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`sk-${index}`} className="va-scanner-panel__summary-card">
                <div className="va-scanner-panel__skeleton-line" />
                <div className="va-scanner-panel__skeleton-value" />
              </div>
            ))}
          </div>
          <div className="va-scanner-panel__details va-scanner-panel__details--skeleton">
            <div className="va-scanner-panel__skeleton-line" />
            <div className="va-scanner-panel__skeleton-line" />
            <div className="va-scanner-panel__skeleton-line" />
          </div>
        </section>
      )}
    </section>
  );
}
