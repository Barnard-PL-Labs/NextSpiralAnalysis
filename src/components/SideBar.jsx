'use client'
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import styles from '../styles/SideBar.module.css';
import { FaTachometerAlt, FaCog, FaUser, FaBars } from 'react-icons/fa';
import { Squash as Hamburger } from 'hamburger-react';

const Sidebar = () => {
    const [isCollapsed, setIsCollapsed] = useState(false);

    const toggleSidebar = () => {
        setIsCollapsed(!isCollapsed);
    };

    return (
        <div>
            <header className='heading' style={{'backgroundColor':'black'}}>
                <Link href="/">
                    <h1 id="projectName">
                        <Image src="/Icons/generated-icon-removebg.png" width={50} height={50} alt="Logo" priority />
                        Spiral Analysis
                    </h1>
                </Link>
            </header>
        <div className={styles.sidebarContainer}>
      {/* Sidebar Toggle Button */}

      {/* Sidebar Navigation */}
      <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}>
      <div className={styles.toggleButton}>
        <Hamburger toggled={isCollapsed} toggle={setIsCollapsed} />
      </div>
        <nav>
          <ul className={styles.navItems}>
            <li>
              <Link href="/dashBoard">
                <span>
                  <FaTachometerAlt className={styles.icon} />
                  {!isCollapsed && <span>Dashboard</span>}
                </span>
              </Link>
            </li>
            <li>
              <Link href="/machine">
                <span>
                  <FaCog className={styles.icon} />
                  {!isCollapsed && <span>Spiral Analysis</span>}
                </span>
              </Link>
            </li>
            <li>
              <Link href="/profile">
                <span>
                  <FaUser className={styles.icon} />
                  {!isCollapsed && <span>Profile</span>}
                </span>
              </Link>
            </li>
            <li>
              <Link href="/setting">
                <span>
                  <FaCog className={styles.icon} />
                  {!isCollapsed && <span>Setting</span>}
                </span>
              </Link>
            </li>
          </ul>
        </nav>
      </aside>
    </div>
{/*  
        <div className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}>
                <button onClick={toggleSidebar} className={styles.collapseButton}>
                    {isCollapsed ? 'Expand' : 'Collapse'}
                </button>
            <nav>
                <ul className={styles.navItems}>
                    <li>
                        <Link href="/dashBoard">
                            <span>
                                <Image src="/Icons/dashboard-icon.png" width={20} height={20} alt="Dashboard" />
                                {!isCollapsed && <span>Dashboard</span>}
                            </span>
                        </Link>
                    </li>
                    <li>
                        <Link href="/machine">
                            <span>
                                <Image src="/Icons/spiral-icon.png" width={20} height={20} alt="Spiral Analysis" />
                                {!isCollapsed && <span>Spiral Analysis</span>}
                            </span>
                        </Link>
                    </li>
                    <li>
                        <Link href="/profile">
                            <span>
                                <Image src="/Icons/profile-icon.png" width={20} height={20} alt="Profile" />
                                {!isCollapsed && <span>Profile</span>}
                            </span>
                        </Link>
                    </li>
                    <li>
                        <Link href="/setting">
                            <span>
                                <Image src="/Icons/setting-icon.png" width={20} height={20} alt="Setting" />
                                {!isCollapsed && <span>Setting</span>}
                            </span>
                        </Link>
                    </li>
                </ul>
            </nav>
        </div> */}
        </div>
    );
};

export default Sidebar;
