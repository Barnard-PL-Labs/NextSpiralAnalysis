'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import styles from '../styles/SideBar.module.css';
import { FaTachometerAlt, FaCog, FaPhoenixSquadron, FaChartBar, FaPencilAlt, FaUserCog, FaHome } from 'react-icons/fa';
import { Squash as Hamburger } from 'hamburger-react';

const Sidebar = ({ onSettingsClick }) => {
    const [isOpen, setIsOpen] = useState(false);  

    return (
        <div>
            <header className="heading fixed top-0 left-0 w-full z-50">
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

            <div className={styles.sidebarContainer}>
                <aside className={`${styles.sidebar} ${!isOpen ? styles.collapsed : ''}`}>
                    <div className={styles.toggleButton}>
                        <Hamburger toggled={isOpen} toggle={() => setIsOpen(prev => !prev)} />
                    </div>
                    <nav>
                        <ul className={styles.navItems}>
                            <li>
                                <Link href="/">
                                    <div className={`${styles.navItem} ${!isOpen ? styles.collapsedItem : ''}`}>
                                        <FaHome className={styles.icon} />
                                        {isOpen && <span>Home</span>}
                                    </div>
                                </Link>
                            </li>
                            <li>
                                <button 
                                    onClick={onSettingsClick}
                                    className={`${styles.navItem} ${!isOpen ? styles.collapsedItem : ''}`}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}
                                >
                                    <FaUserCog className={styles.icon} />
                                    {isOpen && <span>Settings</span>}
                                </button>
                            </li>
                        </ul>
                    </nav>
                </aside>
            </div>
        </div>
    );
};

export default Sidebar;
