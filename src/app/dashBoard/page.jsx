'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Sidebar from '../../components/SideBar';
import XYChart from '../../components/Scatter';
import styles from '../../styles/Dashboard.module.css';
import Link from 'next/link';

const SUPERUSER_EMAIL = process.env.NEXT_PUBLIC_SUPERUSER_EMAIL;

const Dashboard = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [activeIndex, setActiveIndex] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewAll, setViewAll] = useState(false);
  const entriesPerPage = 5;

  useEffect(() => {
    const fetchEntries = async () => {
      setLoading(true);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        console.error('Error fetching session or user not found');
        setLoading(false);
        return;
      }

      const user = session.user;
      setUsername(user.email.split('@')[0]);
      setUserEmail(user.email);

      let query = supabase
      .from('api_results')
      .select(`
        id,
        drawing_id,
        created_at,
        result_data,
        user_id,
        drawings (
          id,
          drawing_data
        )
      `)
      .order('created_at', { ascending: false });
    

      if (user.email !== SUPERUSER_EMAIL || !viewAll) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching entries:', error.message);
      } else {
        const parsedEntries = data.map(entry => {
          let drawingData = [];
          if (entry.drawings?.drawing_data) {
            try {
              drawingData = typeof entry.drawings.drawing_data === 'string'
                ? JSON.parse(entry.drawings.drawing_data)
                : entry.drawings.drawing_data;
            } catch (parseError) {
              console.error('Error parsing drawing_data:', parseError);
            }
          }
          return {
            ...entry,
            drawings: {
              ...entry.drawings,
              drawing_data: drawingData
            }
          };
        });
        setEntries(parsedEntries);
      }
      setLoading(false);
    };

    fetchEntries();
  }, [viewAll]);

  const handleAccordionClick = (index) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  const paginatedEntries = entries.slice(1).slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);
  const pageCount = Math.ceil((entries.length - 1) / entriesPerPage);

  return (
    <div className={styles.pageContainer}>
      <Sidebar />
      <div className={styles.content}>
        <h1 className={styles.welcome}>Welcome back{username ? `, ${username}` : ''}!</h1>

        {/* Superuser view toggle */}
        {userEmail === SUPERUSER_EMAIL && (
          <div style={{ margin: '1rem 0',color:'white' }}>
            <label>
              <input
                type="checkbox"
                checked={viewAll}
                onChange={(e) => setViewAll(e.target.checked)}
              />{' '}
              View all user entries (superuser mode)
            </label>
          </div>
        )}

        {loading ? (
          <p>Loading...</p>
        ) : entries.length > 0 ? (
          <>
            {/* Latest entry */}
            <div className={styles.latestResultContainer}>
              <div className={styles.latestResultBox}>
                <h2>Latest Result</h2>
                <p><strong>DOS Score:</strong> {entries[0].result_data?.DOS || 'N/A'}</p>
                <p><strong>Analyzed on:</strong> {new Date(entries[0].created_at).toLocaleString()}</p>
                <div className={styles.scatterPlot}>
                  {entries[0]?.drawings?.drawing_data.length > 0 ? (
                    <XYChart data={entries[0].drawings.drawing_data} />
                  ) : (
                    <p>No drawing data available for this entry.</p>
                  )}
                </div>
              </div>
            </div>

            <h2 style={{color:'white' }}>Past Results</h2>
<ul className={styles.entriesList}>
  {paginatedEntries.map((entry, index) => (
    <li key={entry.id} className={styles.accordionItem}>
      <div
        className={styles.accordionHeader}
        onClick={() => handleAccordionClick(index)}
      >
        <span>
          {index + 1 + (currentPage - 1) * entriesPerPage}. DOS Score: {entry.result_data?.DOS || 'N/A'} - {new Date(entry.created_at).toLocaleString()}
          {userEmail === SUPERUSER_EMAIL && (
  <> — <strong>User:</strong> {entry.user_id}</>
)}

        </span>
        <span className={styles.arrow}>
          {activeIndex === index ? '▲' : '▼'}
        </span>
      </div>
      {activeIndex === index && (
        <div className={styles.accordionContent}>
          <div className={styles.scatterPlot}>
            {entry.drawings?.drawing_data.length > 0 ? (
              <XYChart data={entry.drawings.drawing_data} />
            ) : (
              <p>No drawing data available for this entry.</p>
            )}
          </div>
          <div className={styles.resultLink}>
            <Link style={{textDecoration:'none'}} href={`/result/${entry.drawing_id}`}>
              View Full Analysis
            </Link>
          </div>
        </div>
      )}
    </li>
  ))}
</ul>
            <div className={styles.pagination}>
              {Array.from({ length: pageCount }, (_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setCurrentPage(i + 1)}
                  className={currentPage === i + 1 ? styles.activePage : ''}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className={styles.noEntry}>No entries found.</p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
