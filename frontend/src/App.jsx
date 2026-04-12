import { useEffect, useState } from 'react';
import getCalendar from './getCalendar';

function App(){
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(1);
  const calendar = getCalendar(year, month);
  const days = ["日","月","火","水","木","金","土"];
  const [selectedDate, setSelectedDate] = useState(1);
  console.log(selectedDate);

  function result(day){
    setSelectedDate(day);
  }
  useEffect(() => {
    (async () => {
      const url = import.meta.env.VITE_SUPABASE_URL + "/qiita-api-test";
        
      const response = await fetch(url, {
        method: "GET" ,
        headers: {
          "Authorization": import.meta.env.VITE_SUPABASE_TOKEN,
          "Content-Type": "application/json"
        }
      });
      const result = await response.json();
      console.log(result);
    })();
  }, []);
  return(
    <>
      <div>
        <h1>カレンダーアプリ</h1>
      </div>
      <div>
        <p>{month}月</p>
      </div>
      <table border="1">
        <tbody>
          <tr>
            {days.map((day, i) => (
              <td key={i}>{day}</td>
            ))}
          </tr>
          { calendar.map((week, j) => {
            return (<tr key={j}>
              { week.map((day, k) => {
                return <td key={k} onClick={() => result(day)} style={{'cursor': 'pointer'}}>{ day }</td>
              }) }
            </tr>)
          }) }
        </tbody>
      </table>
    </>
  )
}
export default App;
