'use client';
import Link from 'next/link';
import { FaTachometerAlt, FaCog, FaPhoenixSquadron } from 'react-icons/fa';
import styles from '../styles/BottomNav.module.css';

const BottomNav = ({ onSettingsClick }) => {
  return (
    <div className={styles.spacer}>
      <div className={styles.bottomNav}>
        <Link href="/dashBoard">
          <div className={styles.navItem}>
            <FaTachometerAlt />
            <span>Dashboard</span>
          </div>
        </Link>

        <Link href="/machine">
          <div className={styles.centerItem}>
            <div className={styles.centerIconWrapper}>
              <FaPhoenixSquadron className={styles.centerIcon} />
            </div>
          </div>
        </Link>

        <button
          onClick={onSettingsClick}
          className={styles.navItem}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
        >
          <FaCog />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
};

export default BottomNav;
