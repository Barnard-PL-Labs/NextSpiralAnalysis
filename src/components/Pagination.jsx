'use client';
import { useState, useEffect } from 'react';
import styles from '../styles/Dashboard.module.css';

const Pagination = ({ currentPage, setCurrentPage, pageCount }) => {
  const [inputValue, setInputValue] = useState(currentPage);

  useEffect(() => {
    setInputValue(currentPage);
  }, [currentPage]);

  const commitValue = () => {
    let val = parseInt(inputValue);
    if (isNaN(val) || val < 1) val = 1;
    if (val > pageCount) val = pageCount;
    setCurrentPage(val);
  };

  const handleChange = (e) => {
    let val = e.target.value;
    if (val === "") {
      setInputValue("");
    } else {
      setInputValue(parseInt(val));
    }
  };

  const getPageItems = () => {
    if (pageCount <= 3) {
      return Array.from({ length: pageCount }, (_, i) => i + 1);
    }

    if (currentPage <= 2) {
      return [1, 2, "...", pageCount];
    }

    if (currentPage >= pageCount - 1) {
      return [1, "...", pageCount - 1, pageCount];
    }

    return [1, "...", currentPage, "...", pageCount];
  };

  return (
    <div className={styles.pagination}>
      <button
        type="button"
        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className={styles.pageArrow}
        aria-label="Previous page"
      >
        ‹
      </button>
      <div className={styles.pageNumberGroup}>
        {getPageItems().map((item, index) => (
          item === "..." ? (
            <span key={`ellipsis-${index}`} className={styles.ellipsis}>...</span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => setCurrentPage(item)}
              className={currentPage === item ? styles.activePage : ''}
            >
              {item}
            </button>
          )
        ))}
      </div>
      <button
        type="button"
        onClick={() => setCurrentPage(Math.min(pageCount, currentPage + 1))}
        disabled={currentPage === pageCount}
        className={styles.pageArrow}
        aria-label="Next page"
      >
        ›
      </button>
      <div className={styles.gotoContainer}>
        <input
          type="number"
          min={1}
          max={pageCount}
          value={inputValue}
          onChange={handleChange}
          onBlur={commitValue}
          onKeyDown={(e) => e.key === 'Enter' && commitValue()}
          className={styles.gotoInput}
        />
      </div>
    </div>
  );
};

export default Pagination;
