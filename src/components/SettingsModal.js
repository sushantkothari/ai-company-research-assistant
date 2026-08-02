'use client';

import React from 'react';
import styles from './SettingsModal.module.css';
import { X, Save } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';

const MODELS = [
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (FREE)' },
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (FREE)' },
  { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (FREE)' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (Paid)' },
  { id: 'openai/gpt-4o', name: 'GPT-4o (Paid)' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (Paid)' }
];

export default function SettingsModal({ isOpen, onClose }) {
  const { settings, updateSetting } = useSettings();

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={`${styles.modal} glass-panel`}>
        <div className={styles.header}>
          <h2>Configuration</h2>
          <button className={styles.closeBtn} onClick={onClose}><X size={20}/></button>
        </div>

        <div className={styles.content}>
          <div className={styles.section}>
            <h3>AI Model Selection</h3>
            <label className={styles.label}>
              Select OpenRouter Model
              <select 
                className={styles.input}
                value={settings.model}
                onChange={(e) => updateSetting('model', e.target.value)}
              >
                {MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
          </div>

          <div className={styles.section}>
            <h3>Applicant Details</h3>
            <label className={styles.label}>
              Name
              <input 
                type="text" 
                className={styles.input} 
                placeholder="John Doe"
                value={settings.applicantName}
                onChange={(e) => updateSetting('applicantName', e.target.value)}
              />
            </label>
            <label className={styles.label}>
              Email
              <input 
                type="email" 
                className={styles.input} 
                placeholder="john@example.com"
                value={settings.applicantEmail}
                onChange={(e) => updateSetting('applicantEmail', e.target.value)}
              />
            </label>
          </div>

          <div className={styles.section}>
            <h3>Discord Integration (Bonus)</h3>
            <p className={styles.hint}>Configure these to automatically send generated PDF reports.</p>
            <label className={styles.label}>
              Discord Bot Token
              <input 
                type="password" 
                className={styles.input} 
                placeholder="Bot token..."
                value={settings.discordToken}
                onChange={(e) => updateSetting('discordToken', e.target.value)}
              />
            </label>
            <label className={styles.label}>
              Discord Channel ID
              <input 
                type="text" 
                className={styles.input} 
                placeholder="Channel ID..."
                value={settings.discordChannel}
                onChange={(e) => updateSetting('discordChannel', e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.saveBtn} onClick={onClose}>
            <Save size={16}/> Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
