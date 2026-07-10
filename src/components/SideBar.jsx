'use client';

import Link from 'next/link';
import { useState } from 'react';
import styles from '../styles/SideBar.module.css';
import { FaUserCog, FaHome } from 'react-icons/fa';

const MenuIcon = ({ open }) => (
  <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    {open ? (
      <>
        <line x1="3" y1="3" x2="15" y2="15" />
        <line x1="15" y1="3" x2="3" y2="15" />
      </>
    ) : (
      <>
        <line x1="2" y1="5" x2="16" y2="5" />
        <line x1="2" y1="9" x2="16" y2="9" />
        <line x1="2" y1="13" x2="16" y2="13" />
      </>
    )}
  </svg>
);

const Sidebar = ({ onSettingsClick, isOpen, onToggle }) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpen !== undefined ? isOpen : internalOpen;
  const toggle = onToggle || (() => setInternalOpen(prev => !prev));

  return (
    <div className={styles.sidebarContainer}>
      <aside className={`${styles.sidebar} ${!open ? styles.collapsed : ''}`}>

        <div className={styles.brand}>
          <div className={styles.brandMark}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M2 8 Q4 3 8 8 Q12 13 14 8" />
            </svg>
          </div>
          <span className={styles.brandName}>SpiralAnalysis</span>
        </div>

        <button className={styles.toggleButton} onClick={toggle} aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}>
          <MenuIcon open={open} />
        </button>

        <div className={styles.divider} />

        <nav>
          <ul className={styles.navItems}>
            <li>
              <Link href="/">
                <span className={styles.icon}><FaHome /></span>
                <span className={styles.label}>Home</span>
              </Link>
            </li>
            <li>
              <button className={styles.navItemButton} onClick={onSettingsClick}>
                <span className={styles.icon}><FaUserCog /></span>
                <span className={styles.label}>Settings</span>
              </button>
            </li>
          </ul>
        </nav>

      </aside>
    </div>
  );
};

export default Sidebar;
