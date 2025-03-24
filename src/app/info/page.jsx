import Header from '../../components/Header'
import styles from '../../styles/Info.module.css'
import TeamMember from '../../components/Team';

const teamMembers = [
    {
      name: 'Seth L. Pullman, MD',
      position: 'Director',
      bio: 'Clinical Motor Physiology Laboratory',
      uni:'Columbia University',
      imageUrl: '/Icons/Team/pullman.png',
      isDirector: true,
    },
    {
      name: 'Mark Santolucito, PhD',
      position: 'Director',
      bio: 'Barnard Programming Languages Lab',
      uni:'Barnard College',
      imageUrl: '/Icons/Team/MarkSantolucito.png',
      isDirector: true,
    },
    {
        name: 'Alexandra Shanabrook',
        position: 'Engineering Team',
        bio: '',
        uni:"Columbia University '23",
        imageUrl: '/Icons/Team/AlexandraShanabrook.png',
      },
      {
        name: 'Krystal Briggs',
        position: 'Engineering Team',
        bio: 'CS MS Bridge',
        uni:'Columbia University',
        imageUrl: '/Icons/Team/KrystalBriggs.png',
      },
      {
        name: 'Joseph Rebagliati',
        position: 'Engineering Team',
        bio: 'CS MS Bridge',
        uni:'Columbia University',
        imageUrl: '/Icons/Team/JosephRebagliati.png',
      },
      {
        name: 'Yuhao Dong',
        position: 'Engineering Team',
        bio: 'CS MS Bridge',
        uni:'Columbia University',
        imageUrl: '/Icons/Team/YuhaoDong.png',
      },
      {
        name: 'Whitney Deng',
        position: 'Engineering Team',
        bio: '',
        uni:"Barnard College '23",
        imageUrl: '/Icons/Team/WhitneyDeng.png',
      },

  
  ];

export default function TeamPage(){
    return(
    <>
    <div className={styles.teamPage}>
  <Header showVideo={true} />
  <h1>Meet Our Team</h1>
  <div className={styles.teamSection}>
    <div className={styles.directorsRow}>
      {teamMembers
        .filter((member) => member.isDirector)
        .map((director,index) => (
          <TeamMember key={index} {...director} />
        ))}
    </div>
    <div className={styles.membersRow}>
      {teamMembers
        .filter((member) => !member.isDirector)
        .map((member,index) => (
          <TeamMember key={index} {...member} />
        ))}
    </div>
  </div>
</div>

  </>)

}
