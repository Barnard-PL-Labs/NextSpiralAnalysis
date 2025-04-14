'use client'
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import styles from '../styles/SideBar.module.css';
import { FaTachometerAlt, FaCog, FaUser, FaBars, FaPhoenixSquadron } from 'react-icons/fa';
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
                  <FaPhoenixSquadron className={styles.icon}/>
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
        </div>
    );
};

export default Sidebar;
