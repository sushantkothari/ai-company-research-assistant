'use client';

import React, { useState } from 'react';
import styles from './MainUI.module.css';
import { useSettings } from '@/context/SettingsContext';

const MODELS = [
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude Sonnet 3.5' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (Paid)' },
  { id: 'openai/gpt-4o', name: 'GPT-4o (Paid)' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (Free)' },
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free)' },
  { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (Free)' }
];

const SAMPLE_BADGES = [
  { label: 'notion.so', value: 'notion.so' },
  { label: 'Figma', value: 'Figma' },
  { label: 'Linear', value: 'Linear' },
  { label: 'Vercel', value: 'Vercel' }
];

export default function MainUI() {
  const { settings, updateSetting } = useSettings();
  const [activeTab, setActiveTab] = useState('API');
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('idle'); // idle, loading, complete, error
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSendingDiscord, setIsSendingDiscord] = useState(false);
  const [discordSuccess, setDiscordSuccess] = useState(false);
  const [savedConfigToast, setSavedConfigToast] = useState(false);

  const handleNewResearch = () => {
    setStatus('idle');
    setResult(null);
    setInput('');
    setErrorMsg('');
    setDiscordSuccess(false);
  };

  const handleSaveConfig = () => {
    setSavedConfigToast(true);
    setTimeout(() => setSavedConfigToast(false), 2500);
  };

  const executeResearch = async (queryToSearch) => {
    const q = queryToSearch || input;
    if (!q.trim()) return;
    
    setStatus('loading');
    setResult(null);
    setErrorMsg('');
    setDiscordSuccess(false);

    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: q,
          model: settings.model,
          openRouterKey: settings.openRouterKey,
          serperKey: settings.serperKey
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to complete research');
      }

      const data = await response.json();
      setResult(data);
      setStatus('complete');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message);
      setStatus('error');
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    executeResearch();
  };

  const handleBadgeClick = (badgeValue) => {
    setInput(badgeValue);
    executeResearch(badgeValue);
  };

  const downloadPDF = async () => {
    setIsDownloading(true);
    const element = document.getElementById('pdf-export-template');
    if (!element) {
      setIsDownloading(false);
      return;
    }
    
    const opt = {
      margin:       0,
      filename:     `${result?.companyName?.replace(/\s+/g, '_') || 'company'}_report.pdf`,
      image:        { type: 'jpeg', quality: 1 },
      html2canvas:  { scale: 2, useCORS: true, windowWidth: 850, backgroundColor: '#ffffff' },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    try {
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf().set(opt).from(element).save();
    } catch (e) {
      console.error(e);
      alert('PDF generation failed.');
    }
    setIsDownloading(false);
  };

  const sendToDiscord = async () => {
    if (!result) return;
    if (!settings.discordToken || !settings.discordChannel) {
      alert('Please add Discord Token & Channel ID in Settings!');
      return;
    }

    setIsSendingDiscord(true);
    try {
      const element = document.getElementById('pdf-export-template');
      if (!element) throw new Error('Report layout not ready');

      const opt = {
        margin:       0,
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
        companyName: (result.companyName || '').replace(/[^\x00-\x7F]/g, ''),
        website: result.website || '',
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
        setDiscordSuccess(true);
      } else {
        throw new Error('Discord API rejected request');
      }
    } catch (e) {
      console.error(e);
      alert('Discord upload failed: ' + e.message);
    }
    setIsSendingDiscord(false);
  };

  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logoRow}>
            <div className={styles.logoIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className={styles.logoText}>
              <div className={styles.reluBrand}>Relu Consultancy</div>
              <div className={styles.appTitle}>COMPANY INTELLIGENCE</div>
            </div>
          </div>
          <button className={styles.newResearchBtn} onClick={handleNewResearch}>
            <span className={styles.plusSign}>+</span> New Research
          </button>
        </div>

        <div className={styles.tabsContainer}>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'API' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('API')}
          >
            API
          </button>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'DISCORD' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('DISCORD')}
          >
            DISCORD
          </button>
        </div>

        <div className={styles.sidebarContent}>
          {activeTab === 'API' && (
            <div className={styles.settingsGroup}>
              <label className={styles.label}>
                OPENROUTER API KEY
                <input 
                  type="password" 
                  className={styles.inputMono} 
                  value={settings.openRouterKey}
                  onChange={(e) => updateSetting('openRouterKey', e.target.value)}
                  placeholder="sk-or-v1-..."
                />
              </label>
              
              <label className={styles.label}>
                SERPER.DEV API KEY
                <input 
                  type="password" 
                  className={styles.inputMono} 
                  value={settings.serperKey}
                  onChange={(e) => updateSetting('serperKey', e.target.value)}
                  placeholder="Your Serper key..."
                />
              </label>
              
              <label className={styles.label}>
                AI MODEL
                <div className={styles.selectWrapper}>
                <select 
                  className={styles.selectMono}
                  value={settings.model}
                  onChange={(e) => updateSetting('model', e.target.value)}
                >
                  {MODELS.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <svg className={styles.selectChevron} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
              </label>

              <button className={styles.saveConfigBtn} onClick={handleSaveConfig}>
                {savedConfigToast ? 'Saved ✓' : 'Save Configuration'}
              </button>
            </div>
          )}

          {activeTab === 'DISCORD' && (
            <div className={styles.settingsGroup}>
              <div className={styles.discordHeaderBox}>
                <h4>Discord Bot Integration</h4>
                <p>After research completes, the report auto-sends to your configured channel.</p>
              </div>
              
              <label className={styles.label}>
                BOT TOKEN
                <input 
                  type="password" 
                  className={styles.inputMono} 
                  value={settings.discordToken}
                  onChange={(e) => updateSetting('discordToken', e.target.value)}
                  placeholder="Bot token..."
                />
              </label>
              
              <label className={styles.label}>
                CHANNEL ID
                <input 
                  type="text" 
                  className={styles.inputMono} 
                  value={settings.discordChannel}
                  onChange={(e) => updateSetting('discordChannel', e.target.value)}
                  placeholder="000000000000000000"
                />
              </label>

              <div className={styles.applicantDetails}>
                <h4 className={styles.monoHeading}>APPLICANT DETAILS</h4>
                <label className={styles.labelSans}>
                  Full Name
                  <input 
                    type="text" 
                    className={styles.input} 
                    value={settings.applicantName}
                    onChange={(e) => updateSetting('applicantName', e.target.value)}
                    placeholder="Your full name"
                  />
                </label>
                <label className={styles.labelSans}>
                  Email Address
                  <input 
                    type="email" 
                    className={styles.input} 
                    value={settings.applicantEmail}
                    onChange={(e) => updateSetting('applicantEmail', e.target.value)}
                    placeholder="email@example.com"
                  />
                </label>
              </div>

              <button className={styles.saveDiscordBtn} onClick={handleSaveConfig}>
                {savedConfigToast ? 'Saved ✓' : 'Save Discord Config'}
              </button>
            </div>
          )}

          <div className={styles.howItWorks}>
            <h4 className={styles.monoHeading}>HOW IT WORKS</h4>
            <div className={styles.stepList}>
              <div className={styles.stepItem}>
                <span className={styles.stepBadge}>1</span>
                <span>Enter a company name or URL</span>
              </div>
              <div className={styles.stepItem}>
                <span className={styles.stepBadge}>2</span>
                <span>Serper.dev searches and crawls it</span>
              </div>
              <div className={styles.stepItem}>
                <span className={styles.stepBadge}>3</span>
                <span>OpenRouter AI generates insights</span>
              </div>
              <div className={styles.stepItem}>
                <span className={styles.stepBadge}>4</span>
                <span>Download a professional PDF report</span>
              </div>
            </div>
          </div>

          <div className={styles.poweredBy}>
            OPENROUTER &bull; SERPER &bull; JSPDF
          </div>
        </div>
      </aside>

      <main className={styles.mainArea}>
        <header className={styles.topBar}>
          <span className={styles.topBarTitle}>Company Research</span>
          <span className={styles.liveBadge}>
            <span className={styles.greenDot}></span> LIVE
          </span>
        </header>

        <div className={styles.mainContentBody}>
          {status === 'idle' && (
            <div className={styles.heroSection}>
              <div className={styles.heroTag}>AI-POWERED INTELLIGENCE</div>
              <h1 className={styles.heroHeading}>
                Know any company<br />in minutes.
              </h1>
              <p className={styles.heroSubtext}>
                Enter a company name or website URL to get AI-powered insights, competitor analysis, pain points, and a professional PDF report.
              </p>
              <div className={styles.badgeRow}>
                {SAMPLE_BADGES.map((b, i) => (
                  <button key={i} className={styles.sampleBadge} onClick={() => handleBadgeClick(b.value)}>
                    {b.label}
                  </button>
                ))}
              </div>
              <div className={styles.heroDivider}>
                <span className={styles.dividerLine}></span>
                <span className={styles.dividerText}>Configure API keys in the sidebar to get started</span>
                <span className={styles.dividerLine}></span>
              </div>
            </div>
          )}

          {status === 'loading' && (
            <div className={styles.loadingContainer}>
              <div className={styles.spinner}></div>
              <p className={styles.loadingText}>Analyzing company data via AI agents...</p>
            </div>
          )}

          {status === 'error' && (
            <div className={styles.errorContainer}>
              <p className={styles.errorText}>Error: {errorMsg}</p>
            </div>
          )}

          {status === 'complete' && result && (
            <div className={styles.resultCard}>
              <div className={styles.resultHeader}>
                <div>
                  <h2 className={styles.resultTitle}>{result.companyName || 'Unknown'}</h2>
                  <a href={result.website?.startsWith('http') ? result.website : `https://${result.website}`} target="_blank" rel="noreferrer" className={styles.resultUrl}>
                    {result.website || 'No website found'}
                  </a>
                </div>
                <div className={styles.completeBadge}>RESEARCH COMPLETE</div>
              </div>

              <div className={styles.infoColumns}>
                <div className={styles.infoCol}>
                  <div className={styles.infoLabel}>PHONE</div>
                  <div className={styles.infoValue}>{result.phone || 'Not publicly listed'}</div>
                </div>
                <div className={styles.infoCol}>
                  <div className={styles.infoLabel}>ADDRESS</div>
                  <div className={styles.infoValue}>{result.address || 'Information unavailable'}</div>
                </div>
              </div>

              <div className={styles.sectionBlock}>
                <h3 className={styles.sectionTitle}>PRODUCTS & SERVICES</h3>
                <div className={styles.pillsContainer}>
                  {result.products?.map((item, i) => (
                    <span key={i} className={styles.pill}>{item}</span>
                  ))}
                </div>
              </div>

              <div className={styles.sectionBlock}>
                <h3 className={styles.sectionTitle}>AI-GENERATED PAIN POINTS</h3>
                <ul className={styles.bulletList}>
                  {result.painPoints?.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className={styles.sectionBlock}>
                <h3 className={styles.sectionTitle}>COMPETITORS</h3>
                <div className={styles.competitorGrid}>
                  {result.competitors?.map((comp, i) => (
                    <div key={i} className={styles.compItem}>
                      <div className={styles.compName}>{comp.name}</div>
                      <a href={comp.website?.startsWith('http') ? comp.website : `https://${comp.website}`} target="_blank" rel="noreferrer" className={styles.compUrl}>
                        {comp.website || 'No URL'}
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.actionRow}>
                <button className={styles.downloadBtn} onClick={downloadPDF} disabled={isDownloading}>
                  {isDownloading ? 'Generating...' : 'Download PDF Report'}
                </button>
                <button 
                  className={discordSuccess ? styles.discordBtnSuccess : styles.discordBtn} 
                  onClick={sendToDiscord} 
                  disabled={isSendingDiscord || discordSuccess}
                >
                  {isSendingDiscord ? 'Sending...' : discordSuccess ? '✓ Sent to Discord' : 'Send to Discord'}
                </button>
              </div>
            </div>
          )}
        </div>

        <form className={styles.searchBarForm} onSubmit={handleSearchSubmit}>
          <div className={styles.searchInputWrapper}>
            <input 
              type="text"
              className={styles.searchInput}
              placeholder="Enter a company name (e.g. Aurora Labs) or website URL (e.g. https://aurora.dev)..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={status === 'loading'}
            />
            <button type="submit" className={styles.searchSubmitBtn} disabled={status === 'loading'}>
              Research &rarr;
            </button>
          </div>
          <div className={styles.searchHint}>ENTER TO RESEARCH &bull; SHIFT+ENTER FOR NEW LINE</div>
        </form>

        {/* PDF Template matching Image 3 precisely */}
        {status === 'complete' && result && (
          <div id="pdf-export-template" className={styles.pdfTemplate}>
            <div className={styles.pdfHeader}>
              <div className={styles.pdfSubTitle}>RELU CONSULTANCY - COMPANY RESEARCH REPORT</div>
              <h1 className={styles.pdfMainTitle}>{result.companyName}</h1>
            </div>
            
            <div className={styles.pdfBody}>
              <h2 className={styles.pdfSectionTitle}>COMPANY INFORMATION</h2>
              <table className={styles.pdfTable}>
                <tbody>
                  <tr>
                    <td className={styles.pdfTableLabel}>Website</td>
                    <td className={styles.pdfTableValue}>{result.website}</td>
                  </tr>
                  <tr>
                    <td className={styles.pdfTableLabel}>Phone</td>
                    <td className={styles.pdfTableValue}>{result.phone || 'Not publicly listed'}</td>
                  </tr>
                  <tr>
                    <td className={styles.pdfTableLabel}>Address</td>
                    <td className={styles.pdfTableValue}>{result.address || 'Information unavailable'}</td>
                  </tr>
                </tbody>
              </table>

              <h2 className={styles.pdfSectionTitle}>EXECUTIVE SUMMARY</h2>
              <p className={styles.pdfSummary}>{result.summary}</p>

              <h2 className={styles.pdfSectionTitle}>PRODUCTS & SERVICES</h2>
              <ul className={styles.pdfBullets}>
                {result.products?.map((item, i) => <li key={i}>{item}</li>)}
              </ul>

              <h2 className={styles.pdfSectionTitle}>AI-GENERATED PAIN POINTS</h2>
              <ul className={styles.pdfBullets}>
                {result.painPoints?.map((item, i) => <li key={i}>{item}</li>)}
              </ul>

              <h2 className={styles.pdfSectionTitle}>COMPETITORS</h2>
              <div className={styles.pdfCompetitorsGrid}>
                {result.competitors?.map((comp, i) => (
                  <div key={i} className={styles.pdfCompRow}>
                    <div className={styles.pdfCompHeader}>
                      <div className={styles.pdfCompName}>{comp.name}</div>
                      <div className={styles.pdfCompUrl}>{comp.website}</div>
                    </div>
                    <div className={styles.pdfCompReason}>{comp.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
