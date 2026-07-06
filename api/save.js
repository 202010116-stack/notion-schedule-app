const PAGE_ID = "395f1b55e128809bb8aec86a19e5d80f";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST만 지원합니다." });
  const token = process.env.NOTION_TOKEN;
  if (!token) return res.status(500).json({ error: "NOTION_TOKEN 설정이 필요합니다." });

  const { title, start, display, type } = req.body || {};
  if (!title) return res.status(400).json({ error: "내용이 부족합니다." });

  const response = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Notion-Version": "2026-03-11"
    },
    body: JSON.stringify({
      parent: { type: "page_id", page_id: PAGE_ID },
      properties: {
        title: { type: "title", title: [{ type: "text", text: { content: `${type === "할 일" ? "☑" : "📅"} ${display} · ${title}` } }] }
      },
      children: [{
        object: "block", type: "paragraph",
        paragraph: { rich_text: [{ type: "text", text: { content: `${type || "일정"}: ${display}` } }] }
      }]
    })
  });

  const data = await response.json();
  if (!response.ok) return res.status(response.status).json({ error: data.message || "Notion 저장 실패" });
  return res.status(200).json({ ok: true, url: data.url });
}