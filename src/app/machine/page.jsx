"use client"; 
import { useState } from "react";
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
    
    const sendDataToBackend = async () => {
        setIsLoading(true); // Start loading
        const processBody = JSON.stringify(drawData);
        try {
            const response = await fetch("/api/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: processBody,
            });
    
            if (!response.ok) {
                console.log("couldnot get fetched");
                setIsLoading(false);
                return;
            }
    
            const data = await response.json();
            console.log("API Result:", data.result);
            setApiResult(data.result);
            
            //save if logged in
            if (user && user.id) {
                await saveToDatabase(data.result);
            } else {
                console.log("Skipping Supabase save: no user logged in");
            }
            router.push("/result");
        } catch (error) {
            console.error("Error in processing:", error);
        } finally {
            setIsLoading(false); //  Stop loading regardless of outcome
        }
    };
    
    const saveToDatabase = async (apiResult) => {
        try {            
        //Save drawing data 
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
        {isLoading && <Loading />}       
            <Header showVideo={true}/>
            <div className={styles.machineContainer}>
                <h1 className={styles.title}>Spiral Drawing Tool</h1>
                <Canvas setDrawData={setDrawData} />
                {/* <p id={styles.counter}>Total points drawn: {drawData.length}</p> */}
                <Button sendData={sendDataToBackend} />

            </div>
        </>
    );
}


