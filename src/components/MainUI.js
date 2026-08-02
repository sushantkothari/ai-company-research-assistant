'use client';

import React, { useState } from 'react';
import styles from './MainUI.module.css';
import { Search, Settings, Building2, Globe, Phone, MapPin, Target, Crosshair, Download, Send, Copy, CheckCircle2, AlertTriangle, ShieldCheck, Link as LinkIcon } from 'lucide-react';
import SettingsModal from './SettingsModal';
import { useSettings } from '@/context/SettingsContext';

export default function MainUI() {
  const { settings } = useSettings();
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('idle'); // idle, searching, crawling, analyzing, complete, error
  const [progressLog, setProgressLog] = useState([]);
  const [result, setResult] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState('');
  const [isSendingDiscord, setIsSendingDiscord] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const addLog = (msg) => {
    setProgressLog(prev => [...prev, { time: new Date().toLocaleTimeString(), msg }]);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    setStatus('crawling');
    setProgressLog([]);
    setResult(null);
    setErrorMsg('');

    addLog(`Initiating deep research for: ${input}`);
    addLog('Resolving target and querying Google Search...');
    
    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: input,
          model: settings.model
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to complete research');
      }

      addLog('Extracting insights and formatting report via OpenRouter...');
      setStatus('analyzing');
      
      const data = await response.json();
      setResult(data);
      addLog('Research complete.');
      setStatus('complete');
      
      if (settings.discordToken && settings.discordChannel) {
        // Wait 800ms for DOM report-content to fully render before sending
        setTimeout(() => {
          sendToDiscord(data);
        }, 800);
      } else {
        showToast('Report generated successfully!');
      }

    } catch (err) {
      console.error(err);
      setErrorMsg(err.message);
      setStatus('error');
      addLog(`Error: ${err.message}`);
      showToast('Error generating report.');
    }
  };

  const downloadPDF = async () => {
    setIsDownloading(true);
    const element = document.getElementById('pdf-export-template');
    if (!element) {
      setIsDownloading(false);
      return;
    }
    
    const opt = {
      margin:       0.3,
      filename:     `${result?.companyName?.replace(/\s+/g, '_') || 'company'}_report.pdf`,
      image:        { type: 'jpeg', quality: 1 },
      html2canvas:  { scale: 2, useCORS: true, windowWidth: 850, backgroundColor: '#ffffff' },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    try {
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf().set(opt).from(element).save();
      showToast('PDF Downloaded');
    } catch (e) {
      console.error(e);
      showToast('PDF generation failed.');
    }
    setIsDownloading(false);
  };

  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopied(true);
    showToast('JSON copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const sendToDiscord = async (dataToUse) => {
    const data = dataToUse || result;
    if (!data) return;

    if (!settings.discordToken || !settings.discordChannel) {
      showToast('Please add Discord Token & Channel ID in Settings!');
      return;
    }

    setIsSendingDiscord(true);
    addLog('Preparing to send report to Discord...');
    try {
      const element = document.getElementById('pdf-export-template');
      if (!element) {
        throw new Error('Report layout not ready yet');
      }

      const opt = {
        margin:       0.3,
        filename:     `report.pdf`,
        image:        { type: 'jpeg', quality: 1 },
        html2canvas:  { scale: 2, useCORS: true, windowWidth: 850, backgroundColor: '#ffffff' },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
      };

      const html2pdf = (await import('html2pdf.js')).default;
      const pdfWorker = html2pdf().set(opt).from(element);
      const pdfArrayBuffer = await pdfWorker.outputPdf('arraybuffer');
      const pdfBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });

      const jsonPayload = JSON.stringify({
        companyName: (data.companyName || '').replace(/[^\x00-\x7F]/g, ''),
        website: data.website || '',
        applicantName: (settings.applicantName || '').replace(/[^\x00-\x7F]/g, ''),
        applicantEmail: settings.applicantEmail || '',
        channelId: settings.discordChannel || '',
        token: settings.discordToken || ''
      });
      const dataBlob = new Blob([jsonPayload], { type: 'application/json' });

      const formData = new FormData();
      formData.append('file', pdfBlob, 'report.pdf');
      formData.append('data', dataBlob);

      const response = await fetch('/api/discord', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        addLog('Successfully sent report to Discord channel!');
        showToast('Discord upload successful!');
      } else {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Discord API rejected request');
      }
    } catch (e) {
      console.error(e);
      addLog('Error sending to Discord: ' + e.message);
      showToast('Discord upload failed.');
    }
    setIsSendingDiscord(false);
  };

  return (
    <div className={styles.container}>
      {toast && <div className={styles.toast}>{toast}</div>}

      <header className={styles.header}>
        <div className={styles.logo}>
          <Search className={styles.logoIcon} />
          <h1 className="gradient-text">ReluAI Researcher</h1>
        </div>
        <button className={styles.iconBtn} onClick={() => setIsSettingsOpen(true)}>
          <Settings size={20} />
        </button>
      </header>

      <main className={styles.mainContent}>
        {status === 'idle' && (
          <div className={styles.hero}>
            <h2>AI-Powered Company Research Assistant</h2>
            <p>Enter a company name or website URL to generate a comprehensive analysis report.</p>
          </div>
        )}

        <form onSubmit={handleSearch} className={styles.searchForm}>
          <div className={styles.inputWrapper}>
            <input 
              type="text" 
              className={styles.input} 
              placeholder="e.g. Stripe, Tesla, or https://reluconsultancy.in" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={status !== 'idle' && status !== 'complete' && status !== 'error'}
              autoFocus
            />
            <button 
              type="submit" 
              className={styles.submitBtn}
              disabled={status !== 'idle' && status !== 'complete' && status !== 'error'}
            >
              <Send size={18} />
            </button>
          </div>
        </form>

        {(status !== 'idle') && (
          <div className={`${styles.chatContainer} glass-panel`}>
            <div className={styles.logs}>
              {progressLog.map((log, i) => (
                <div key={i} className={styles.logItem}>
                  <span className={styles.logTime}>[{log.time}]</span>
                  <span className={styles.logMsg}>{log.msg}</span>
                </div>
              ))}
              {status !== 'complete' && status !== 'error' && (
                <div className={styles.loadingDots}>
                  <span>.</span><span>.</span><span>.</span>
                </div>
              )}
            </div>

            {status === 'complete' && result && (
              <div className={styles.resultActions}>
                <button onClick={copyJson} className={styles.secondaryBtn}>
                  {copied ? <CheckCircle2 size={16}/> : <Copy size={16} />} JSON
                </button>
                <button onClick={() => sendToDiscord(result)} className={styles.secondaryBtn} disabled={isSendingDiscord}>
                  <Send size={16} /> {isSendingDiscord ? 'Sending...' : 'Send to Discord'}
                </button>
                <button onClick={downloadPDF} className={styles.primaryBtn} disabled={isDownloading}>
                  {isDownloading ? <span className={styles.spinIcon}><Search size={16}/></span> : <Download size={16} />} 
                  {isDownloading ? 'Generating...' : 'Download PDF Report'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Skeleton Loaders */}
        {(status === 'crawling' || status === 'analyzing') && (
          <div className={`${styles.reportContainer} glass-panel ${styles.skeletonPulse}`}>
            <div className={styles.skeletonHeader}></div>
            <div className={styles.skeletonText}></div>
            <div className={styles.skeletonText}></div>
            <div className={styles.skeletonGrid}>
              <div className={styles.skeletonBox}></div>
              <div className={styles.skeletonBox}></div>
            </div>
          </div>
        )}

        {/* UI Report Display */}
        {status === 'complete' && result && (
          <div id="report-content" className={`${styles.reportContainer} glass-panel`}>
            
            <div className={styles.metadataBar}>
              <div className={styles.confidenceScore}>
                <ShieldCheck size={16} className={result.confidenceScore > 80 ? styles.colorSuccess : styles.colorWarning} />
                <span>AI Confidence: <strong>{result.confidenceScore}%</strong></span>
              </div>
            </div>

            <div className={styles.reportHeader}>
              <h2 className="gradient-text">{result.companyName || 'Unknown Company'}</h2>
              <div className={styles.badges}>
                {result.website && <a href={result.website.startsWith('http') ? result.website : 'https://'+result.website} target="_blank" rel="noreferrer" className={styles.badge}><Globe size={14}/> {result.website}</a>}
                {result.phone && <span className={styles.badge}><Phone size={14}/> {result.phone}</span>}
                {result.address && <span className={styles.badge}><MapPin size={14}/> {result.address}</span>}
              </div>
            </div>

            <div className={styles.reportSection}>
              <h3><Building2 size={18}/> Company Summary</h3>
              <p>{result.summary}</p>
            </div>

            <div className={styles.grid2}>
              <div className={styles.reportSection}>
                <h3><Target size={18}/> Products & Services</h3>
                {result.products?.length > 0 ? (
                  <ul className={styles.list}>
                    {result.products.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                ) : <p className={styles.dim}>No products found.</p>}
              </div>

              <div className={styles.reportSection}>
                <h3><Crosshair size={18}/> Pain Points</h3>
                {result.painPoints?.length > 0 ? (
                  <ul className={styles.list}>
                    {result.painPoints.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                ) : <p className={styles.dim}>No pain points found.</p>}
              </div>
            </div>

            <div className={styles.reportSection}>
              <h3><Search size={18}/> Competitor Analysis</h3>
              {result.competitors?.length > 0 ? (
                <div className={styles.competitorGrid}>
                  {result.competitors.map((comp, i) => (
                    <div key={i} className={styles.competitorCard}>
                      <h4>{comp.name}</h4>
                      {comp.website && <a href={comp.website.startsWith('http') ? comp.website : 'https://'+comp.website} target="_blank" rel="noreferrer">{comp.website}</a>}
                      {comp.reason && <p className={styles.compReason}>{comp.reason}</p>}
                    </div>
                  ))}
                </div>
              ) : <p className={styles.dim}>No competitors found.</p>}
            </div>
            
            {result.sourcesUsed?.length > 0 && (
              <div className={styles.reportSection} style={{marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem'}}>
                <h3><LinkIcon size={16}/> Sources Analyzed</h3>
                <div className={styles.sourcesList}>
                  {result.sourcesUsed.map((source, i) => (
                    <span key={i} className={styles.sourceTag}>{source}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Hidden Dedicated PDF Export Template */}
        {status === 'complete' && result && (
          <div id="pdf-export-template" className={styles.pdfTemplate}>
            <div className={styles.pdfCover}>
              <div className={styles.pdfCoverHeader}>
                <h1>Company Intelligence Report</h1>
                <p>Generated by ReluAI Researcher</p>
                <div className={styles.pdfDate}>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
              </div>
              
              <div className={styles.pdfCompanyTitle}>
                <h2>{result.companyName || 'Unknown Company'}</h2>
                <div className={styles.pdfContactInfo}>
                  {result.website && <span>🌐 {result.website}</span>}
                  {result.phone && <span>📞 {result.phone}</span>}
                  {result.address && <span>📍 {result.address}</span>}
                </div>
              </div>

              {settings.applicantName && (
                <div className={styles.pdfApplicant}>
                  <p><strong>Prepared by:</strong> {settings.applicantName}</p>
                  {settings.applicantEmail && <p>{settings.applicantEmail}</p>}
                </div>
              )}
            </div>

            <div className={styles.pdfPageBreak}></div>

            <div className={styles.pdfPage}>
              <div className={styles.pdfSection}>
                <h3>Executive Summary</h3>
                <p className={styles.pdfSummary}>{result.summary}</p>
              </div>

              <div className={styles.pdfSection}>
                <h3>Products & Services</h3>
                <ul className={styles.pdfList}>
                  {result.products?.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>

              <div className={styles.pdfSection}>
                <h3>Industry Pain Points</h3>
                <ul className={styles.pdfList}>
                  {result.painPoints?.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
            </div>

            <div className={styles.pdfPageBreak}></div>

            <div className={styles.pdfPage}>
              <div className={styles.pdfSection}>
                <h3>Competitor Analysis</h3>
                <p style={{marginBottom: '10px', fontStyle: 'italic', color: '#555'}}>AI-driven competitive landscape analysis.</p>
                <table className={styles.pdfTable}>
                  <thead>
                    <tr>
                      <th style={{width: '25%'}}>Competitor</th>
                      <th style={{width: '25%'}}>Website</th>
                      <th style={{width: '50%'}}>Competitive Positioning (AI Reasoning)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.competitors?.map((comp, i) => (
                      <tr key={i}>
                        <td><strong>{comp.name}</strong></td>
                        <td>{comp.website}</td>
                        <td>{comp.reason || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={styles.pdfSection}>
                <h3>Verification & Sources</h3>
                <p style={{marginBottom: '10px'}}>Confidence Score: <strong>{result.confidenceScore}%</strong></p>
                <div className={styles.pdfSources}>
                  {result.sourcesUsed?.map((source, i) => (
                    <div key={i}>• {source}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
