import Header from '@/components/Header'
import Loading from '../../components/Loading'
//I am going to delete this page as info page is alr sufficient
export default function moreInfo(){
    return(
        <div>
            
            Spiral Analysis Information
What is Spiral Analysis?
Spiral analysis is a sophisticated method used to evaluate upper limb motor control. It involves drawing a spiral on a digitizing tablet or touchscreen device, which captures various parameters such as pressure, speed, and accuracy. This non-invasive technique provides valuable insights into a person's neuromotor function.

Key Metrics in Spiral Analysis
For a full listing of the metrics provided by Spiral Analysis, please see the API documentation.

DOS (Degree of Severity): A comprehensive measure of overall spiral drawing performance, indicating the severity of motor impairment.
Smoothness: Evaluates the continuity and fluidity of the drawn spiral, reflecting the steadiness of hand movements.
Tightness: Measures how closely the spiral turns are drawn to each other, indicating control over fine motor movements.
Pressure: Analyzes the force applied while drawing the spiral, which can reveal tremors or muscle weakness.
Speed: Measures the velocity of drawing at different points in the spiral, providing insights into motor planning and execution.
Frequency Analysis: Examines the rhythmic components of the drawing, which can help identify specific types of tremors.


How to Use This Tool
Draw a spiral on the provided canvas using your mouse or touchscreen.
Try to make the spiral as round and evenly spaced as possible.
Maintain a consistent drawing speed and pressure.
Draw at least 3-4 complete revolutions for accurate analysis.
Click the "Analyze" button to process your spiral.
Review the results and graphs provided for insights into your drawing.
Compare your results over time to track changes in your motor function.
Interpreting the Results
The analysis provides a range of metrics and visualizations:

DOS Score: A lower score generally indicates better motor control.
Pressure and Speed Graphs: Look for consistency and smooth curves.
Frequency Analysis: Helps identify any recurring patterns or tremors in your drawing.
⚠ Note: This tool is for educational purposes only. For medical concerns, always consult with a healthcare professional.


        </div>
    )
}