'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Sidebar from '../../components/SideBar';
import BottomNav from '../../components/BottomNav';
import XYChart from '../../components/Scatter';
import Pagination from '../../components/Pagination';
import styles from '../../styles/Dashboard.module.css';
import Link from 'next/link';

const SUPERUSER_EMAILS = (process.env.NEXT_PUBLIC_SUPERUSER_EMAILS || process.env.NEXT_PUBLIC_SUPERUSER_EMAIL || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(email => email !== '');

const Dashboard = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [activeIndex, setActiveIndex] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewAll, setViewAll] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const entriesPerPage = 5;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        setLoading(false);
        return;
      }

      const user = session.user;
      setUsername(user.email.split('@')[0]);
      setUserEmail(user.email);

      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_path')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.avatar_path) {
        const { data: signed } = await supabase.storage
          .from('avatars')
          .createSignedUrl(profile.avatar_path, 3600);
        if (signed?.signedUrl) setAvatarUrl(signed.signedUrl);
      }

      let query = supabase
        .from('api_results')
        .select(`
          id,
          drawing_id,
          created_at,
          result_data,
          user_id,
          email,
          drawings (
            id,
            drawing_data
          )
        `)
        .order('created_at', { ascending: false });

      const isSuperuser = SUPERUSER_EMAILS.includes(user.email.toLowerCase());

      if (!isSuperuser || !viewAll) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;

      if (!error && data) {
        const parsed = data.map(entry => {
          let drawingData = [];
          try {
            drawingData = typeof entry.drawings?.drawing_data === 'string'
              ? JSON.parse(entry.drawings.drawing_data)
              : entry.drawings?.drawing_data || [];
          } catch (e) {}
          return {
            ...entry,
            drawings: { ...entry.drawings, drawing_data: drawingData },
          };
        });
        setEntries(parsed);
      }

      setLoading(false);
    };

    fetchData();

    const handleResize = () => {
      setIsMobile(window.innerWidth <= 640);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [viewAll]);

  const handleAccordionClick = (index) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  const paginatedEntries = entries.slice(1).slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);
  const pageCount = Math.max(1, Math.ceil((entries.length - 1) / entriesPerPage));

  const isSuperuser = SUPERUSER_EMAILS.includes(userEmail.toLowerCase());

  return (
    <div className={styles.pageContainer}>
      {isMobile ? <BottomNav /> : <Sidebar />}
      <div className={styles.content}>
        <div className={styles.welcomeContainer}>
          <img
            src={avatarUrl || "/Icons/default-avatar.png"}
            alt="Avatar"
            className={styles.avatarImage}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "/Icons/default-avatar.png";
            }}
          />
          <h1 className={styles.welcome} style={{ color: 'white' }}>
            Welcome back{username ? `, ${username}` : ''}!
          </h1>
        </div>

        {isSuperuser && (
          <div style={{ margin: '1rem 0', color: 'white' }}>
            <label>
              <input
                type="checkbox"
                checked={viewAll}
                onChange={(e) => setViewAll(e.target.checked)}
              />{' '}
              View all user entries
            </label>
          </div>
        )}

        {loading ? (
          <p>Loading...</p>
        ) : entries.length > 0 ? (
          <>
            <div className={styles.latestResultContainer}>
              <div className={styles.latestResultBox}>
                <h2>Latest Result</h2>
                <p><strong>DOS Score:</strong> {entries[0].result_data?.DOS || 'N/A'}</p>
                <p><strong>Analyzed on:</strong> {new Date(entries[0].created_at).toLocaleString()}</p>
                <div className={styles.scatterPlot}>
                  {entries[0]?.drawings?.drawing_data.length > 0 ? (
                    <XYChart data={entries[0].drawings.drawing_data} />
                  ) : (
                    <p>No drawing data available.</p>
                  )}
                </div>
              </div>
            </div>

            <h2 style={{ color: 'white' }}>Past Results</h2>
            <ul className={styles.entriesList}>
              {paginatedEntries.map((entry, index) => (
                <li key={entry.id} className={styles.accordionItem}>
                  <div
                    className={styles.accordionHeader}
                    onClick={() => handleAccordionClick(index)}
                  >
                    <span>
                      {index + 1 + (currentPage - 1) * entriesPerPage}. DOS Score: {entry.result_data?.DOS || 'N/A'} – {new Date(entry.created_at).toLocaleString()}
                      {isSuperuser && (
                        <> — <strong>User:</strong> {entry.email || 'N/A'}</>
                      )}
                    </span>
                    <span className={styles.arrow}>{activeIndex === index ? '▲' : '▼'}</span>
                  </div>
                  {activeIndex === index && (
                    <div className={styles.accordionContent}>
                      <div className={styles.scatterPlot}>
                        {entry.drawings?.drawing_data.length > 0 ? (
                          <XYChart data={entry.drawings.drawing_data} />
                        ) : (
                          <p>No drawing data available.</p>
                        )}
                      </div>
                      <div className={styles.resultLink}>
                        <Link href={`/result/${entry.drawing_id}`} style={{ textDecoration: 'none' }}>
                          View Full Analysis
                        </Link>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <Pagination currentPage={currentPage} setCurrentPage={setCurrentPage} pageCount={pageCount} />
          </>
        ) : (
          <p className={styles.noEntry}>No entries found.</p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
