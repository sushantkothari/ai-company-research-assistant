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
    
    setStatus('searching');
    setProgressLog([]);
    setResult(null);
    setErrorMsg('');

    addLog(`Initiating deep research for: ${input}`);
    
    try {
      addLog('Resolving target and querying Google Search...');
      setStatus('crawling');
      
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
        sendToDiscord(data);
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
    const element = document.getElementById('report-content');
    if (!element) {
      setIsDownloading(false);
      return;
    }
    
    const opt = {
      margin:       10,
      filename:     `${result?.companyName?.replace(/\s+/g, '_') || 'company'}_report.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#0d1117' },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf().set(opt).from(element).save();
      showToast('PDF Downloaded');
    } catch (e) {
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

  const sendToDiscord = async (data) => {
    addLog('Preparing to send report to Discord...');
    try {
      const element = document.getElementById('report-content');
      const opt = {
        margin:       10,
        filename:     `report.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#0d1117' },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      const html2pdf = (await import('html2pdf.js')).default;
      const pdfBlob = await html2pdf().set(opt).from(element).output('blob');

      const formData = new FormData();
      formData.append('file', pdfBlob, 'report.pdf');
      formData.append('data', JSON.stringify({
        companyName: data.companyName,
        website: data.website,
        applicantName: settings.applicantName,
        applicantEmail: settings.applicantEmail,
        channelId: settings.discordChannel,
        token: settings.discordToken
      }));

      const response = await fetch('/api/discord', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        addLog('Successfully sent report to Discord channel.');
        showToast('Discord upload successful!');
      } else {
        throw new Error('Discord API rejected request');
      }
    } catch (e) {
      addLog('Error sending to Discord: ' + e.message);
      showToast('Discord integration failed.');
    }
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

        {/* Actual Report */}
        {status === 'complete' && result && (
          <div id="report-content" className={`${styles.reportContainer} glass-panel`}>
            
            {/* Top Bar for Confidence & Sources (Hidden in PDF via CSS if needed, but good for UI) */}
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
              <h3><Search size={18}/> Competitors</h3>
              {result.competitors?.length > 0 ? (
                <div className={styles.competitorGrid}>
                  {result.competitors.map((comp, i) => (
                    <div key={i} className={styles.competitorCard}>
                      <h4>{comp.name}</h4>
                      {comp.website && <a href={comp.website.startsWith('http') ? comp.website : 'https://'+comp.website} target="_blank" rel="noreferrer">{comp.website}</a>}
                    </div>
                  ))}
                </div>
              ) : <p className={styles.dim}>No competitors found.</p>}
            </div>

            {/* Sources Section */}
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
      </main>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
