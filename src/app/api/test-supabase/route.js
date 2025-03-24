import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

// export async function GET() {
//     console.log(" Fetching data from Supabase...");

//     const { data, error } = await supabase
//         .from("Users")  // 🔹 Make sure this is the correct table name
//         .select("*");             // 🔹 Retrieves all columns

//     if (error) {
//         console.error(" Supabase error:", error);
//         return NextResponse.json({ error: error.message }, { status: 500 });
//     }

//     console.log("" Supabase Response:", data);
//     return NextResponse.json({ data });
// }

export async function GET(){
    const {data, error} = await supabase .from('drawings').select('*');

    if (error){
        return NextResponse.json({error:error.message})
    }

    return NextResponse.json({data})
}