const PAGE_ID="395f1b55e128809bb8aec86a19e5d80f";
const CALENDAR_DATABASE_ID="395f1b55e128809480dbdf50c07d3f27";
const V="2026-03-11";

async function n(path,token,options={}){
  const r=await fetch(`https://api.notion.com${path}`,{
    ...options,
    headers:{"Authorization":`Bearer ${token}`,"Content-Type":"application/json","Notion-Version":V,...(options.headers||{})}
  });
  const d=await r.json();
  if(!r.ok) throw Error(d.message||`Notion 오류 (${r.status})`);
  return d;
}

async function calendarInfo(token){
  const db=await n(`/v1/databases/${CALENDAR_DATABASE_ID}`,token);
  const id=db.data_sources?.[0]?.id;
  if(!id) throw Error("캘린더 데이터 소스를 찾지 못했어요.");
  const ds=await n(`/v1/data_sources/${id}`,token);
  const e=Object.entries(ds.properties||{});
  const title=e.find(([,p])=>p.type==="title")?.[0];
  const date=e.find(([,p])=>p.type==="date")?.[0];
  if(!title||!date) throw Error("캘린더 제목 또는 날짜 속성을 찾지 못했어요.");
  return {id,title,date};
}

function urgency(start,display){
  let target;
  if(start) target=new Date(start);
  else target=new Date(display.replaceAll(".","-")+"T12:00:00");
  const now=new Date(); now.setHours(0,0,0,0);
  const day=new Date(target); day.setHours(0,0,0,0);
  const diff=Math.round((day-now)/86400000);
  if(diff<=0) return {label:"🚨 급한 일",prefix:"🚨"};
  if(diff<=2) return {label:"⏰ 하루 이틀 안에 해야 할 일",prefix:"⏰"};
  return {label:"📅 예정된 일",prefix:"📅"};
}

async function addListPage(token,text,detail){
  return n("/v1/pages",token,{
    method:"POST",
    body:JSON.stringify({
      parent:{type:"page_id",page_id:PAGE_ID},
      properties:{title:{type:"title",title:[{type:"text",text:{content:text}}]}},
      children:[{object:"block",type:"paragraph",paragraph:{rich_text:[{type:"text",text:{content:detail}}]}}]
    })
  });
}

export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"POST만 지원합니다."});
  const token=process.env.NOTION_TOKEN;
  if(!token) return res.status(500).json({error:"NOTION_TOKEN 설정이 필요합니다."});
  const {title,start,display}=req.body||{};
  if(!title) return res.status(400).json({error:"내용이 부족합니다."});

  try{
    if(display&&display!=="날짜 없음"){
      const u=urgency(start,display);
      const c=await calendarInfo(token);
      const dateValue=start?{start}:{start:display.replaceAll(".","-")};

      await n("/v1/pages",token,{
        method:"POST",
        body:JSON.stringify({
          parent:{type:"data_source_id",data_source_id:c.id},
          properties:{
            [c.title]:{type:"title",title:[{type:"text",text:{content:`${u.prefix} ${title}`}}]},
            [c.date]:{type:"date",date:dateValue}
          }
        })
      });

      await addListPage(
        token,
        `${u.prefix} ${display} · ${title}`,
        `${u.label}\n일정: ${display}`
      );

      return res.status(200).json({ok:true,destination:"both",urgency:u.label});
    }

    await addListPage(token,`☑ 날짜 없음 · ${title}`,"할 일: 날짜 없음");
    return res.status(200).json({ok:true,destination:"list"});
  }catch(e){
    return res.status(500).json({error:e.message||"Notion 저장 실패"});
  }
}