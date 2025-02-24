import Header from '@/components/Header';
import styles from '@/styles/Login.module.css';

export default function Login(){
    return(
        <div>
        <Header />
        <div className = {styles.loginFormContainer}>

        <input className={styles.metrics} type = 'text' placeholder='Username' id = 'username' required />
        <input className={styles.metrics} type = 'password' placeholder='Password' id = 'password' required />
        </div>
        </div>
    )
}