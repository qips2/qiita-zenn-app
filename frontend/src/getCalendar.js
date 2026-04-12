function getCalendar(year, month){
    const lastDate = new Date(year, month, 0).getDate();
    const firstDay = new Date(year, month-1,1).getDay();
    const calendar = [];
    const week = [];
    for(let i = 0; i < firstDay; i++){
        week.push("");//前の月の日付とか
    }
    for(let date = 1; date <= lastDate; date++){
        week.push(date);//dateを数値ではなく、オブジェクト

        if(week.length === 7){
            calendar.push([...week]);
            week.splice(0);
        }
    }

    if(week.length > 0){
        while(week.length < 7){
            week.push("");
        }
        calendar.push(week);
    }
    return calendar;
}
export default getCalendar;
