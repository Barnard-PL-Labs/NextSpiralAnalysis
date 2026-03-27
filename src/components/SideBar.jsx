'use client';

import Link from 'next/link';
import { useState } from 'react';
import styles from '../styles/SideBar.module.css';
import { FaUserCog, FaHome } from 'react-icons/fa';
import { Squash as Hamburger } from 'hamburger-react';

const Sidebar = ({ onSettingsClick, isOpen, onToggle }) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpen !== undefined ? isOpen : internalOpen;
  const toggle = onToggle || (() => setInternalOpen(prev => !prev));

  return (
    <div className={styles.sidebarContainer}>
      <aside className={`${styles.sidebar} ${!open ? styles.collapsed : ''}`}>
        <div className={styles.toggleButton}>
          <Hamburger toggled={open} toggle={toggle} />
        </div>
        <nav>
          <ul className={styles.navItems}>
            <li>
              <Link href="/">
                <div className={`${styles.navItem} ${!open ? styles.collapsedItem : ''}`}>
                  <FaHome className={styles.icon} />
                  {open && <span>Home</span>}
                </div>
              </Link>
            </li>
            <li>
              <button
                onClick={onSettingsClick}
                className={`${styles.navItem} ${!open ? styles.collapsedItem : ''}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}
              >
                <FaUserCog className={styles.icon} />
                {open && <span>Settings</span>}
              </button>
            </li>
          </ul>
        </nav>
      </aside>
    </div>
  );
};

export default Sidebar;
