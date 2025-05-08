// "use client"; 
// import { useState, useEffect } from "react";
// import Canvas from "@/components/Canvas";
// import Button from "@/components/Button";
// import styles from "@/styles/Canvas.module.css"; 
// import Header from '@/components/Header';
// import { useRouter } from "next/navigation";
// import { useAuth } from "@/lib/authProvider"; 
// import { supabase } from "@/lib/supabaseClient"; 
// import Loading from '@/components/Loading';

// export default function MachinePage() {
//     const [drawData, setDrawData] = useState([]);
//     const [apiResult, setApiResult] = useState(null);
//     const [isLoading, setIsLoading] = useState(false);
//     const { user } = useAuth(); 
//     const router = useRouter();

//     useEffect(() => {
//         router.prefetch("/result");
//     }, [router]);

//     const sendDataToBackend = async () => {
//         setIsLoading(true);
//         console.log("Sending data to backend:", drawData);
//         console.log("Number of points:", drawData.length);
//         router.push("/result");
//         const processBody = JSON.stringify(drawData);
//         try {
//             const response = await fetch("/api/analyze", {
//                 method: "POST",
//                 headers: { "Content-Type": "application/json" },
//                 body: processBody,
//             });
    
//             if (!response.ok) {
//                 const errorData = await response.json();
//                 console.error("API Error:", errorData);
//                 alert("Error analyzing drawing: " + (errorData.message || "Unknown error"));
//                 setIsLoading(false);
//                 return;
//             }
    
//             const data = await response.json();
//             console.log("API Result:", data.result);
//             setApiResult(data.result);
            
//             // Store data in localStorage before navigation
//             try {
//                 localStorage.setItem("drawData", JSON.stringify(drawData));
//                 localStorage.setItem("resultFromApi", JSON.stringify(data.result));
//                 console.log("Data stored in localStorage");
//             } catch (storageError) {
//                 console.error("Error storing data:", storageError);
//             }
            
//             //save if logged in
//             if (user && user.id) {
//                 await saveToDatabase(data.result);
//             } else {
//                 console.log("Skipping Supabase save: no user logged in");
//             }
            
//             // Navigate after ensuring data is stored

//         } catch (error) {
//             console.error("Error in processing:", error);
//             alert("Error processing drawing: " + error.message);
//         } finally {
//             setIsLoading(false);
//         }
//     };
    
//     const saveToDatabase = async (apiResult) => {
//         try {            
//         //Save drawing data 
//             const { data: drawing, error: drawError } = await supabase
//                 .from("drawings")
//                 .insert([{ user_id: user.id, drawing_data: drawData }])
//                 .select("id")
//                 .single();

//             if (drawError) throw drawError;
//             const drawingId = drawing.id;

//             const { error: resultError } = await supabase
//                 .from("api_results")
//                 .insert([{ user_id: user.id, drawing_id: drawingId, result_data: apiResult }]);

//             if (resultError) throw resultError;

//             console.log("Data saved successfully in Supabase!");
//             localStorage.setItem("drawData", JSON.stringify(drawData));
//             localStorage.setItem("resultFromApi", JSON.stringify(apiResult));
            
//         } catch (error) {
//             console.error("Error saving data:", error);
//         }
//     };

//     return (
//         <> 
//         {isLoading && <Loading />}       
//             <Header showVideo={true}/>
//             <div className={styles.machineContainer}>
//                 <h1 className={styles.title}>Spiral Drawing Tool</h1>
//                 <Canvas setDrawData={setDrawData} />
//                 {/* <p id={styles.counter}>Total points drawn: {drawData.length}</p> */}
//                 <Button sendData={sendDataToBackend} />

//             </div>
//         </>
//     );
// }

"use client"; 
import { useState, useEffect } from "react";
import Canvas from "@/components/Canvas";
import Button from "@/components/Button";
import styles from "@/styles/Canvas.module.css"; 
import Header from '@/components/Header';
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authProvider"; 
import { supabase } from "@/lib/supabaseClient"; 
import Loading from '@/components/Loading';

export default function MachinePage() {
    const [drawData, setDrawData] = useState([]);
    const [apiResult, setApiResult] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const { user } = useAuth(); 
    const router = useRouter();

    // Prefetch the result page for faster navigation
    useEffect(() => {
        router.prefetch("/result");
        // Clear old data on initial load
        console.log("Clearing old data on load...");
        localStorage.removeItem("drawData");
        localStorage.removeItem("resultFromApi");
        sessionStorage.removeItem("drawData");
        sessionStorage.removeItem("resultFromApi");
    }, [router]);

    // Clear previous data when a new drawing starts
    const handleNewDrawing = () => {
        console.log("Clearing data for new drawing...");
        setDrawData([]);
        localStorage.removeItem("drawData");
        localStorage.removeItem("resultFromApi");
        sessionStorage.removeItem("drawData");
        sessionStorage.removeItem("resultFromApi");
    };

    // Send data to the backend for analysis
    const sendDataToBackend = async () => {
        setIsLoading(true);
        console.log("Sending data to backend:", drawData);
        console.log("Number of points:", drawData.length);

        try {
            // Prepare data for the API
            const processBody = JSON.stringify(drawData);

            // Store the new drawing data in local storage
            localStorage.setItem("drawData", processBody);
            sessionStorage.setItem("drawData", processBody);

            // Navigate to the result page
            router.push("/result");

            // Make the API request
            const response = await fetch("/api/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: processBody,
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("API Error:", errorData);
                alert("Error analyzing drawing: " + (errorData.message || "Unknown error"));
                setIsLoading(false);
                return;
            }

            const data = await response.json();
            console.log("API Result:", data.result);
            setApiResult(data.result);
            
            // Store the result
            localStorage.setItem("resultFromApi", JSON.stringify(data.result));
            sessionStorage.setItem("resultFromApi", JSON.stringify(data.result));
            console.log("Data stored in localStorage and sessionStorage");

            // Save to the database if the user is logged in
            if (user && user.id) {
                await saveToDatabase(data.result);
            } else {
                console.log("Skipping Supabase save: no user logged in");
            }

        } catch (error) {
            console.error("Error in processing:", error);
            alert("Error processing drawing: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Save to Supabase if the user is logged in
    const saveToDatabase = async (apiResult) => {
        try {            
            // Save drawing data to Supabase
            const { data: drawing, error: drawError } = await supabase
                .from("drawings")
                .insert([{ user_id: user.id, drawing_data: drawData }])
                .select("id")
                .single();

            if (drawError) throw drawError;
            const drawingId = drawing.id;

            // Save result data to Supabase
            const { error: resultError } = await supabase
                .from("api_results")
                .insert([{ user_id: user.id, drawing_id: drawingId, result_data: apiResult }]);

            if (resultError) throw resultError;

            console.log("Data saved successfully in Supabase!");

        } catch (error) {
            console.error("Error saving data:", error);
        }
    };

    return (
        <> 
        {isLoading && <Loading />}       
            <Header showVideo={true}/>
            <div className={styles.machineContainer}>
                <h1 className={styles.title}>Spiral Drawing Tool</h1>
                <Canvas setDrawData={setDrawData} onStartDrawing={handleNewDrawing} />
                <Button sendData={sendDataToBackend} />
            </div>
        </>
    );
}

