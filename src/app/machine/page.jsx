"use client"; 
import { useState } from "react";
import Canvas from "@/components/Canvas";
import Button from "@/components/Button";
import styles from "@/styles/Canvas.module.css"; 
import Header from '@/components/Header';
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authProvider"; 
import { supabase } from "@/lib/supabaseClient"; 

export default function MachinePage() {
    const [drawData, setDrawData] = useState([]);
    const [apiResult, setApiResult] = useState(null);
    const { user } = useAuth(); 
    const router = useRouter();

    const sendDataToBackend = async () => {
        const processBody = JSON.stringify(drawData);
        console.log('procesd', processBody);
    
    
        try {
            const response = await fetch("/api/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: processBody,
            });
            if (!response.ok){
                console.log('fyucked up')
                return;
            }else{
                console.log('ook');
            }
            
            const data = await response.json();
            console.log("API Result:", data.result);
            // router.push("/result"); 
            setApiResult(data.result); 
            // After receiving API result, send user_id & save in Supabase
            await saveToDatabase(data.result);
        } catch (error) {
            console.error("Error in processing:", error);
        }
    };

    const saveToDatabase = async (apiResult) => {
        if (!user) {
            alert("Please log in before saving data.");
            return;
        }

        try {
   
         router.push("/result");             //Save drawing data first
            const { data: drawing, error: drawError } = await supabase
                .from("drawings")
                .insert([{ user_id: user.id, drawing_data: drawData }])
                .select("id")
                .single();

            if (drawError) throw drawError;
            const drawingId = drawing.id;

            const { error: resultError } = await supabase
                .from("api_results")
                .insert([{ user_id: user.id, drawing_id: drawingId, result_data: apiResult }]);

            if (resultError) throw resultError;

            console.log("Data saved successfully in Supabase!");
            localStorage.setItem("drawData", JSON.stringify(drawData));
            localStorage.setItem("resultFromApi", JSON.stringify(apiResult));
            
        } catch (error) {
            console.error("Error saving data:", error);
        }
    };

    return (
        <>        
            <Header showVideo={true}/>
            <div className={styles.machineContainer}>
                <h1 className={styles.title}>Spiral Drawing Tool</h1>
                <Canvas setDrawData={setDrawData} />
                <p id={styles.counter}>Total points drawn: {drawData.length}</p>
                <Button sendData={sendDataToBackend} />

            </div>
        </>
    );
}

// "use client"; 
// import { useState } from "react";
// import Canvas from "@/components/Canvas";
// import Button from "@/components/Button";
// import styles from "@/styles/Canvas.module.css"; 
// import Header from '@/components/Header';
// import { useRouter } from "next/navigation";
// import { useAuth } from "@/lib/authProvider"; 

// export default function MachinePage() {
//     const [drawData, setDrawData] = useState([]);
//     const { user } = useAuth(); // Get logged-in user
//     const router = useRouter();

//     const sendDataToBackend = async () => {
//         if (!user) {
//             alert("Please log in before analyzing.");
//             return;
//         }

//         const requestBody = JSON.stringify({
//             user_id: user.id, //  Send user ID
//             drawData
//         });

//         console.log("Processing:", requestBody);

//         try {
//             const response = await fetch("/api/analyze", {
//                 method: "POST",
//                 headers: { "Content-Type": "application/json" },
//                 body: requestBody,
//             });

//             if (!response.ok) {
//                 console.log("Request failed");
//                 return;
//             }

//             const data = await response.json();
//             console.log("Response from API:", data);

//             localStorage.setItem("drawData", JSON.stringify(drawData));
//             localStorage.setItem("resultFromApi", JSON.stringify(data.result));

//             router.push("/result"); 
//         } catch (error) {
//             console.error("Error sending data:", error);
//         }
//     };

//     return (
//         <>        
//             <Header />
//             <div className={styles.machineContainer}>
//                 <h1 className={styles.title}>Spiral Drawing Tool</h1>
//                 <Canvas setDrawData={setDrawData} />
//                 <p id={styles.counter}>Total points drawn: {drawData.length}</p>
//                 <Button sendData={sendDataToBackend} />
//             </div>
//         </>
//     );
// }
