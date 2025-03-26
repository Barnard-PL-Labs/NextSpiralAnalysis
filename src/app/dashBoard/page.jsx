'use client';

import { useEffect, useState } from 'react';
import { supabase } from "@/lib/supabaseClient"; 
import Sidebar from "../../components/SideBar";
import styles from "../../styles/Dashboard.module.css"; // create this file

const Dashboard = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");

  useEffect(() => {
    const fetchUserEntries = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

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
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching entries:', error.message);
      } else {
        setEntries(data);
      }
      setLoading(false);
    };

    fetchUserEntries();
  }, []);

  return (
    <div className={styles.pageContainer}>
      <Sidebar />
      <div className={styles.content}>
      <h1>Welcome back{username ? `, ${username}` : ''}!</h1>

        {loading ? (
          <p>Loading...</p>
        ) : entries.length === 0 ? (
          <p>No entries found.</p>
        ) : (
          <p>Your number of entries: {entries.length}</p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
