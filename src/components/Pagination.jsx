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

  return (
    <div className={styles.pagination}>
      {pageCount <= 5 ? (
        Array.from({ length: pageCount }, (_, i) => (
          <button
            key={i + 1}
            onClick={() => setCurrentPage(i + 1)}
            className={currentPage === i + 1 ? styles.activePage : ''}
          >
            {i + 1}
          </button>
        ))
      ) : (
        <>
          <button onClick={() => setCurrentPage(1)} className={currentPage === 1 ? styles.activePage : ''}>1</button>
          {currentPage > 3 && <span className={styles.ellipsis}>...</span>}
          {currentPage > 2 && (
            <button onClick={() => setCurrentPage(currentPage - 1)}>{currentPage - 1}</button>
          )}
          {currentPage !== 1 && currentPage !== pageCount && (
            <button className={styles.activePage}>{currentPage}</button>
          )}
          {currentPage + 1 < pageCount && (
            <button onClick={() => setCurrentPage(currentPage + 1)}>{currentPage + 1}</button>
          )}
          {currentPage < pageCount - 2 && <span className={styles.ellipsis}>...</span>}
          <button onClick={() => setCurrentPage(pageCount)} className={currentPage === pageCount ? styles.activePage : ''}>{pageCount}</button>
        </>
      )}
      <div className={styles.gotoContainer}>
        <span>Go to:</span>
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
