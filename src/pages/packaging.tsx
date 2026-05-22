import Link from "next/link";
import { Shell } from "@/pages/index";
import { loadModel } from "@/lib/model";
import { rub } from "@/lib/format";

export async function getServerSideProps() {
  const data = await loadModel();
  const links = data.productsRaw.flatMap((product: any) =>
    product.packagingLinks.map((link: any) => ({
      id: link.id,
      skuId: product.id,
      skuName: product.name,
      packagingItem: link.packaging.name,
      unitCost: link.packaging.costPerUnit,
      quantityPerOrder: link.units,
      totalCost: link.packaging.costPerUnit * link.units,
      deliveryOnly: /delivery|достав/i.test(`${link.comment ?? ""} ${link.packaging.comment ?? ""}`),
      comment: link.comment ?? link.packaging.comment ?? ""
    }))
  );
  return {
    props: {
      packaging: JSON.parse(JSON.stringify(data.packagingRaw)),
      links: JSON.parse(JSON.stringify(links))
    }
  };
}

export default function PackagingPage({ packaging, links }: any) {
  return (
    <Shell>
      <div className="pageHeader">
        <div>
          <h1>Packaging</h1>
          <p>Отдельный справочник упаковки и привязок к SKU: unit cost, linked SKU, quantity per order, delivery-only/all-orders indication.</p>
        </div>
      </div>
      <div className="metrics">
        <Metric title="Packaging items" value={String(packaging.length)} />
        <Metric title="Linked SKU rows" value={String(links.length)} />
        <Metric title="Average packaging cost" value={rub(links.length ? links.reduce((sum: number, row: any) => sum + row.totalCost, 0) / links.length : 0)} />
      </div>
      <section className="band">
        <div className="sectionHead"><h2>Packaging links</h2><Link href="/ingredients">Edit packaging directory</Link></div>
        <div className="tableScroll">
          <table className="skuTable">
            <thead>
              <tr>
                <th>Packaging item</th>
                <th>Unit cost</th>
                <th>Linked SKU</th>
                <th>Quantity per order</th>
                <th>Final packaging cost</th>
                <th>Delivery only / all orders</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              {links.map((row: any) => (
                <tr key={row.id}>
                  <td><strong>{row.packagingItem}</strong></td>
                  <td>{rub(row.unitCost)}</td>
                  <td><Link className="skuLink" href={`/sku/${row.skuId}`}>{row.skuName}</Link></td>
                  <td>{row.quantityPerOrder}</td>
                  <td>{rub(row.totalCost)}</td>
                  <td>{row.deliveryOnly ? "Delivery only" : "All orders"}</td>
                  <td>{row.comment || "—"}</td>
                </tr>
              ))}
              {!links.length && <tr><td colSpan={7}>Привязки упаковки к SKU пока не заполнены.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <section className="band">
        <h2>Packaging directory</h2>
        <div className="tableScroll">
          <table>
            <thead><tr><th>Item</th><th>Unit cost</th><th>Supplier</th><th>Comment</th></tr></thead>
            <tbody>
              {packaging.map((item: any) => <tr key={item.id}><td>{item.name}</td><td>{rub(item.costPerUnit)}</td><td>{item.supplier || "—"}</td><td>{item.comment || "—"}</td></tr>)}
              {!packaging.length && <tr><td colSpan={4}>Упаковка пока не создана.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </Shell>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return <div className="metric"><span>{title}</span><strong>{value}</strong></div>;
}
