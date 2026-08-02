import React from 'react';
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
