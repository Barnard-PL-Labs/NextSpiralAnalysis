import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import Header from "../components/Header";


export default function Home() {
    return (
        <>
            <Head>
                <meta charSet="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <link rel="icon" type="image/x-icon" href="/Icons/generated-icon-removebg.png" />
                <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap" rel="stylesheet" />
                <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;700&display=swap" rel="stylesheet" />
                <title>Spiral Analysis</title>
            </Head>
{/* 
            <div className="video">
                <video src="/Icons/indexBackgroundVid.mp4.mp4" id="vid" autoPlay loop muted></video>
            </div>

            <header className="heading">
                <Link href="/">
                    <h1 id="projectName">
                        <Image src="/Icons/generated-icon-removebg.png" width={64} height={64} alt="Logo" />
                        Spiral Analysis
                    </h1>
                </Link>
                <ul className="navItems">
                    <li><Link href="/"><span>Home</span></Link></li>
                    <li><Link href="/machine"><span>Spiral Analysis</span></Link></li>
                    <li><Link href="/"><span>Learn More</span></Link></li>
                    <li><Link href="/info"><span>About Us</span></Link></li>
                    <li><Link href="/info"><span>Login</span></Link></li>
                </ul>
            </header> */}
            <Header />

            <div className="attractiveContent">
                <h1 id="contentTitle">Analyze Your Motor Skills <br />
                    <span id="diffPart"> with Precision</span>
                </h1>
                <p>
                    Your movements reveal a lot about motor control. With Spiral Analysis, a simple spiral drawing can measure
                    smoothness, speed, and pressure, helping you track neuromotor function. Whether you're a researcher,
                    a medical professional, or just curious, this non-invasive tool makes it easy to gain insights into hand stability.
                </p>
                <Link href="/machine"><button className="indexButton" id="goMachine">GET STARTED</button></Link>
                <Link href="/info"><button className="indexButton" id="goInfo">HOW IT WORKS ➝</button></Link>
            </div>
        </>
    );
}
