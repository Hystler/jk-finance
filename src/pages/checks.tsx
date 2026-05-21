import { useState } from "react";
import { Shell } from "@/pages/index";
import { loadModel } from "@/lib/model";

const filters = ["All", "Critical", "Warning", "Missing data", "SKU", "Store Model", "CAPEX", "OPEX"];

export async function getServerSideProps() {
  const data = await loadModel();
  return { props: { checks: data.checks } };
}

export default function ChecksPage({ checks }: any) {
  const [filter, setFilter] = useState("All");
  const visible = checks.filter((check: any) => {
    if (filter === "All") return true;
    if (filter === "Critical") return check.severity === "critical";
    if (filter === "Warning") return check.severity === "warning";
    return check.category === filter;
  });

  return (
    <Shell>
      <div className="pageHeader"><div><h1>Checks</h1><p>Автоматические проверки SKU, missing assumptions и нереалистичных ratios.</p></div></div>
      <section className="band">
        <div className="segmented wrap">
          {filters.map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}
        </div>
        <div className="checks">
          {visible.map((check: any) => (
            <div className={`check ${check.severity}`} key={`${check.code}-${check.message}`}>
              <strong>{check.severity}</strong>
              <span>{check.category ?? "General"}</span>
              <span>{check.code}</span>
              <span>{check.message}</span>
            </div>
          ))}
          {!visible.length && <p>Проверки в этом фильтре не нашли проблем.</p>}
        </div>
      </section>
    </Shell>
  );
}
