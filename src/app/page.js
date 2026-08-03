import React from 'react';
// Recompile: 2026-08-03
import styles from './page.module.css';
import MainUI from '@/components/MainUI';

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.backgroundGlow}></div>
      <MainUI />
    </main>
  );
}
