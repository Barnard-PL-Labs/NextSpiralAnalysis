import Image from 'next/image';
import styles from '../styles/Info.module.css'
const TeamMember = ({ name, position, bio, uni, imageUrl, isDirector }) => (
  <div className={`${styles.teamMember} ${isDirector ? styles.director : ''}`}>
    <div className={styles.imageContainer}><Image src={imageUrl} alt={name} width={150} height={150} className={styles.teamMemberImage} />
    {/*Below is to add the lighting bolt to the two directors, but will remove and replace with only text for the about us page*/}
    {isDirector && <div className={styles.badge}><svg
      className={styles.bolt}
      viewBox="0 0 24 24"
      fill="white"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M13 2L3 14H11L11 22L21 10H13L13 2Z" />
    </svg></div>}</div>
    <h3>{name}</h3>
    <p>{position}</p>
    <p>{bio}</p>
    <p>{uni}</p>
  </div>
);

export default TeamMember;
