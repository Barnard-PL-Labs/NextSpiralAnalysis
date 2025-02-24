"use client"; 
import {useState} from "react";
import Canvas from "@/components/Canvas";
import Button from "@/components/Button";
import styles from "@/styles/Canvas.module.css"; 
import Header from '@/components/Header';

// export default function MachinePage() {
//     // const [drawData, setDrawData] = useState([]);
//     // const updateDrawData = (newPoints) => {
//     //     setDrawData(newPoints);
//     // };

//     return (<>
//     <Header />
//         {/* <div className={styles.videoContainer}>
//         <video src="/Icons/indexBackgroundVid.mp4.mp4" id="vid" autoPlay loop muted></video>
//         </div> */}

//         <div className={styles.machineContainer}>
//             <h1 className={styles.title}>Spiral Drawing Tool</h1>
//             <Canvas />
//             <Buttons />
//         </div>
//         </>
//     );
// }



export default function MachinePage() {
    const [drawData, setDrawData] = useState([]);

const sendDataToBackend = async () => {
    console.log("Preparing to send drawData:", JSON.stringify(drawData, null, 2));

    try {
        const response = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(drawData),
        });

        const data = await response.json();
        console.log(" Response from external API:", data);
    } catch (error) {
        console.error(" Error sending data:", error);
    }
};


    return (<>        
    <Header />
        <div>
        <div className={styles.machineContainer}>
        <h1 className={styles.title}>Spiral Drawing Tool</h1>

        <Canvas setDrawData={setDrawData} />
        <p id={styles.counter}>Total points drawn: {drawData.length}</p>
        <Button sendData={sendDataToBackend} />
    </div></div></>

    );
}

