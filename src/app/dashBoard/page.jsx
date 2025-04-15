'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Sidebar from '../../components/SideBar';
import XYChart from '../../components/Scatter';
import styles from '../../styles/Dashboard.module.css';
import SpiralPlot from "../../components/NewTimeTrace";

const Dashboard = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [activeIndex, setActiveIndex] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const entriesPerPage = 5; // An variable that indicates the number of entries per page

  //Get the user data
  useEffect(() => {
    const fetchUserEntries = async () => {
      setLoading(true);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Error fetching session:', sessionError.message);
        setLoading(false);
        return;
      }

      const user = session?.user;
      if (!user) {
        console.error('No user found');
        setLoading(false);
        return;
      }

      setUsername(user.email.split('@')[0]);

      const { data, error } = await supabase
        .from('api_results')
        .select(`
          id,
          created_at,
          result_data,
          drawing_id,
          drawings (
            id,
            drawing_data
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching entries:', error.message);
      } else {
        console.log('Fetched entries:', data);
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

    fetchUserEntries();
  }, []);

  const handleAccordionClick = (index) => {
    setActiveIndex(activeIndex === index ? null : index);
  };
  //Setting up for the page number in case user have a lot of past entries
  const paginatedEntries = entries.slice(1).slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);
  const pageCount = Math.ceil((entries.length - 1) / entriesPerPage);

  return (
    <div className={styles.pageContainer}>
      <Sidebar />
      <div className={styles.content}>
        <h1 className={styles.welcome}>Welcome back{username ? `, ${username}` : ''}!</h1>

        {loading ? (
          <p>Loading...</p>
        ) : entries.length > 0 ? (
          <>
            {/* Latest Entry */}
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

            <h2>Past Results</h2>
            <ul className={styles.entriesList}>
  {paginatedEntries.map((entry, index) => (
    <li key={entry.id} className={styles.accordionItem}>
      <div
        className={styles.accordionHeader}
        onClick={() => handleAccordionClick(index)}
      >
        <span>
          {index + 1 + (currentPage - 1) * entriesPerPage}. DOS Score: {entry.result_data?.DOS || 'N/A'} - {new Date(entry.created_at).toLocaleString()}
        </span>
        <span className={styles.arrow}>
          {activeIndex === index ? '▲' : '▼'}
        </span>
      </div>
      {activeIndex === index && (
        <div className={styles.accordionContent}>
          <div className={styles.entryDetails}>
          {/*Here can potentially enter some details of each entry*/ }
          </div>
          <div className={styles.scatterPlot}>
            {entry.drawings?.drawing_data.length > 0 ? (

              <XYChart data={entry.drawings.drawing_data} />

            ) : (
              <p>No drawing data available for this entry.</p>
            )}
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
          <p>No entries found.</p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
