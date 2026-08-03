'use client';

import React, { useState, useEffect, useRef } from 'react';
import styles from './MainUI.module.css';
import { useSettings } from '@/context/SettingsContext';

const CURATED_MODELS = [
  { id: 'poolside/laguna-s-2.1:free', name: '🟢 Poolside Laguna S 2.1 — Free' },
  { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', name: '🟢 Nemotron-3 Ultra 550B — Free' },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: '🟢 Nemotron-3 Super 120B — Free' },
  { id: 'google/gemma-4-26b-a4b-it:free', name: '🟢 Gemma 4 26B — Free' },
  { id: 'openai/gpt-oss-20b:free', name: '🟢 GPT-OSS 20B — Free' },
  { id: 'openai/gpt-4o', name: '🔵 GPT-4o — Paid' },
  { id: 'openai/gpt-4o-mini', name: '🔵 GPT-4o Mini — Paid' },
  { id: 'openai/o1-mini', name: '🔵 o1-mini — Paid' },
  { id: 'anthropic/claude-3.5-sonnet', name: '🔵 Claude 3.5 Sonnet — Paid' },
  { id: 'anthropic/claude-3.5-haiku', name: '🔵 Claude 3.5 Haiku — Paid' },
  { id: 'anthropic/claude-3-opus', name: '🔵 Claude 3 Opus — Paid' },
  { id: 'google/gemini-pro-1.5', name: '🔵 Gemini 1.5 Pro — Paid' },
  { id: 'google/gemini-1.5-flash', name: '🔵 Gemini 1.5 Flash — Paid' },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: '🔵 Llama 3.3 70B — Paid' },
  { id: 'meta-llama/llama-3.1-405b-instruct', name: '🔵 Llama 3.1 405B — Paid' },
  { id: 'deepseek/deepseek-chat', name: '🔵 DeepSeek V3 — Paid' },
  { id: 'qwen/qwen-max', name: '🔵 Qwen Max — Paid' }
];

const SAMPLE_BADGES = [
  { label: 'Microsoft', value: 'Microsoft' },
  { label: 'Stripe', value: 'Stripe' },
  { label: 'Tesla', value: 'Tesla' },
  { label: 'Aurora', value: 'https://aurora.dev' }
];

