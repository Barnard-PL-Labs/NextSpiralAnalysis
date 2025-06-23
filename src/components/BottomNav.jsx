'use client';
import Link from 'next/link';
import { FaTachometerAlt, FaCog, FaPhoenixSquadron } from 'react-icons/fa';
import styles from '../styles/BottomNav.module.css';
import Image from 'next/image';

const BottomNav = ({ onSettingsClick }) => {
  return (
    <>
<header className="fixed top-0 left-0 w-full z-50 bg-white flex justify-center items-center py-3 shadow-md">
<Link href="/">
          <h1 id="projectName" className="flex items-center space-x-2">
            <Image
              src="/Icons/generated-icon-removebg.png"
              width={45}
              height={45}
              className="w-12 h-12 align-middle"
              alt="Logo"
              priority
            />
          <span className="text-3xl leading-none font-bold">
          Spiral Analysis
          </span>

          </h1>
        </Link>
        </header>
      <div className={styles.spacer} /> 

      <div className={styles.bottomNav}>
        <Link href="/dashBoard">
          <div className={styles.navItem}><FaTachometerAlt /><span>Dashboard</span></div>
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
          <FaCog /><span>Setting</span>
        </button>
      </div>
    </>
  );
};

export default BottomNav;