export default function MainUI() {
  const { settings, updateSetting } = useSettings();
  const [activeTab, setActiveTab] = useState('API');
  const [input, setInput] = useState('');
  
  // ChatGPT-style message history
  const [messages, setMessages] = useState([]);
  
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSendingDiscord, setIsSendingDiscord] = useState(false);
  const [savedConfigToast, setSavedConfigToast] = useState(false);
  
  const [models, setModels] = useState(CURATED_MODELS);
  const messagesEndRef = useRef(null);



  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleNewResearch = () => {
    setMessages([]);
    setInput('');
  };

  const handleSaveConfig = () => {
    setSavedConfigToast(true);
    setTimeout(() => setSavedConfigToast(false), 2500);
  };

  const sendToDiscord = async (data) => {
    if (!settings.discordToken || !settings.discordChannel) return;
    setIsSendingDiscord(true);
    try {
      const pdfRes = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!pdfRes.ok) throw new Error('Failed to generate PDF for Discord');
      const pdfBlob = await pdfRes.blob();

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

      const discordRes = await fetch('/api/discord', { method: 'POST', body: formData });
      if (discordRes.ok) {
        setMessages(prev => prev.map(msg => 
          msg.role === 'assistant' && msg.data === data 
            ? { ...msg, discordSuccess: true } 
            : msg
        ));
      } else {
        const errText = await discordRes.text();
        alert('Discord upload failed: ' + errText);
        console.warn('Discord upload failed:', errText);
      }
    } catch (e) {
      alert('Discord error: ' + e.message);
      console.error('Discord error:', e);
    }
    setIsSendingDiscord(false);
  };

  const executeResearch = async (queryToSearch) => {
    const q = queryToSearch || input;
    if (!q.trim()) return;
    
    setInput('');
    
    const userMsg = { role: 'user', content: q };
    const loadingMsgId = Date.now();
    const loadingMsg = { role: 'assistant', id: loadingMsgId, status: 'loading', loadingStep: 0 };
    
    setMessages(prev => [...prev, userMsg, loadingMsg]);

    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step <= 4) {
        setMessages(prev => prev.map(m => m.id === loadingMsgId ? { ...m, loadingStep: step } : m));
      }
    }, 2000);

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

      clearInterval(interval);

      if (!response.ok) {
        const errText = await response.text();
        let errMsg = 'Failed to complete research';
        try {
          const errData = JSON.parse(errText);
          errMsg = errData.error || errMsg;
        } catch (e) {
          console.error('Non-JSON error response:', errText);
          errMsg = `Server error (${response.status})`;
        }
        throw new Error(errMsg);
      }

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Non-JSON success response:', responseText);
        throw new Error('Received invalid data from server');
      }
      
      console.log("=== [STAGE 2: /api/research RETURNED JSON BEFORE REACT TOUCHES IT] ===", data);
      
      setMessages(prev => {
        const nextState = prev.map(m => 
          m.id === loadingMsgId 
            ? { ...m, status: 'complete', data } 
            : m
        );
        console.log("=== [STAGE 3: OBJECT STORED INSIDE REACT STATE] ===", nextState);
        return nextState;
      });
      
    } catch (err) {
      clearInterval(interval);
      console.error(err);
      setMessages(prev => prev.map(m => 
        m.id === loadingMsgId 
          ? { ...m, status: 'error', errorMsg: err.message } 
          : m
      ));
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    console.log("=== [STAGE 1: USER CLICKS RESEARCH] ===", {
      query: input,
      model: settings.model,
      openRouterKey: settings.openRouterKey ? '***' : 'missing',
      serperKey: settings.serperKey ? '***' : 'missing'
    });
    executeResearch();
  };

  const handleBadgeClick = (badgeValue) => {
    console.log("=== [STAGE 1: USER CLICKS BADGE RESEARCH] ===", badgeValue);
    executeResearch(badgeValue);
  };

  const downloadPDF = async (data) => {
    console.log("=== [STAGE 5: PASSED INTO downloadPDF()] ===", data);
    setIsDownloading(true);
    try {
      console.log("=== [STAGE 6: POST /api/pdf REQUEST BODY] ===", JSON.stringify(data));
      const res = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const companyName = data.companyName || data['Company Name'] || data.company || data.name || 'Company';
      const safeName = companyName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
      a.download = `${safeName}_Report.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('PDF generation failed.');
    }
    setIsDownloading(false);
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
              <div className={styles.reluBrand}>AI Research Assistant</div>
              <div className={styles.appTitle}>COMPANY INTELLIGENCE</div>
            </div>
          </div>
          <button className={styles.newResearchBtn} onClick={handleNewResearch}>
            <span className={styles.plusSign}>+</span> New Chat
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
                  {models.map(m => (
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
                <p>Click "Send to Discord" on any generated report to forward it to your channel.</p>
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
                <span>Download a native vector PDF</span>
              </div>
            </div>
          </div>

          <div className={styles.poweredBy}>
            OPENROUTER &bull; SERPER &bull; PUPPETEER
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

        <div className={styles.chatFeedWrapper}>
          <div className={styles.chatFeed}>
            {messages.length === 0 && (
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
              </div>
            )}

            {messages.map((msg, index) => {
              if (msg.role === 'user') {
                return (
                  <div key={index} className={styles.userMessageRow}>
                    <div className={styles.userMessageBubble}>
                      {msg.content}
                    </div>
                  </div>
                );
              }
              
              if (msg.role === 'assistant') {
                return (
                  <div key={index} className={styles.assistantMessageRow}>
                    <div className={styles.assistantAvatar}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M2 17L12 22L22 17" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M2 12L12 17L22 12" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    
                    <div className={styles.assistantContent}>
                      {msg.status === 'loading' && (
                        <div className={styles.loadingBox}>
                          <div className={styles.loadingTitle}>RESEARCH IN PROGRESS</div>
                          <div className={styles.loadingStepItem}>
                            {msg.loadingStep > 0 ? <span className={styles.stepIconDone}>✓</span> : <span className={styles.stepIconSpinner}></span>}
                            <span className={msg.loadingStep >= 0 ? styles.stepTextActive : styles.stepTextPending}>Searching Serper.dev for official website</span>
                          </div>
                          <div className={styles.loadingStepItem}>
                            {msg.loadingStep > 1 ? <span className={styles.stepIconDone}>✓</span> : msg.loadingStep === 1 ? <span className={styles.stepIconSpinner}></span> : <span className={styles.stepIconPending}>2</span>}
                            <span className={msg.loadingStep >= 1 ? styles.stepTextActive : styles.stepTextPending}>Crawling key pages — home, about, products, pricing</span>
                          </div>
                          <div className={styles.loadingStepItem}>
                            {msg.loadingStep > 2 ? <span className={styles.stepIconDone}>✓</span> : msg.loadingStep === 2 ? <span className={styles.stepIconSpinner}></span> : <span className={styles.stepIconPending}>3</span>}
                            <span className={msg.loadingStep >= 2 ? styles.stepTextActive : styles.stepTextPending}>Cross-referencing public sources</span>
                          </div>
                          <div className={styles.loadingStepItem}>
                            {msg.loadingStep > 3 ? <span className={styles.stepIconDone}>✓</span> : msg.loadingStep === 3 ? <span className={styles.stepIconSpinner}></span> : <span className={styles.stepIconPending}>4</span>}
                            <span className={msg.loadingStep >= 3 ? styles.stepTextActive : styles.stepTextPending}>Sending extracted content to OpenRouter</span>
                          </div>
                          <div className={styles.loadingStepItem}>
                            {msg.loadingStep > 4 ? <span className={styles.stepIconDone}>✓</span> : msg.loadingStep === 4 ? <span className={styles.stepIconSpinner}></span> : <span className={styles.stepIconPending}>5</span>}
                            <span className={msg.loadingStep >= 4 ? styles.stepTextActive : styles.stepTextPending}>Generating AI insights & identifying competitors</span>
                          </div>
                        </div>
                      )}

                      {msg.status === 'error' && (
                        <div className={styles.errorContainer}>
                          <p className={styles.errorText}>Error: {msg.errorMsg}</p>
                        </div>
                      )}

                      {msg.status === 'complete' && msg.data && (
                        <div className={styles.resultCard}>
                          <div className={styles.resultHeader}>
                            <div>
                              <h2 className={styles.resultTitle}>{msg.data.companyName || 'Unknown'}</h2>
                              <a href={msg.data.website?.startsWith('http') ? msg.data.website : `https://${msg.data.website}`} target="_blank" rel="noreferrer" className={styles.resultUrl}>
                                {msg.data.website || 'No website found'}
                              </a>
                            </div>
                            <div className={styles.completeBadge}>RESEARCH COMPLETE</div>
                          </div>

                          {msg.data.metadata && (
                            <div className={styles.metadataBar}>
                              <div className={styles.metaItem}><strong>CONFIDENCE:</strong> {msg.data.confidenceScore || 90}%</div>
                              <div className={styles.metaItem}><strong>PAGES CRAWLED:</strong> {msg.data.metadata.pagesCrawled || 0}</div>
                              <div className={styles.metaItem}><strong>TIME:</strong> {((msg.data.metadata.researchDuration || 0) / 1000).toFixed(1)}s</div>
                              <div className={styles.metaItem}><strong>MODEL:</strong> {msg.data.metadata.modelUsed || 'Unknown'}</div>
                            </div>
                          )}

                          <table className={styles.uiInfoTable}>
                            <tbody>
                              <tr>
                                <td className={styles.uiInfoLabel}>PHONE</td>
                                <td className={styles.uiInfoValue}>{msg.data.phone || 'Not publicly listed'}</td>
                              </tr>
                              <tr>
                                <td className={styles.uiInfoLabel}>ADDRESS</td>
                                <td className={styles.uiInfoValue}>{msg.data.address || 'Information unavailable'}</td>
                              </tr>
                            </tbody>
                          </table>

                          <div className={styles.sectionBlock}>
                            <h3 className={styles.sectionTitle}>COMPANY SUMMARY</h3>
                            <p className={styles.paragraphText}>{msg.data.summary || 'Information unavailable'}</p>
                          </div>
                          
                          <div className={styles.sectionBlock}>
                            <h3 className={styles.sectionTitle}>TARGET AUDIENCE / MARKET</h3>
                            <p className={styles.paragraphText}>{msg.data.targetAudience || 'Information unavailable'}</p>
                          </div>

                          <div className={styles.sectionBlock}>
                            <h3 className={styles.sectionTitle}>BUSINESS MODEL</h3>
                            <p className={styles.paragraphText}>{msg.data.businessModel || 'Information unavailable'}</p>
                          </div>

                          <div className={styles.sectionBlock}>
                            <h3 className={styles.sectionTitle}>KEY OBSERVATIONS</h3>
                            <div className={styles.richList}>
                              {msg.data.keyObservations?.map((item, i) => (
                                <div key={i} className={styles.richItem}>
                                  <span className={styles.richItemDesc}>{item}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className={styles.sectionBlock}>
                            <h3 className={styles.sectionTitle}>PRODUCTS & SERVICES</h3>
                            <div className={styles.richList}>
                              {msg.data.products?.map((item, i) => (
                                <div key={i} className={styles.richItem}>
                                  <span className={styles.richItemTitle}>{typeof item === 'string' ? item : item.name}</span>
                                  {typeof item === 'object' && item.description && (
                                    <p className={styles.richItemDesc}>{item.description}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className={styles.sectionBlock}>
                            <h3 className={styles.sectionTitle}>AI-GENERATED PAIN POINTS</h3>
                            <div className={styles.richList}>
                              {msg.data.painPoints?.map((item, i) => (
                                <div key={i} className={styles.richItem}>
                                  <span className={styles.richItemTitle}>{typeof item === 'string' ? item : item.topic}</span>
                                  {typeof item === 'object' && item.explanation && (
                                    <p className={styles.richItemDesc}>{item.explanation}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className={styles.sectionBlock}>
                            <h3 className={styles.sectionTitle}>STRATEGIC INSIGHTS</h3>
                            <div className={styles.richList}>
                              {msg.data.strategicInsights?.map((item, i) => (
                                <div key={i} className={styles.richItem}>
                                  <span className={styles.richItemDesc}>{item}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className={styles.sectionBlock}>
                            <h3 className={styles.sectionTitle}>COMPETITORS</h3>
                            <div className={styles.competitorGrid}>
                              {msg.data.competitors?.map((comp, i) => (
                                <div key={i} className={styles.compCard}>
                                  <div className={styles.compHeader}>
                                    <div className={styles.compName}>{comp.name}</div>
                                    <a href={comp.website?.startsWith('http') ? comp.website : `https://${comp.website}`} target="_blank" rel="noreferrer" className={styles.compUrl}>
                                      {comp.website || 'No URL'}
                                    </a>
                                  </div>
                                  {comp.reason && <div className={styles.compReason}>{comp.reason}</div>}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className={styles.actionRow}>
                            <button className={styles.downloadBtn} onClick={() => downloadPDF(msg.data)} disabled={isDownloading}>
                              {isDownloading ? 'Generating...' : 'Download PDF Report'}
                            </button>
                            <button 
                              className={msg.discordSuccess ? styles.discordBtnSuccess : styles.discordBtn} 
                              onClick={() => sendToDiscord(msg.data)} 
                              disabled={isSendingDiscord || msg.discordSuccess}
                            >
                              {isSendingDiscord ? 'Sending...' : msg.discordSuccess ? '✓ Sent to Discord' : 'Send to Discord'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              return null;
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <form className={styles.searchBarForm} onSubmit={handleSearchSubmit}>
          <div className={styles.searchInputWrapper}>
            <input 
              type="text"
              className={styles.searchInput}
              placeholder="Enter a company name (e.g. Aurora Labs) or website URL (e.g. https://aurora.dev)..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button type="submit" className={styles.searchSubmitBtn}>
              Research &rarr;
            </button>
          </div>
          <div className={styles.searchHint}>ENTER TO RESEARCH &bull; AI-POWERED ANALYSIS</div>
        </form>
      </main>
    </div>
  );
}
